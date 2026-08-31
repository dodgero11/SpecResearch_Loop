import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SpecCardStatus, SpecCardType } from '@prisma/client';
import { AI_GATEWAY, AiGateway } from './integrations/ai-gateway.port';
import { PrismaService } from './prisma.service';
import { ProjectService } from './project.service';
import { SpecCardService } from './spec-card.service';

@Injectable()
export class DecomposeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
    private readonly cards: SpecCardService,
    @Inject(AI_GATEWAY) private readonly ai: AiGateway,
  ) {}

  /** Step 2: generate the 8 fixed seed cards from the confirmed idea + answers. */
  async decompose(projectId: string) {
    const clarification = await this.prisma.clarification.findUnique({ where: { projectId } });
    if (!clarification) {
      throw new NotFoundException(`No clarification exists for project ${projectId}`);
    }
    const project = await this.prisma.researchProject.findUnique({ where: { id: projectId }, include: { latestSpec: true } });
    if (!project) throw new NotFoundException(`Project ${projectId} was not found`);
    if (!project.latestSpec) {
      await this.projects.createSpec(projectId, {});
    }
    const spec = await this.projects.latestSpec(projectId);
    const existing = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id, isSeed: true } });
    if (existing.length > 0) {
      return { cards: existing.map((card) => ({ type: card.type, content: card.content, status: card.status })) };
    }
    const answers = await this.prisma.confirmationQuestion.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    const response = await this.ai.decompose({
      idea: clarification.idea,
      clarifiedIdea: clarification.clarifiedIdea,
      answers: answers.map((answer) => ({
        questionId: answer.id,
        title: answer.title ?? answer.question,
        selectedIndex: answer.selectedIndex,
        customAnswer: answer.customAnswer,
      })),
    });
    const rawCards = Array.isArray(response.output.cards) ? response.output.cards : [];
    const inputs = rawCards
      .map((raw) => {
        const record = raw as Record<string, unknown>;
        const type = String(record.type ?? '');
        if (!Object.values(SpecCardType).includes(type as SpecCardType)) return null;
        // The 8 seed cards are always PROPOSED: the AI only proposes content and
        // never decides confidence/status (user flips status manually in Step 2).
        return {
          type: type as SpecCardType,
          content: String(record.content ?? ''),
          status: SpecCardStatus.PROPOSED,
        };
      })
      .filter((input): input is { type: SpecCardType; content: string; status: 'PROPOSED' } => input !== null);
    const result = await this.cards.createMany(projectId, inputs, { isSeed: true });
    return {
      cards: result.cards.map((card) => ({ type: card.type, content: card.content, status: card.status })),
    };
  }
}