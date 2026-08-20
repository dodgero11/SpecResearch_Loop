import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SpecIteration } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type SpecData = Record<string, unknown>;

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createSpec(projectId: string, data: SpecData): Promise<SpecIteration> {
    return this.prisma.$transaction(async (transaction) => {
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
      return spec;
    });
  }

  async updateNode(projectId: string, node: string, value: unknown): Promise<SpecIteration> {
    const current = await this.latestSpec(projectId);
    const currentData = current.data as SpecData;
    const nextData = { ...currentData, [node]: value };
    return this.prisma.$transaction(async (transaction) => {
      const spec = await transaction.specIteration.create({
        data: { projectId, version: current.version + 1, data: nextData as Prisma.InputJsonValue },
      });
      await transaction.researchProject.update({ where: { id: projectId }, data: { latestSpecId: spec.id } });
      return spec;
    });
  }
}
