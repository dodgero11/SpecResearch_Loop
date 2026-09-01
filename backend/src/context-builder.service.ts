import { Injectable } from '@nestjs/common';
import { Prisma, SpecCardType } from '@prisma/client';
import { ExperimentPlan } from './experiment.service';
import { PrismaService } from './prisma.service';
import { ProjectService, SpecData } from './project.service';

export type ContextTask = 'gap-judge' | 'contribution-judge' | 'experiment-judge' | 'evidence-judge' | 'conference-readiness-judge';
export type BuiltContext = { specVersion: number; inputContext: Prisma.InputJsonObject };

@Injectable()
export class ContextBuilderService {
  constructor(
    private readonly projects: ProjectService,
    private readonly prisma: PrismaService,
  ) {}

  async build(task: ContextTask, projectId: string): Promise<BuiltContext> {
    const { specVersion, context } = await this.buildContext(projectId);
    const fieldsByTask: Record<ContextTask, string[]> = {
      'gap-judge': ['problem', 'gap', 'relatedWork'],
      'contribution-judge': ['problem', 'gap', 'contribution', 'relatedWork'],
      'experiment-judge': ['claims', 'experiments'],
      'evidence-judge': ['claims', 'evidence', 'relatedWork'],
      'conference-readiness-judge': ['problem', 'gap', 'contribution', 'claims', 'evidence', 'experiments', 'relatedWork'],
    };
    const inputContext = fieldsByTask[task].reduce<Record<string, Prisma.InputJsonValue>>((acc, field) => {
      if (context[field] !== undefined) acc[field] = context[field];
      return acc;
    }, {});
    return { specVersion, inputContext: inputContext as Prisma.InputJsonObject };
  }

  /**
   * Merged context for a single panel execution: the union of every judge's
   * allowlisted fields, so one remote panel call receives the full spec.
   */
  async buildPanel(projectId: string): Promise<BuiltContext> {
    const { specVersion, context } = await this.buildContext(projectId);
    const panelFields = ['problem', 'gap', 'contribution', 'claims', 'evidence', 'experiments', 'relatedWork'];
    const inputContext = panelFields.reduce<Record<string, Prisma.InputJsonValue>>((acc, field) => {
      if (context[field] !== undefined) acc[field] = context[field];
      return acc;
    }, {});
    return { specVersion, inputContext: inputContext as Prisma.InputJsonObject };
  }

  /**
   * Builds the judge context from the actual step-flow data: the PROBLEM card,
   * `gapAnalysis.limitation`, `experimentPlan` contributions/claims/experiments,
   * EVIDENCE cards, and `relatedWork`. This mirrors what `spec/temporary` and
   * `final-spec` already read — previously the judges evaluated an empty spec
   * because the top-level `data.problem/gap/claims/...` keys are never written.
   */
  private async buildContext(projectId: string): Promise<{ specVersion: number; context: Record<string, Prisma.InputJsonValue> }> {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const cards = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id } });
    const problem = cards.find((card) => card.type === SpecCardType.PROBLEM)?.content ?? '';
    const gapAnalysis = (data.gapAnalysis ?? {}) as Record<string, unknown>;
    const gap = String(gapAnalysis.limitation ?? '');
    const plan = (data.experimentPlan ?? { contributions: [], experiments: [], feasibility: {} }) as ExperimentPlan;
    const contribution = plan.contributions.map((item) => item.label).join('; ');
    const claims = plan.contributions.filter((item) => item.claimEvidence).map((item) => item.claimEvidence);
    const experiments = plan.experiments;
    const evidence = cards.filter((card) => card.type === SpecCardType.EVIDENCE).map((card) => card.content);
    const relatedWork = Array.isArray(data.relatedWork) ? data.relatedWork : [];
    const context: Record<string, Prisma.InputJsonValue> = {
      problem,
      gap,
      contribution,
      claims: claims as Prisma.InputJsonValue,
      experiments: experiments as Prisma.InputJsonValue,
      evidence: evidence as Prisma.InputJsonValue,
      relatedWork: relatedWork as Prisma.InputJsonValue,
    };
    return { specVersion: spec.version, context };
  }
}
