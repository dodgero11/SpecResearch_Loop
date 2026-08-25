import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SpecIteration } from '@prisma/client';
import { DependencyGraphService } from './dependency-graph.service';
import { PrismaService } from './prisma.service';

export type SpecData = Record<string, unknown>;

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dependencyGraph: DependencyGraphService,
  ) {}

  async create(title: string): Promise<{ id: string; title: string }> {
    return this.prisma.researchProject.create({ data: { title }, select: { id: true, title: true } });
  }

  async latestSpec(projectId: string): Promise<SpecIteration> {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      include: { latestSpec: true },
    });
    if (!project?.latestSpec) {
      throw new NotFoundException(`No latest spec exists for project ${projectId}`);
    }
    return project.latestSpec;
  }

  async history(projectId: string) {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, specs: { orderBy: { version: 'asc' } } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} was not found`);
    return { project: { id: project.id, title: project.title }, specs: project.specs.map((spec) => ({ id: spec.id, version: spec.version, data: spec.data, createdAt: spec.createdAt.toISOString() })) };
  }

  async summary(projectId: string) {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      include: {
        latestSpec: { include: { cards: { orderBy: { createdAt: 'asc' } } } },
        cardLinks: { orderBy: { createdAt: 'asc' } },
        decisions: { orderBy: { createdAt: 'asc' } },
        runs: { orderBy: { updatedAt: 'desc' }, take: 10 },
      },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} was not found`);
    const confirmations = await this.prisma.confirmationQuestion.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    return {
      project: { id: project.id, title: project.title },
      latestSpec: project.latestSpec ? { id: project.latestSpec.id, version: project.latestSpec.version, data: project.latestSpec.data, createdAt: project.latestSpec.createdAt.toISOString() } : null,
      cards: project.latestSpec?.cards ?? [],
      links: project.latestSpec ? project.cardLinks.filter((link) => link.specIterationId === project.latestSpec?.id) : [],
      decisions: project.decisions,
      confirmations,
      workflows: project.runs,
    };
  }

  async createSpec(projectId: string, data: SpecData, idempotencyKey?: string): Promise<SpecIteration> {
    return this.prisma.$transaction(async (transaction) => {
      if (idempotencyKey) {
        const previous = await transaction.idempotencyRecord.findUnique({ where: { projectId_key: { projectId, key: idempotencyKey } } });
        if (previous) return previous.result as unknown as SpecIteration;
      }
      const project = await transaction.researchProject.findUnique({
        where: { id: projectId },
        include: { latestSpec: true },
      });
      if (!project) throw new NotFoundException(`Project ${projectId} was not found`);
      const version = (project.latestSpec?.version ?? 0) + 1;
      const spec = await transaction.specIteration.create({
        data: { projectId, version, data: data as Prisma.InputJsonValue },
      });
      await transaction.researchProject.update({ where: { id: projectId }, data: { latestSpecId: spec.id } });
      if (idempotencyKey) {
        await transaction.idempotencyRecord.create({ data: { projectId, key: idempotencyKey, operation: 'create-spec', result: spec as unknown as Prisma.InputJsonValue } });
      }
      return spec;
    });
  }

  async updateNode(projectId: string, node: string, value: unknown, idempotencyKey?: string): Promise<SpecIteration> {
    return this.prisma.$transaction(async (transaction) => {
      if (idempotencyKey) {
        const previous = await transaction.idempotencyRecord.findUnique({ where: { projectId_key: { projectId, key: idempotencyKey } } });
        if (previous) return previous.result as unknown as SpecIteration;
      }
      const project = await transaction.researchProject.findUnique({ where: { id: projectId }, include: { latestSpec: true } });
      if (!project?.latestSpec) throw new NotFoundException(`No latest spec exists for project ${projectId}`);
      const current = project.latestSpec;
      const currentData = current.data as SpecData;
      const dataKey = this.dataKeyForNode(node);
      const nextData = { ...currentData, [dataKey]: value };
      const spec = await transaction.specIteration.create({
        data: { projectId, version: current.version + 1, data: nextData as Prisma.InputJsonValue },
      });
      await transaction.researchProject.update({ where: { id: projectId }, data: { latestSpecId: spec.id } });
      if (this.dependencyGraph.isValidNode(node)) {
        const affectedNodes = this.dependencyGraph.getAffectedNodes(node);
        for (const affectedNode of affectedNodes) {
          await transaction.specArtifact.create({ data: { projectId, specIterationId: spec.id, node: affectedNode, status: 'STALE', data: {} } });
        }
      }
      if (idempotencyKey) {
        await transaction.idempotencyRecord.create({ data: { projectId, key: idempotencyKey, operation: `update-node:${node}`, result: spec as unknown as Prisma.InputJsonValue } });
      }
      return spec;
    });
  }

  async addRelatedWork(projectId: string, input: { title: string; sourceUrl?: string }, idempotencyKey?: string): Promise<SpecIteration> {
    return this.prisma.$transaction(async (transaction) => {
      if (idempotencyKey) {
        const previous = await transaction.idempotencyRecord.findUnique({ where: { projectId_key: { projectId, key: idempotencyKey } } });
        if (previous) return previous.result as unknown as SpecIteration;
      }
      const project = await transaction.researchProject.findUnique({ where: { id: projectId }, include: { latestSpec: true } });
      if (!project?.latestSpec) throw new NotFoundException(`No latest spec exists for project ${projectId}`);
      const current = project.latestSpec;
      const currentData = current.data as SpecData;
      const existing = this.asRelatedWorkArray(currentData.relatedWork);
      const item = this.toRelatedWorkItem(input);
      const isDuplicate = existing.some((entry) => this.sameRelatedWork(entry, item));
      if (isDuplicate) {
        return current;
      }
      const nextData = { ...currentData, relatedWork: [...existing, item] };
      const spec = await transaction.specIteration.create({
        data: { projectId, version: current.version + 1, data: nextData as Prisma.InputJsonValue },
      });
      await transaction.researchProject.update({ where: { id: projectId }, data: { latestSpecId: spec.id } });
      const affectedNodes = this.dependencyGraph.getAffectedNodes('related_work');
      for (const affectedNode of affectedNodes) {
        await transaction.specArtifact.create({ data: { projectId, specIterationId: spec.id, node: affectedNode, status: 'STALE', data: {} } });
      }
      if (idempotencyKey) {
        await transaction.idempotencyRecord.create({ data: { projectId, key: idempotencyKey, operation: 'add-related-work', result: spec as unknown as Prisma.InputJsonValue } });
      }
      return spec;
    });
  }

  /** Maps a dependency-graph node name to the spec `data` key it is stored under. */
  private dataKeyForNode(node: string): string {
    return node === 'related_work' ? 'relatedWork' : node;
  }

  private asRelatedWorkArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  }

  private toRelatedWorkItem(input: { title: string; sourceUrl?: string }): Record<string, unknown> {
    return {
      paper_title: input.title,
      authors: '',
      year: 0,
      what_they_did: '',
      feedback: '',
      missing_points: '',
      source_url: input.sourceUrl ?? '',
    };
  }

  private sameRelatedWork(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
    const leftUrl = String(left.source_url ?? '').trim();
    const rightUrl = String(right.source_url ?? '').trim();
    if (leftUrl && rightUrl) return leftUrl === rightUrl;
    return String(left.paper_title ?? '').trim().toLowerCase() === String(right.paper_title ?? '').trim().toLowerCase();
  }

  async getInvalidations(projectId: string) {
    const project = await this.prisma.researchProject.findUnique({
      where: { id: projectId },
      include: { latestSpec: { include: { artifacts: true } } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} was not found`);
    if (!project.latestSpec) throw new NotFoundException(`No latest spec exists for project ${projectId}`);
    const staleArtifacts = project.latestSpec.artifacts.filter((a) => a.status === 'STALE');
    const staleNodes = staleArtifacts.map((a) => a.node);
    const allNodes = this.dependencyGraph.getAllNodes();
    const freshNodes = allNodes.filter((node) => !staleNodes.includes(node));
    return {
      specIterationId: project.latestSpec.id,
      specVersion: project.latestSpec.version,
      staleNodes,
      freshNodes,
    };
  }
}
