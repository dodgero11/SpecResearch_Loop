import { Injectable, NotFoundException } from '@nestjs/common';
import { DecisionType, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class DecisionService {
  constructor(private readonly prisma: PrismaService) {}

  async record(projectId: string, type: DecisionType, target: string, value: unknown) {
    const project = await this.prisma.researchProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} was not found`);
    return this.prisma.decisionLog.create({ data: { projectId, type, target, value: value as Prisma.InputJsonValue } });
  }

  list(projectId: string) {
    return this.prisma.decisionLog.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }
}
