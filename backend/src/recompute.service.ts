import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ArtifactStatus, Prisma, WorkflowStatus } from '@prisma/client';
import { DependencyGraphService, WorkflowNode } from './dependency-graph.service';
import { JudgeService, JudgeResult } from './judge.service';
import { PrismaService } from './prisma.service';

export type RecomputeResult = {
  specIterationId: string;
  specVersion: number;
  recomputedNodes: string[];
  judgeResults: JudgeResult[];
};

@Injectable()
export class RecomputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly judges: JudgeService,
    private readonly dependencyGraph: DependencyGraphService,
  ) {}

  async recompute(projectId: string, requestedNodes?: string[]): Promise<RecomputeResult> {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      include: { latestSpec: { include: { artifacts: true } } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} was not found`);
    if (!project.latestSpec) throw new NotFoundException(`No latest spec exists for project ${projectId}`);

    const runningRun = await this.prisma.workflowRun.findFirst({
      where: { projectId, status: WorkflowStatus.RUNNING },
    });
    if (runningRun) {
      throw new BadRequestException(`Cannot recompute while workflow run ${runningRun.id} is in progress`);
    }

    const latest = project.latestSpec;
    const staleArtifacts = latest.artifacts.filter((a) => a.status === ArtifactStatus.STALE);
    const staleNodes = staleArtifacts.map((a) => a.node);

    let nodesToRecompute: WorkflowNode[];
    if (requestedNodes && requestedNodes.length > 0) {
      const invalid = requestedNodes.filter((n) => !this.dependencyGraph.isValidNode(n));
      if (invalid.length > 0) {
        throw new BadRequestException(`Invalid workflow nodes: ${invalid.join(', ')}`);
      }
      const requestedSet = new Set<WorkflowNode>();
      for (const node of requestedNodes) {
        if (this.dependencyGraph.isValidNode(node)) {
          requestedSet.add(node);
          for (const affected of this.dependencyGraph.getAffectedNodes(node)) {
            requestedSet.add(affected);
          }
        }
      }
      nodesToRecompute = [...requestedSet];
    } else {
      nodesToRecompute = staleNodes.filter((n): n is WorkflowNode => this.dependencyGraph.isValidNode(n));
    }

    if (nodesToRecompute.length === 0) {
      return { specIterationId: latest.id, specVersion: latest.version, recomputedNodes: [], judgeResults: [] };
    }

    const order = this.dependencyGraph.getDependencyOrder();
    nodesToRecompute.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    const spec = await this.prisma.specIteration.create({
      data: {
        projectId,
        version: latest.version + 1,
        data: latest.data as Prisma.InputJsonValue,
      },
    });
    await this.prisma.researchProject.update({ where: { id: projectId }, data: { latestSpecId: spec.id } });

    const judgeResults: JudgeResult[] = [];
    const nodeToJudgeResult = new Map<string, JudgeResult>();

    const needsPanel = nodesToRecompute.includes('judge');
    if (needsPanel) {
      const panelResult = await this.judges.runPanel(projectId);
      for (const judge of panelResult.judges) {
        judgeResults.push(judge);
        nodeToJudgeResult.set(judge.type, judge);
      }
    }

    for (const node of nodesToRecompute) {
      if (node === 'judge') continue;
      if (!this.isJudgeType(node)) continue;
      if (nodeToJudgeResult.has(node)) continue;
      const result = await this.judges.runJudge(projectId, node);
      judgeResults.push(result);
      nodeToJudgeResult.set(result.type, result);
    }

    for (const node of nodesToRecompute) {
      await this.prisma.specArtifact.upsert({
        where: { specIterationId_node: { specIterationId: spec.id, node } },
        create: {
          projectId,
          specIterationId: spec.id,
          node,
          status: ArtifactStatus.FRESH,
          data: this.buildArtifactData(node, judgeResults),
        },
        update: {
          status: ArtifactStatus.FRESH,
          data: this.buildArtifactData(node, judgeResults),
        },
      });
    }

    return {
      specIterationId: spec.id,
      specVersion: spec.version,
      recomputedNodes: nodesToRecompute,
      judgeResults,
    };
  }

  private isJudgeType(node: string): node is 'gap' | 'contribution' | 'experiment' {
    return ['gap', 'contribution', 'experiment'].includes(node);
  }

  private buildArtifactData(node: string, judgeResults: JudgeResult[]): Prisma.InputJsonValue {
    if (node === 'judge') {
      return { judges: judgeResults } as Prisma.InputJsonValue;
    }
    const result = judgeResults.find((r) => r.type === node);
    return (result?.output ?? {}) as Prisma.InputJsonValue;
  }
}
