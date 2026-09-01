import { randomUUID } from 'crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SpecCardType } from '@prisma/client';
import { DecisionService } from './decision.service';
import { DependencyGraphService, WorkflowNode } from './dependency-graph.service';
import { AI_GATEWAY, AiGateway } from './integrations/ai-gateway.port';
import { PrismaService } from './prisma.service';
import { ProjectService, SpecData } from './project.service';

export type ClaimEvidence = {
  claim: string;
  baseline: string;
  metric: string;
  evidence: string;
  rejectionCondition: string;
};

export type ContributionItem = {
  id: string;
  label: string;
  claimEvidence: ClaimEvidence | null;
};

export type ExperimentItem = Record<string, unknown> & { relatedContributionIds?: string[] };

export type ExperimentPlan = {
  contributions: ContributionItem[];
  experiments: ExperimentItem[];
  feasibility: Record<string, unknown>;
  confirmed?: boolean;
  selectedContributionIds?: string[];
};

const EMPTY_PLAN: ExperimentPlan = { contributions: [], experiments: [], feasibility: {} };

@Injectable()
export class ExperimentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
    private readonly decisions: DecisionService,
    private readonly dependencyGraph: DependencyGraphService,
    @Inject(AI_GATEWAY) private readonly ai: AiGateway,
  ) {}

  /** Step 4a: generate the initial plan (contributions + claims + experiments + feasibility). */
  async generatePlan(projectId: string) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const cards = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id } });
    const problem = cards.find((card) => card.type === SpecCardType.PROBLEM)?.content ?? '';
    const gap = cards.find((card) => card.type === SpecCardType.GAP_CANDIDATE)?.content ?? '';
    const gapAnalysis = (data.gapAnalysis ?? {}) as { directions?: { letter: string; label?: string; selected?: boolean }[] };
    const direction = gapAnalysis.directions?.find((item) => item.selected);
    // Send the direction's human-readable label (not the A–D letter) so the AI
    // sees the actual content — especially the custom "Other" text the user typed.
    const directionLabel = direction?.label ?? direction?.letter;
    const response = await this.ai.specExperiment(problem, gap, directionLabel);
    const output = response.output;
    const contributions = Array.isArray(output.contributions) ? output.contributions.map(String) : [];
    const claims = Array.isArray(output.claims) ? output.claims : [];
    const experiments = Array.isArray(output.experiments) ? output.experiments : [];
    const feasibility = (output.feasibility_estimation ?? {}) as Record<string, unknown>;
    const contributionItems: ContributionItem[] = contributions.map((label, index) => ({
      id: `contrib-${index + 1}`,
      label,
      claimEvidence: claims[index] ? this.toClaimEvidence(claims[index]) : null,
    }));
    const plan: ExperimentPlan = { contributions: contributionItems, experiments, feasibility };
    return this.prisma.$transaction(async (tx) => {
      const nextSpec = await this.projects.createSpec(projectId, { ...data, experimentPlan: plan });
      await this.invalidate(projectId, nextSpec.id, 'experiment', tx);
      return plan;
    });
  }

  /** Step 4b: add a manual contribution (no experiment generated). */
  async addContribution(projectId: string, label: string) {
    return this.prisma.$transaction(async (tx) => {
      const spec = await this.projects.latestSpec(projectId);
      const data = spec.data as SpecData;
      const plan = this.readPlan(data);
      const contribution: ContributionItem = { id: `contrib-${randomUUID()}`, label, claimEvidence: null };
      const nextPlan = { ...plan, contributions: [...plan.contributions, contribution] };
      const nextSpec = await this.projects.createSpec(projectId, { ...data, experimentPlan: nextPlan });
      await this.invalidate(projectId, nextSpec.id, 'contribution', tx);
      await this.decisions.record(projectId, 'ACCEPT', `contribution:${contribution.id}`, { label }, tx);
      return { contribution };
    });
  }

  /** Step 4b2: rename an existing contribution (frontend PUT). */
  async updateContribution(projectId: string, contributionId: string, label: string) {
    return this.prisma.$transaction(async (tx) => {
      const spec = await this.projects.latestSpec(projectId);
      const data = spec.data as SpecData;
      const plan = this.readPlan(data);
      const contribution = plan.contributions.find((item) => item.id === contributionId);
      if (!contribution) throw new NotFoundException(`Contribution ${contributionId} was not found`);
      const nextPlan = {
        ...plan,
        contributions: plan.contributions.map((item) =>
          item.id === contributionId ? { ...item, label } : item,
        ),
      };
      const nextSpec = await this.projects.createSpec(projectId, { ...data, experimentPlan: nextPlan });
      await this.invalidate(projectId, nextSpec.id, 'contribution', tx);
      await this.decisions.record(projectId, 'ACCEPT', `contribution:${contributionId}`, { label }, tx);
      return { contribution: { ...contribution, label } };
    });
  }

  /** Step 4c: save claim–evidence; generate an experiment only when none is linked yet. */
  async saveClaimEvidence(projectId: string, contributionId: string, input: ClaimEvidence) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const plan = this.readPlan(data);
    const contribution = plan.contributions.find((item) => item.id === contributionId);
    if (!contribution) throw new NotFoundException(`Contribution ${contributionId} was not found`);
    const claimEvidence: ClaimEvidence = {
      claim: input.claim,
      baseline: input.baseline,
      metric: input.metric,
      evidence: input.evidence,
      rejectionCondition: input.rejectionCondition,
    };
    const hasExperiment = plan.experiments.some((experiment) => experiment.relatedContributionIds?.includes(contributionId));
    let experiment: ExperimentItem | null = null;
    let needsReview = false;
    if (hasExperiment) {
      needsReview = true;
    } else {
      const response = await this.ai.singleClaimExperiment(claimEvidence);
      const raw = response.output.experiment as Record<string, unknown> | undefined;
      if (raw && typeof raw === 'object') {
        experiment = { ...raw, relatedContributionIds: [contributionId] };
      }
    }
    const nextPlan: ExperimentPlan = {
      ...plan,
      contributions: plan.contributions.map((item) => (item.id === contributionId ? { ...item, claimEvidence } : item)),
      experiments: experiment ? [...plan.experiments, experiment] : plan.experiments,
    };
    // The AI call stays outside the tx; createSpec + invalidation + decision are atomic.
    return this.prisma.$transaction(async (tx) => {
      const nextSpec = await this.projects.createSpec(projectId, { ...data, experimentPlan: nextPlan });
      await this.invalidate(projectId, nextSpec.id, 'claim', tx);
      await this.decisions.record(projectId, 'ACCEPT', `claim-evidence:${contributionId}`, { claimEvidence }, tx);
      return { claimEvidence, experiment, needsReview };
    });
  }

  /** Step 4d: recompute feasibility for the selected contributions. */
  async feasibility(projectId: string, selectedContributionIds: string[]) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const plan = this.readPlan(data);
    const scaled = this.scaleFeasibility(plan, selectedContributionIds);
    return {
      model: String(scaled.model_name ?? ''),
      seedPrompts: Number(scaled.seed_prompts_count ?? 0),
      rounds: Number(scaled.rounds ?? 0),
      candidates: Number(scaled.candidates_count ?? 0),
      vram: Number(scaled.vram_needed_gb ?? 0),
      hours: Number(scaled.gpu_time_hours ?? 0),
      tokens: Math.round(Number(scaled.tokens_estimated ?? 0)),
      isFeasible: Boolean(scaled.is_feasible ?? false),
      explanation: String(scaled.explanation ?? ''),
    };
  }

  /** Step 4e: confirm the plan with the selected contributions. */
  async confirm(projectId: string, selectedContributionIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const spec = await this.projects.latestSpec(projectId);
      const data = spec.data as SpecData;
      const plan = this.readPlan(data);
      // Persist the scaled feasibility the user saw in Step 4 so the final spec
      // uses the same numbers (previously only unscaled values were stored).
      const scaledFeasibility = this.scaleFeasibility(plan, selectedContributionIds);
      const nextPlan: ExperimentPlan = {
        ...plan,
        confirmed: true,
        selectedContributionIds,
        feasibility: scaledFeasibility,
      };
      const nextSpec = await this.projects.createSpec(projectId, { ...data, experimentPlan: nextPlan });
      await this.invalidate(projectId, nextSpec.id, 'experiment', tx);
      await this.decisions.record(projectId, 'ACCEPT', 'experiment-plan', { selectedContributionIds }, tx);
      return { saved: true };
    });
  }

  /** Scales the stored feasibility by the ratio of selected contributions. */
  private scaleFeasibility(plan: ExperimentPlan, selectedContributionIds: string[]): Record<string, unknown> {
    const feasibility = plan.feasibility;
    const total = plan.contributions.length || 1;
    const ratio = selectedContributionIds.length / total;
    return {
      ...feasibility,
      model_name: String(feasibility.model_name ?? ''),
      seed_prompts_count: Number(feasibility.seed_prompts_count ?? 0),
      rounds: Number(feasibility.rounds ?? 0),
      candidates_count: Number(feasibility.candidates_count ?? 0),
      vram_needed_gb: Number(feasibility.vram_needed_gb ?? 0),
      gpu_time_hours: Number(feasibility.gpu_time_hours ?? 0) * ratio,
      tokens_estimated: Math.round(Number(feasibility.tokens_estimated ?? 0) * ratio),
      is_feasible: Boolean(feasibility.is_feasible ?? false),
      explanation: String(feasibility.explanation ?? ''),
    };
  }

  private readPlan(data: SpecData): ExperimentPlan {
    const plan = data.experimentPlan as ExperimentPlan | undefined;
    return plan ?? EMPTY_PLAN;
  }

  /** Marks the dependency-graph dependents of a node STALE on a spec version. */
  private async invalidate(projectId: string, specIterationId: string, node: WorkflowNode, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    for (const affectedNode of this.dependencyGraph.getAffectedNodes(node)) {
      await client.specArtifact.upsert({
        where: { specIterationId_node: { specIterationId, node: affectedNode } },
        create: { projectId, specIterationId, node: affectedNode, status: 'STALE', data: {} },
        update: { status: 'STALE' },
      });
    }
  }

  private toClaimEvidence(raw: unknown): ClaimEvidence {
    const record = raw as Record<string, unknown>;
    return {
      claim: String(record.claim ?? ''),
      baseline: String(record.baseline ?? ''),
      metric: String(record.metric ?? ''),
      evidence: String(record.evidence ?? ''),
      rejectionCondition: String(record.rejection_condition ?? record.rejectionCondition ?? ''),
    };
  }
}