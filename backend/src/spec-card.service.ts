import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SpecCardLinkType, SpecCardStatus, SpecCardType } from '@prisma/client';
import { DependencyGraphService } from './dependency-graph.service';
import { PrismaService } from './prisma.service';

type CardInput = {
  type: SpecCardType;
  status?: SpecCardStatus;
  content: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class SpecCardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dependencyGraph: DependencyGraphService,
  ) {}

  async list(projectId: string, specIterationId?: string) {
    const spec = await this.getSpec(projectId, specIterationId);
    const cards = await this.prisma.specCard.findMany({
      where: { projectId, specIterationId: spec.id },
      orderBy: { createdAt: 'asc' },
    });
    const links = await this.prisma.specCardLink.findMany({
      where: { projectId, specIterationId: spec.id },
      orderBy: { createdAt: 'asc' },
    });
    return { specIterationId: spec.id, specVersion: spec.version, cards, links };
  }

  async create(projectId: string, input: CardInput, idempotencyKey?: string) {
    return this.prisma.$transaction(async (transaction) => {
      const previous = await this.findIdempotent(transaction, projectId, idempotencyKey);
      if (previous) return previous.result;
      const { spec } = await this.cloneLatest(transaction, projectId);
      const card = await transaction.specCard.create({
        data: {
          projectId,
          specIterationId: spec.id,
          type: input.type,
          status: input.status,
          content: input.content,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      await this.invalidateForCardType(transaction, projectId, spec.id, input.type);
      const result = { specIterationId: spec.id, specVersion: spec.version, card };
      await this.saveIdempotency(transaction, projectId, idempotencyKey, 'create-card', result);
      return result;
    });
  }

  async update(projectId: string, cardId: string, input: Partial<Omit<CardInput, 'type'>>, idempotencyKey?: string) {
    return this.prisma.$transaction(async (transaction) => {
      const previous = await this.findIdempotent(transaction, projectId, idempotencyKey);
      if (previous) return previous.result;
      const currentCard = await transaction.specCard.findFirst({ where: { id: cardId, projectId } });
      if (!currentCard) throw new NotFoundException(`Spec card ${cardId} was not found`);
      const { spec, cardMap } = await this.cloneLatest(transaction, projectId);
      const clonedCardId = cardMap.get(currentCard.id);
      if (!clonedCardId) throw new NotFoundException(`Spec card ${cardId} is not part of the latest specification`);
      const card = await transaction.specCard.update({
        where: { id: clonedCardId },
        data: {
          content: input.content,
          status: input.status,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      await this.invalidateForCardType(transaction, projectId, spec.id, currentCard.type);
      const result = { specIterationId: spec.id, specVersion: spec.version, card };
      await this.saveIdempotency(transaction, projectId, idempotencyKey, 'update-card', result);
      return result;
    });
  }

  async remove(projectId: string, cardId: string, idempotencyKey?: string) {
    return this.prisma.$transaction(async (transaction) => {
      const previous = await this.findIdempotent(transaction, projectId, idempotencyKey);
      if (previous) return previous.result;
      const currentCard = await transaction.specCard.findFirst({ where: { id: cardId, projectId } });
      if (!currentCard) throw new NotFoundException(`Spec card ${cardId} was not found`);
      const { spec, cardMap } = await this.cloneLatest(transaction, projectId);
      const clonedCardId = cardMap.get(cardId);
      if (!clonedCardId) throw new NotFoundException(`Spec card ${cardId} is not part of the latest specification`);
      await transaction.specCard.delete({ where: { id: clonedCardId } });
      const result = { specIterationId: spec.id, specVersion: spec.version, deletedCardId: cardId };
      await this.saveIdempotency(transaction, projectId, idempotencyKey, 'remove-card', result);
      return result;
    });
  }

  async createLink(projectId: string, sourceCardId: string, targetCardId: string, type: SpecCardLinkType, idempotencyKey?: string) {
    if (sourceCardId === targetCardId) throw new BadRequestException('A spec card cannot link to itself');
    return this.prisma.$transaction(async (transaction) => {
      const previous = await this.findIdempotent(transaction, projectId, idempotencyKey);
      if (previous) return previous.result;
      const current = await this.getSpec(projectId);
      const currentCards = await transaction.specCard.findMany({ where: { projectId, specIterationId: current.id } });
      const currentIds = new Set(currentCards.map((card) => card.id));
      if (!currentIds.has(sourceCardId) || !currentIds.has(targetCardId)) {
        throw new BadRequestException('Both cards must belong to the latest specification');
      }
      const { spec, cardMap } = await this.cloneLatest(transaction, projectId);
      const link = await transaction.specCardLink.create({
        data: {
          projectId,
          specIterationId: spec.id,
          sourceCardId: cardMap.get(sourceCardId)!,
          targetCardId: cardMap.get(targetCardId)!,
          type,
        },
      });
      const result = { specIterationId: spec.id, specVersion: spec.version, link };
      await this.saveIdempotency(transaction, projectId, idempotencyKey, 'create-card-link', result);
      return result;
    });
  }

  async removeLink(projectId: string, linkId: string, idempotencyKey?: string) {
    return this.prisma.$transaction(async (transaction) => {
      const previous = await this.findIdempotent(transaction, projectId, idempotencyKey);
      if (previous) return previous.result;
      const current = await this.getSpec(projectId);
      const currentLink = await transaction.specCardLink.findFirst({ where: { id: linkId, projectId, specIterationId: current.id } });
      if (!currentLink) throw new NotFoundException(`Card link ${linkId} was not found`);
      const { spec, cardMap } = await this.cloneLatest(transaction, projectId);
      const clonedLink = await transaction.specCardLink.findFirst({
        where: {
          projectId,
          specIterationId: spec.id,
          sourceCardId: cardMap.get(currentLink.sourceCardId),
          targetCardId: cardMap.get(currentLink.targetCardId),
          type: currentLink.type,
        },
      });
      if (!clonedLink) throw new NotFoundException(`Card link ${linkId} could not be copied to the new specification`);
      await transaction.specCardLink.delete({ where: { id: clonedLink.id } });
      const result = { specIterationId: spec.id, specVersion: spec.version, deletedLinkId: linkId };
      await this.saveIdempotency(transaction, projectId, idempotencyKey, 'remove-card-link', result);
      return result;
    });
  }

  private async invalidateForCardType(
    transaction: Prisma.TransactionClient,
    projectId: string,
    specIterationId: string,
    cardType: SpecCardType,
  ) {
    const node = this.dependencyGraph.getNodeForCardType(cardType);
    if (!node) return;
    const affectedNodes = this.dependencyGraph.getAffectedNodes(node);
    for (const affectedNode of affectedNodes) {
      await transaction.specArtifact.create({
        data: { projectId, specIterationId, node: affectedNode, status: 'STALE', data: {} },
      });
    }
  }

  private async getSpec(projectId: string, specIterationId?: string) {
    const spec = specIterationId
      ? await this.prisma.specIteration.findFirst({ where: { id: specIterationId, projectId } })
      : (await this.prisma.researchProject.findUnique({ where: { id: projectId }, include: { latestSpec: true } }))?.latestSpec;
    if (!spec) throw new NotFoundException('Specification was not found for this project');
    return spec;
  }

  private async cloneLatest(transaction: Prisma.TransactionClient, projectId: string) {
    const project = await transaction.researchProject.findUnique({ where: { id: projectId }, include: { latestSpec: true } });
    if (!project?.latestSpec) throw new NotFoundException('No latest spec exists for this project');
    const current = project.latestSpec;
    const spec = await transaction.specIteration.create({
      data: { projectId, version: current.version + 1, data: current.data as Prisma.InputJsonValue },
    });
    await transaction.researchProject.update({ where: { id: projectId }, data: { latestSpecId: spec.id } });
    const cards = await transaction.specCard.findMany({ where: { projectId, specIterationId: current.id } });
    const cardMap = new Map<string, string>();
    for (const card of cards) {
      const clone = await transaction.specCard.create({
        data: {
          projectId,
          specIterationId: spec.id,
          type: card.type,
          lineageId: card.lineageId,
          status: card.status,
          content: card.content,
          metadata: card.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      cardMap.set(card.id, clone.id);
    }
    const links = await transaction.specCardLink.findMany({ where: { projectId, specIterationId: current.id } });
    for (const link of links) {
      await transaction.specCardLink.create({
        data: {
          projectId,
          specIterationId: spec.id,
          sourceCardId: cardMap.get(link.sourceCardId)!,
          targetCardId: cardMap.get(link.targetCardId)!,
          type: link.type,
        },
      });
    }
    return { spec, cardMap };
  }

  private async findIdempotent(transaction: Prisma.TransactionClient, projectId: string, key?: string) {
    return key ? transaction.idempotencyRecord.findUnique({ where: { projectId_key: { projectId, key } } }) : null;
  }

  private async saveIdempotency(transaction: Prisma.TransactionClient, projectId: string, key: string | undefined, operation: string, result: unknown) {
    if (key) {
      await transaction.idempotencyRecord.create({
        data: { projectId, key, operation, result: result as Prisma.InputJsonValue },
      });
    }
  }
}