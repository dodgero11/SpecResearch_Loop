import { Module } from '@nestjs/common';
import { ContextBuilderService } from './context-builder.service';
import { DependencyGraphService } from './dependency-graph.service';
import { JudgeService, LLM_PORT } from './judge.service';
import { ProjectService } from './project.service';
import { PrismaService } from './prisma.service';
import { RecomputeService } from './recompute.service';
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
import { SpecCardController } from './spec-card.controller';
import { SpecCardService } from './spec-card.service';
import { createLlmAdapter } from './integrations/http-llm.adapter';
import { LocalNliAdapter, LocalRerankAdapter, LocalSearchAdapter } from './integrations/local.adapters';

const localSearchAdapter: SearchPort = new LocalSearchAdapter();
const localRerankAdapter: RerankPort = new LocalRerankAdapter();
const localNliAdapter: NliPort = new LocalNliAdapter();

@Module({
  controllers: [ProjectController, WorkflowController, HealthController, DecisionController, ConfirmationController, JudgeController, VerificationController, SpecCardController],
  providers: [
    PrismaService,
    ProjectService,
    DependencyGraphService,
    ContextBuilderService,
    WorkflowService,
    JudgeService,
    VerificationService,
    DecisionService,
    ConfirmationService,
    SpecCardService,
    RecomputeService,
    { provide: LLM_PORT, useFactory: () => createLlmAdapter(process.env) },
    { provide: SEARCH_PORT, useValue: localSearchAdapter },
    { provide: RERANK_PORT, useValue: localRerankAdapter },
    { provide: NLI_PORT, useValue: localNliAdapter },
  ],
  exports: [ProjectService, ContextBuilderService, WorkflowService, JudgeService, VerificationService, DecisionService, ConfirmationService, SpecCardService, RecomputeService],
})
export class AppModule {}
