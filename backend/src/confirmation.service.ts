import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class ConfirmationService {
  constructor(private readonly prisma: PrismaService) {}

  async ask(projectId: string, question: string) {
    await this.assertProject(projectId);
    return this.prisma.confirmationQuestion.create({ data: { projectId, question } });
  }

  async answer(id: string, answer: string) {
    const question = await this.prisma.confirmationQuestion.findUnique({ where: { id } });
    if (!question) throw new NotFoundException(`Confirmation question ${id} was not found`);
    return this.prisma.confirmationQuestion.update({ where: { id }, data: { answer, answeredAt: new Date() } });
  }

  list(projectId: string) {
    return this.prisma.confirmationQuestion.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }

  private async assertProject(projectId: string): Promise<void> {
    const project = await this.prisma.researchProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} was not found`);
  }
}
