import { Module } from '@nestjs/common';
import { ContextBuilderService } from './context-builder.service';
import { DependencyGraphService } from './dependency-graph.service';
import { JudgeService, LLM_PORT } from './judge.service';
import { ProjectService } from './project.service';
import { PrismaService } from './prisma.service';
import { RecomputeService } from './recompute.service';
import { WorkflowService } from './workflow.service';
import { DecisionService } from './decision.service';
import { ClarifyService } from './clarify.service';
import { DecomposeService } from './decompose.service';
import { ResearchService } from './research.service';
import { ExperimentService } from './experiment.service';
import { IssueService } from './issue.service';
import { FinalSpecService } from './final-spec.service';
import { PdfService } from './pdf.service';
import { ProjectController } from './project.controller';
import { WorkflowController } from './workflow.controller';
import { HealthController } from './health.controller';
import { DecisionController } from './decision.controller';
import { ClarifyController } from './clarify.controller';
import { DecomposeController } from './decompose.controller';
import { ResearchController } from './research.controller';
import { ExperimentController } from './experiment.controller';
import { IssueController } from './issue.controller';
import { FinalSpecController } from './final-spec.controller';
import { JudgeController } from './judge.controller';
import { SpecCardController } from './spec-card.controller';
import { SpecCardService } from './spec-card.service';
import { createLlmAdapter } from './integrations/http-llm.adapter';
import { createAiGateway } from './integrations/http-ai-gateway.adapter';
import { AI_GATEWAY } from './integrations/ai-gateway.port';

@Module({
  controllers: [ProjectController, WorkflowController, HealthController, DecisionController, ClarifyController, DecomposeController, ResearchController, ExperimentController, IssueController, FinalSpecController, JudgeController, SpecCardController],
  providers: [
    PrismaService,
    ProjectService,
    DependencyGraphService,
    ContextBuilderService,
    WorkflowService,
    JudgeService,
    DecisionService,
    ClarifyService,
    DecomposeService,
    ResearchService,
    ExperimentService,
    IssueService,
    FinalSpecService,
    PdfService,
    SpecCardService,
    RecomputeService,
    { provide: LLM_PORT, useFactory: () => createLlmAdapter(process.env) },
    { provide: AI_GATEWAY, useFactory: () => createAiGateway(process.env) },
  ],
  exports: [ProjectService, ContextBuilderService, WorkflowService, JudgeService, DecisionService, SpecCardService, RecomputeService],
})
export class AppModule {}
