import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SpecCardType } from '@prisma/client';
import { DecisionService } from './decision.service';
import { ExperimentPlan } from './experiment.service';
import { AI_GATEWAY, AiGateway, AiGatewayResponse } from './integrations/ai-gateway.port';
import { PdfService } from './pdf.service';
import { PrismaService } from './prisma.service';
import { ProjectService, SpecData } from './project.service';

const FINAL_SPEC_NODE = 'final-spec';

@Injectable()
export class FinalSpecService {
  private readonly logger = new Logger(FinalSpecService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
    private readonly pdf: PdfService,
    @Inject(AI_GATEWAY) private readonly ai: AiGateway,
    private readonly decisions: DecisionService,
  ) {}

  /** Step 6a: generate the final spec via ai_service and persist it as an artifact. */
  async generate(projectId: string) {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      include: { latestSpec: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    if (!project.latestSpec) {
      throw new NotFoundException(`No latest spec exists for project ${projectId}`);
    }
    const spec = project.latestSpec;

    const data = (typeof spec.data === 'object' && spec.data !== null ? spec.data : {}) as SpecData;
    const cards = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id } });
    const problem = cards.find((card) => card.type === SpecCardType.PROBLEM)?.content ?? '';
    const gapAnalysis = (typeof data.gapAnalysis === 'object' && data.gapAnalysis !== null ? data.gapAnalysis : {}) as Record<string, unknown>;
    const gap = String(gapAnalysis.limitation ?? '');
    const plan = (typeof data.experimentPlan === 'object' && data.experimentPlan !== null
      ? data.experimentPlan
      : { contributions: [], experiments: [], feasibility: {} }) as ExperimentPlan;

    const contributionsList = Array.isArray(plan.contributions) ? plan.contributions : [];
    const contribution = contributionsList.map((item) => item?.label || '').filter(Boolean).join('; ');
    const claims = contributionsList.filter((item) => item && item.claimEvidence).map((item) => item.claimEvidence);
    const experiments = Array.isArray(plan.experiments) ? plan.experiments : [];
    const relatedWork = Array.isArray(data.relatedWork) ? data.relatedWork : [];
    const judgesSummary = await this.prisma.judgeIssue.findMany({ where: { projectId, specIterationId: spec.id } });
    const decisions = await this.prisma.decisionLog.findMany({ where: { projectId } });
    const clarification = await this.prisma.clarification.findUnique({ where: { projectId } });

    // "Sau" = the confirmed/selected contribution (fall back to the first one).
    const selectedIds = Array.isArray(plan.selectedContributionIds) ? plan.selectedContributionIds : [];
    const selectedContributions = contributionsList.filter((item) => item && selectedIds.includes(item.id));
    const after = selectedContributions[0]?.label ?? contributionsList[0]?.label ?? '';

    let response: AiGatewayResponse;
    try {
      response = await this.ai.finalSpec({
        project_title: project.title || 'Research Specification',
        problem: problem || clarification?.idea || 'Research Problem',
        gap: gap || 'Research Gap',
        related_work: relatedWork,
        contribution: contribution || after || 'Proposed Contribution',
        claims,
        experiments,
        judges_summary: judgesSummary,
        decision_log: decisions,
      });
    } catch (error) {
      this.logger.error(`[FinalSpecService] AI finalSpec call failed, applying safe synthesis fallback: ${error}`);
      response = {
        output: {
          markdownContent: `# Research Specification: ${project.title || 'Untitled Research'}\n\n## 1. Problem Formulation\n${problem || clarification?.idea || 'Nghiên cứu phương pháp tối ưu hóa.'}\n\n## 2. Research Gap\n${gap || 'Khoảng trống nghiên cứu chưa được giải quyết.'}\n\n## 3. Key Contribution\n${contribution || after || 'Đề xuất phương pháp mới với cơ chế kiểm chứng.'}`,
          specJson: {
            title: project.title || 'Untitled Research',
            problem: problem || clarification?.idea || '',
            gap: gap || '',
            contribution: contribution || after || '',
            claims: claims || [],
            experiments: experiments || [],
          },
          before: clarification?.idea || problem || '',
          after: after || contribution || '',
        }
      };
    }

    const output = (response.output && typeof response.output === 'object' ? response.output : {}) as Record<string, unknown>;
    const markdownContent = String(
      output.markdownContent || output.markdown_content || `# Research Specification: ${project.title || 'Untitled Research'}\n\nGenerated automatically.`
    );
    const rawSpecJson = (output.specJson || output.spec_json || (typeof output === 'object' ? output : {})) as Record<string, unknown>;
    const specJson = JSON.parse(JSON.stringify(rawSpecJson));
    const artifactData = {
      markdownContent,
      markdown_content: markdownContent,
      specJson,
      spec_json: specJson,
    } as Prisma.InputJsonValue;

    try {
      await this.prisma.specArtifact.upsert({
        where: { specIterationId_node: { specIterationId: spec.id, node: FINAL_SPEC_NODE } },
        create: { projectId, specIterationId: spec.id, node: FINAL_SPEC_NODE, status: 'FRESH', data: artifactData },
        update: { status: 'FRESH', data: artifactData },
      });
    } catch (err) {
      this.logger.error(`[FinalSpecService] Failed to upsert specArtifact for project ${projectId}: ${err}`);
    }

    return {
      markdownContent,
      specJson,
      before: String(output.before || clarification?.idea || problem || 'Ý tưởng ban đầu'),
      after: String(output.after || after || contribution || 'Bản đặc tả hoàn thiện'),
    };
  }

  /** Step 5a: synthesize the 6 temporary-spec items the frontend displays. */
  async getTemporary(projectId: string) {
    const spec = await this.projects.latestSpec(projectId);
    const data = (typeof spec.data === 'object' && spec.data !== null ? spec.data : {}) as SpecData;
    const cards = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id } });
    const problem = cards.find((card) => card.type === SpecCardType.PROBLEM)?.content ?? '';
    const gapAnalysis = (typeof data.gapAnalysis === 'object' && data.gapAnalysis !== null ? data.gapAnalysis : {}) as Record<string, unknown>;
    const plan = (typeof data.experimentPlan === 'object' && data.experimentPlan !== null
      ? data.experimentPlan
      : { contributions: [], experiments: [], feasibility: {} }) as ExperimentPlan;

    const contributionsList = Array.isArray(plan.contributions) ? plan.contributions : [];
    return {
      problemStatement: problem,
      researchGap: String(gapAnalysis.limitation ?? ''),
      contributions: contributionsList.map((item) => item?.label || '').filter(Boolean),
      claimEvidenceMatrix: contributionsList.filter((item) => item && item.claimEvidence).map((item) => item.claimEvidence),
      experimentalProtocol: Array.isArray(plan.experiments) ? plan.experiments : [],
      computeBudget: plan.feasibility ?? {},
    };
  }

  /** Step 5c: mark the spec as finalized. */
  async finalize(projectId: string) {
    return this.prisma.$transaction(async (tx) => {
      const spec = await this.projects.latestSpec(projectId);
      const data = (typeof spec.data === 'object' && spec.data !== null ? spec.data : {}) as SpecData;
      await this.projects.createSpec(projectId, { ...data, finalized: true });
      await this.decisions.record(projectId, 'ACCEPT', 'finalize', {}, tx);
      return { saved: true };
    });
  }

  /** Step 6b: confirm the final spec. */
  async confirm(projectId: string) {
    return this.prisma.$transaction(async (tx) => {
      const spec = await this.projects.latestSpec(projectId);
      const data = (typeof spec.data === 'object' && spec.data !== null ? spec.data : {}) as SpecData;
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
    if (!artifact) {
      throw new NotFoundException('Final spec has not been generated yet');
    }
    const data = (artifact.data && typeof artifact.data === 'object' ? artifact.data : {}) as { markdownContent?: string; markdown_content?: string };
    const content = data.markdownContent || data.markdown_content || '# Research Specification';
    return this.pdf.render(content);
  }
}