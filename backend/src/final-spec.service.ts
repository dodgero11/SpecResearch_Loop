import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SpecCardType } from '@prisma/client';
import { DecisionService } from './decision.service';
import { ExperimentPlan } from './experiment.service';
import { AI_GATEWAY, AiGateway } from './integrations/ai-gateway.port';
import { PdfService } from './pdf.service';
import { PrismaService } from './prisma.service';
import { ProjectService, SpecData } from './project.service';

const FINAL_SPEC_NODE = 'final-spec';

@Injectable()
export class FinalSpecService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
    private readonly pdf: PdfService,
    @Inject(AI_GATEWAY) private readonly ai: AiGateway,
    private readonly decisions: DecisionService,
  ) {}

  /** Step 6a: generate the final spec via ai_service and persist it as an artifact. */
  async generate(projectId: string) {
    const project = await this.prisma.researchProject.findUnique({ where: { id: projectId }, include: { latestSpec: true } });
    if (!project?.latestSpec) throw new NotFoundException(`No latest spec exists for project ${projectId}`);
    const spec = project.latestSpec;
    const data = spec.data as SpecData;
    const cards = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id } });
    const problem = cards.find((card) => card.type === SpecCardType.PROBLEM)?.content ?? '';
    const gapAnalysis = (data.gapAnalysis ?? {}) as Record<string, unknown>;
    const gap = String(gapAnalysis.limitation ?? '');
    const plan = (data.experimentPlan ?? { contributions: [], experiments: [], feasibility: {} }) as ExperimentPlan;
    const contribution = plan.contributions.map((item) => item.label).join('; ');
    const claims = plan.contributions.filter((item) => item.claimEvidence).map((item) => item.claimEvidence);
    const experiments = plan.experiments;
    const relatedWork = Array.isArray(data.relatedWork) ? data.relatedWork : [];
    const judgesSummary = await this.prisma.judgeIssue.findMany({ where: { projectId, specIterationId: spec.id } });
    const decisions = await this.prisma.decisionLog.findMany({ where: { projectId } });
    const clarification = await this.prisma.clarification.findUnique({ where: { projectId } });
    // "Sau" = the confirmed/selected contribution (fall back to the first one).
    const selectedIds = plan.selectedContributionIds ?? [];
    const selectedContributions = plan.contributions.filter((item) => selectedIds.includes(item.id));
    const after = selectedContributions[0]?.label ?? plan.contributions[0]?.label ?? '';

    const response = await this.ai.finalSpec({
      project_title: project.title,
      problem,
      gap,
      related_work: relatedWork,
      contribution,
      claims,
      experiments,
      judges_summary: judgesSummary,
      decision_log: decisions,
    });
    const output = response.output ?? {};
    const markdownContent = String(output.markdownContent ?? output.markdown_content ?? '# Research Specification');
    const specJson = (output.specJson ?? output.spec_json ?? {}) as Record<string, unknown>;
    const artifactData = { markdownContent, specJson } as Prisma.InputJsonValue;

    try {
      await this.prisma.specArtifact.upsert({
        where: { specIterationId_node: { specIterationId: spec.id, node: FINAL_SPEC_NODE } },
        create: { projectId, specIterationId: spec.id, node: FINAL_SPEC_NODE, status: 'FRESH', data: artifactData },
        update: { status: 'FRESH', data: artifactData },
      });
    } catch (err) {
      console.error(`[FinalSpecService] Failed to upsert specArtifact for project ${projectId}:`, err);
      throw err;
    }

    return {
      markdownContent,
      specJson,
      before: String(output.before || clarification?.idea || ''),
      after: String(output.after || after || ''),
    };
  }

  /** Step 5a: synthesize the 6 temporary-spec items the frontend displays. */
  async getTemporary(projectId: string) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const cards = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id } });
    const problem = cards.find((card) => card.type === SpecCardType.PROBLEM)?.content ?? '';
    const gapAnalysis = (data.gapAnalysis ?? {}) as Record<string, unknown>;
    const plan = (data.experimentPlan ?? { contributions: [], experiments: [], feasibility: {} }) as ExperimentPlan;
    return {
      problemStatement: problem,
      researchGap: String(gapAnalysis.limitation ?? ''),
      contributions: plan.contributions.map((item) => item.label),
      claimEvidenceMatrix: plan.contributions.filter((item) => item.claimEvidence).map((item) => item.claimEvidence),
      experimentalProtocol: plan.experiments,
      computeBudget: plan.feasibility,
    };
  }

  /** Step 5c: mark the spec as finalized. */
  async finalize(projectId: string) {
    return this.prisma.$transaction(async (tx) => {
      const spec = await this.projects.latestSpec(projectId);
      const data = spec.data as SpecData;
      await this.projects.createSpec(projectId, { ...data, finalized: true });
      await this.decisions.record(projectId, 'ACCEPT', 'finalize', {}, tx);
      return { saved: true };
    });
  }

  /** Step 6b: confirm the final spec. */
  async confirm(projectId: string) {
    return this.prisma.$transaction(async (tx) => {
      const spec = await this.projects.latestSpec(projectId);
      const data = spec.data as SpecData;
      await this.projects.createSpec(projectId, { ...data, finalConfirmed: true });
      await this.decisions.record(projectId, 'ACCEPT', 'final-spec:confirm', {}, tx);
      return { saved: true };
    });
  }

  /** Step 6c: export the saved markdown as a PDF. */
  async exportPdf(projectId: string): Promise<Buffer> {
    const spec = await this.projects.latestSpec(projectId);
    const artifact = await this.prisma.specArtifact.findUnique({
      where: { specIterationId_node: { specIterationId: spec.id, node: FINAL_SPEC_NODE } },
    });
    if (!artifact) throw new NotFoundException('Final spec has not been generated yet');
    const data = artifact.data as { markdownContent?: string };
    return this.pdf.render(data.markdownContent ?? '');
  }
}