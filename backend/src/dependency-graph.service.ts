import { Injectable } from '@nestjs/common';
import { SpecCardType } from '@prisma/client';

export const WORKFLOW_NODES = [
  'problem',
  'related_work',
  'gap',
  'contribution',
  'claim',
  'experiment',
  'judge',
] as const;

export type WorkflowNode = typeof WORKFLOW_NODES[number];

const DEPENDENCY_EDGES: Record<WorkflowNode, WorkflowNode[]> = {
  problem: ['gap', 'judge'],
  related_work: ['gap'],
  gap: ['contribution', 'judge'],
  contribution: ['claim', 'judge'],
  claim: ['experiment', 'judge'],
  experiment: ['judge'],
  judge: [],
};

const CARD_TYPE_TO_NODE: Record<SpecCardType, WorkflowNode | null> = {
  PROBLEM: 'problem',
  RESEARCH_QUESTION: 'problem',
  GAP_CANDIDATE: 'gap',
  CONTRIBUTION: 'contribution',
  CLAIM: 'claim',
  EVIDENCE: 'claim',
  CONSTRAINT: 'experiment',
  OPEN_QUESTION: 'gap',
};

@Injectable()
export class DependencyGraphService {
  private readonly edges = DEPENDENCY_EDGES;

  getAllNodes(): readonly WorkflowNode[] {
    return WORKFLOW_NODES;
  }

  getDependents(node: WorkflowNode): WorkflowNode[] {
    return [...(this.edges[node] ?? [])];
  }

  getAffectedNodes(node: WorkflowNode): WorkflowNode[] {
    const affected = new Set<WorkflowNode>();
    const queue: WorkflowNode[] = this.getDependents(node);
    for (const dependent of queue) {
      if (!affected.has(dependent)) {
        affected.add(dependent);
        for (const next of this.getDependents(dependent)) {
          if (!affected.has(next)) {
            queue.push(next);
          }
        }
      }
    }
    return [...affected];
  }

  getDependencyOrder(): WorkflowNode[] {
    const inDegree = new Map<WorkflowNode, number>();
    for (const node of WORKFLOW_NODES) {
      inDegree.set(node, 0);
    }
    for (const node of WORKFLOW_NODES) {
      for (const dependent of this.getDependents(node)) {
        inDegree.set(dependent, (inDegree.get(dependent) ?? 0) + 1);
      }
    }
    const queue = WORKFLOW_NODES.filter((node) => (inDegree.get(node) ?? 0) === 0);
    const order: WorkflowNode[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      for (const dependent of this.getDependents(current)) {
        const newDegree = (inDegree.get(dependent) ?? 0) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }
    return order;
  }

  getNodeForCardType(type: SpecCardType): WorkflowNode | null {
    return CARD_TYPE_TO_NODE[type] ?? null;
  }

  isValidNode(node: string): node is WorkflowNode {
    return WORKFLOW_NODES.includes(node as WorkflowNode);
  }
}
