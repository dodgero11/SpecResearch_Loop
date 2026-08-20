import { Inject, Injectable } from '@nestjs/common';
import { ContextBuilderService } from './context-builder.service';
import { LlmPort } from './integrations/llm.port';
import { PrismaService } from './prisma.service';

export const LLM_PORT = Symbol('LLM_PORT');

@Injectable()
export class JudgeService {
  constructor(
    private readonly contextBuilder: ContextBuilderService,
    private readonly prisma: PrismaService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
  ) {}

  async runGapJudge(projectId: string, workflowRunId?: string): Promise<Record<string, unknown>> {
    const context = await this.contextBuilder.build('gap-judge', projectId);
    const response = await this.llm.complete('gap-judge', context.inputContext as Record<string, unknown>);
    await this.prisma.llmAuditLog.create({
      data: {
        projectId,
        workflowRunId,
        task: 'gap-judge',
        specVersionUsed: context.specVersion,
        inputContext: context.inputContext,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    });
    return response.output;
  }
}
