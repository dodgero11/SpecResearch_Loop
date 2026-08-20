import { Module } from '@nestjs/common';
import { ContextBuilderService } from './context-builder.service';
import { JudgeService, LLM_PORT } from './judge.service';
import { ProjectService } from './project.service';
import { PrismaService } from './prisma.service';
import { LlmPort } from './integrations/llm.port';
import { WorkflowService } from './workflow.service';
import { ProjectController } from './project.controller';
import { WorkflowController } from './workflow.controller';

const unavailableLlmAdapter: LlmPort = {
  async complete(): Promise<never> {
    throw new Error('No LLM adapter configured');
  },
};

@Module({
  controllers: [ProjectController, WorkflowController],
  providers: [
    PrismaService,
    ProjectService,
    ContextBuilderService,
    WorkflowService,
    JudgeService,
    { provide: LLM_PORT, useValue: unavailableLlmAdapter },
  ],
  exports: [ProjectService, ContextBuilderService, WorkflowService, JudgeService],
})
export class AppModule {}
