import { Injectable, NotFoundException } from '@nestjs/common';
import { DecisionService } from './decision.service';
import { DependencyGraphService, WorkflowNode } from './dependency-graph.service';
import { JudgeService, JudgeType } from './judge.service';
import { PrismaService } from './prisma.service';
import { ProjectService } from './project.service';

/** Maps a judge type to the dependency-graph node it evaluates. */
const JUDGE_NODE: Record<JudgeType, WorkflowNode> = {
  gap: 'gap',
  contribution: 'contribution',
  experiment: 'experiment',
  evidence: 'claim',
  'conference-readiness': 'judge',
};

@Injectable()
export class IssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
    private readonly judges: JudgeService,
    private readonly decisions: DecisionService,
    private readonly dependencyGraph: DependencyGraphService,
  ) {}

  /** Lists persisted judge issues for the latest spec version. */
  async list(projectId: string) {
    const spec = await this.projects.latestSpec(projectId);
    return this.prisma.judgeIssue.findMany({
      where: { projectId, specIterationId: spec.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Resolves an issue: records the choice, re-runs the flagging judge to confirm. */
  async resolve(projectId: string, issueId: string, choice: string, customChoice?: string) {
    const issue = await this.prisma.judgeIssue.findFirst({ where: { id: issueId, projectId } });
    if (!issue) throw new NotFoundException(`Issue ${issueId} was not found`);
    const judgeType = issue.judgeType as JudgeType;
    const invalidatedNodes = this.dependencyGraph.getAffectedNodes(JUDGE_NODE[judgeType]);
    const spec = await this.projects.latestSpec(projectId);
    // DB writes (update issue + upsert STALE artifacts + record decision) are
    // atomic. The judge re-run is an external AI call and runs after commit.
    const updatedIssue = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.judgeIssue.update({
        where: { id: issueId },
        data: { status: 'RESOLVED', resolvedChoice: choice, customResolution: customChoice },
      });
      for (const node of invalidatedNodes) {
        await tx.specArtifact.upsert({
          where: { specIterationId_node: { specIterationId: spec.id, node } },
          create: { projectId, specIterationId: spec.id, node, status: 'STALE', data: {} },
          update: { status: 'STALE' },
        });
      }
      await this.decisions.record(projectId, 'ACCEPT', `issue:${issueId}`, { choice, customChoice }, tx);
      return updated;
    });
    // If the judge fails, the issue is still resolved (the user already chose).
    const judgeResult = await this.judges.runJudge(projectId, judgeType);
    return { updatedIssue, invalidatedNodes, judgeResult };
  }
}