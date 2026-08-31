import { Injectable, NotFoundException } from '@nestjs/common';
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
    const updatedIssue = await this.prisma.judgeIssue.update({
      where: { id: issueId },
      data: { status: 'RESOLVED', resolvedChoice: choice, customResolution: customChoice },
    });
    const judgeType = issue.judgeType as JudgeType;
    const invalidatedNodes = this.dependencyGraph.getAffectedNodes(JUDGE_NODE[judgeType]);
    // Mark affected nodes STALE so downstream artifacts are flagged for review.
    const spec = await this.projects.latestSpec(projectId);
    for (const node of invalidatedNodes) {
      await this.prisma.specArtifact.upsert({
        where: { specIterationId_node: { specIterationId: spec.id, node } },
        create: { projectId, specIterationId: spec.id, node, status: 'STALE', data: {} },
        update: { status: 'STALE' },
      });
    }
    const judgeResult = await this.judges.runJudge(projectId, judgeType);
    return { updatedIssue, invalidatedNodes, judgeResult };
  }
}