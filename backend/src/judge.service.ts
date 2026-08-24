import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ContextBuilderService } from './context-builder.service';
import { LlmPort } from './integrations/llm.port';
import { PrismaService } from './prisma.service';

export const LLM_PORT = Symbol('LLM_PORT');

export const JUDGE_TYPES = ['gap', 'contribution', 'experiment', 'evidence', 'conference-readiness'] as const;
export type JudgeType = typeof JUDGE_TYPES[number];
export type JudgeTask = `${JudgeType}-judge`;
export type JudgeResult = {
  type: JudgeType;
  status: 'COMPLETED' | 'FAILED';
  specVersionUsed: number;
  output?: Record<string, unknown>;
  error?: string;
};
export type JudgePanelResult = {
  projectId: string;
  specVersionUsed: number;
  status: 'COMPLETED' | 'PARTIAL_FAILURE';
  judges: JudgeResult[];
};

@Injectable()
export class JudgeService {
  constructor(
    private readonly contextBuilder: ContextBuilderService,
    private readonly prisma: PrismaService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
  ) {}

  async runJudge(projectId: string, type: JudgeType, workflowRunId?: string): Promise<JudgeResult> {
    const task = `${type}-judge` as JudgeTask;
    const context = await this.contextBuilder.build(task, projectId);
    try {
      const response = await this.llm.complete(task, context.inputContext as Record<string, unknown>);
      await this.audit(projectId, workflowRunId, task, context.specVersion, context.inputContext, response.inputTokens, response.outputTokens);
      return { type, status: 'COMPLETED', specVersionUsed: context.specVersion, output: response.output };
    } catch (error) {
      return { type, status: 'FAILED', specVersionUsed: context.specVersion, error: this.errorMessage(error) };
    }
  }

  async runGapJudge(projectId: string, workflowRunId?: string): Promise<Record<string, unknown>> {
    const result = await this.runJudge(projectId, 'gap', workflowRunId);
    if (result.status === 'FAILED') throw new Error(result.error);
    return result.output ?? {};
  }

  async runPanel(projectId: string, workflowRunId?: string): Promise<JudgePanelResult> {
    const results = await Promise.all(JUDGE_TYPES.map((type) => this.runJudge(projectId, type, workflowRunId)));
    const versions = new Set(results.map((result) => result.specVersionUsed));
    const failed = results.some((result) => result.status === 'FAILED');
    return {
      projectId,
      specVersionUsed: results[0]?.specVersionUsed ?? 0,
      status: failed || versions.size > 1 ? 'PARTIAL_FAILURE' : 'COMPLETED',
      judges: results,
    };
  }

  private async audit(projectId: string, workflowRunId: string | undefined, task: string, specVersionUsed: number, inputContext: unknown, inputTokens?: number, outputTokens?: number): Promise<void> {
    await this.prisma.llmAuditLog.create({
      data: {
        projectId,
        workflowRunId,
        task,
        specVersionUsed,
        inputContext: inputContext as Prisma.InputJsonValue,
        inputTokens,
        outputTokens,
      },
    });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Judge execution failed';
  }
}
