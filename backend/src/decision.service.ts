import { Injectable, NotFoundException } from '@nestjs/common';
import { DecisionType, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class DecisionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a decision. Pass a Prisma transaction client to write the decision
   * atomically with the mutation that triggered it (otherwise a failure after
   * the mutation commits would lose the decision).
   */
  async record(
    projectId: string,
    type: DecisionType,
    target: string,
    value: unknown,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const project = await client.researchProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} was not found`);
    return client.decisionLog.create({ data: { projectId, type, target, value: value as Prisma.InputJsonValue } });
  }

  list(projectId: string) {
    return this.prisma.decisionLog.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }
}
