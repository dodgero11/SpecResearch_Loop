import { Module } from '@nestjs/common';
import { ContextBuilderService } from './context-builder.service';
import { JudgeService, LLM_PORT } from './judge.service';
import { ProjectService } from './project.service';
import { PrismaService } from './prisma.service';
import { LlmPort } from './integrations/llm.port';
import { WorkflowService } from './workflow.service';
import { VerificationService, SEARCH_PORT, RERANK_PORT, NLI_PORT, SearchPort, RerankPort, NliPort } from './verification.service';
import { DecisionService } from './decision.service';
import { ConfirmationService } from './confirmation.service';
import { ProjectController } from './project.controller';
import { WorkflowController } from './workflow.controller';
import { HealthController } from './health.controller';
import { DecisionController } from './decision.controller';
import { ConfirmationController } from './confirmation.controller';
import { JudgeController } from './judge.controller';
import { VerificationController } from './verification.controller';
import { LocalLlmAdapter, LocalNliAdapter, LocalRerankAdapter, LocalSearchAdapter } from './integrations/local.adapters';

const localLlmAdapter: LlmPort = new LocalLlmAdapter();
const localSearchAdapter: SearchPort = new LocalSearchAdapter();
const localRerankAdapter: RerankPort = new LocalRerankAdapter();
const localNliAdapter: NliPort = new LocalNliAdapter();

@Module({
  controllers: [ProjectController, WorkflowController, HealthController, DecisionController, ConfirmationController, JudgeController, VerificationController],
  providers: [
    PrismaService,
    ProjectService,
    ContextBuilderService,
    WorkflowService,
    JudgeService,
    VerificationService,
    DecisionService,
    ConfirmationService,
    { provide: LLM_PORT, useValue: localLlmAdapter },
    { provide: SEARCH_PORT, useValue: localSearchAdapter },
    { provide: RERANK_PORT, useValue: localRerankAdapter },
    { provide: NLI_PORT, useValue: localNliAdapter },
  ],
  exports: [ProjectService, ContextBuilderService, WorkflowService, JudgeService, VerificationService, DecisionService, ConfirmationService],
})
export class AppModule {}
