import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SpecCardType } from '@prisma/client';
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
    @Inject(AI_GATEWAY) private readonly ai: AiGateway,
  ) {}

  /** Step 4a: generate the initial plan (contributions + claims + experiments + feasibility). */
  async generatePlan(projectId: string) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const cards = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id } });
    const problem = cards.find((card) => card.type === SpecCardType.PROBLEM)?.content ?? '';
    const gap = cards.find((card) => card.type === SpecCardType.GAP_CANDIDATE)?.content ?? '';
    const gapAnalysis = (data.gapAnalysis ?? {}) as { directions?: { letter: string; selected?: boolean }[] };
    const direction = gapAnalysis.directions?.find((item) => item.selected)?.letter;
    const response = await this.ai.specExperiment(problem, gap, direction);
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
    await this.projects.createSpec(projectId, { ...data, experimentPlan: plan });
    return plan;
  }

  /** Step 4b: add a manual contribution (no experiment generated). */
  async addContribution(projectId: string, label: string) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const plan = this.readPlan(data);
    const contribution: ContributionItem = { id: `contrib-${Date.now()}`, label, claimEvidence: null };
    const nextPlan = { ...plan, contributions: [...plan.contributions, contribution] };
    await this.projects.createSpec(projectId, { ...data, experimentPlan: nextPlan });
    return { contribution };
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
    await this.projects.createSpec(projectId, { ...data, experimentPlan: nextPlan });
    return { claimEvidence, experiment, needsReview };
  }

  /** Step 4d: recompute feasibility for the selected contributions. */
  async feasibility(projectId: string, selectedContributionIds: string[]) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const plan = this.readPlan(data);
    const feasibility = plan.feasibility;
    const total = plan.contributions.length || 1;
    const ratio = selectedContributionIds.length / total;
    return {
      model: String(feasibility.model_name ?? ''),
      seedPrompts: Number(feasibility.seed_prompts_count ?? 0),
      rounds: Number(feasibility.rounds ?? 0),
      candidates: Number(feasibility.candidates_count ?? 0),
      vram: Number(feasibility.vram_needed_gb ?? 0),
      hours: Number(feasibility.gpu_time_hours ?? 0) * ratio,
      tokens: Math.round(Number(feasibility.tokens_estimated ?? 0) * ratio),
      isFeasible: Boolean(feasibility.is_feasible ?? false),
      explanation: String(feasibility.explanation ?? ''),
    };
  }

  /** Step 4e: confirm the plan with the selected contributions. */
  async confirm(projectId: string, selectedContributionIds: string[]) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const plan = this.readPlan(data);
    const nextPlan: ExperimentPlan = { ...plan, confirmed: true, selectedContributionIds };
    await this.projects.createSpec(projectId, { ...data, experimentPlan: nextPlan });
    return { saved: true };
  }

  private readPlan(data: SpecData): ExperimentPlan {
    const plan = data.experimentPlan as ExperimentPlan | undefined;
    return plan ?? EMPTY_PLAN;
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