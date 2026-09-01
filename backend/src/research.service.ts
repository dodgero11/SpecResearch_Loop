import { randomUUID } from 'crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SpecCardStatus, SpecCardType } from '@prisma/client';
import { DecisionService } from './decision.service';
import { DependencyGraphService, WorkflowNode } from './dependency-graph.service';
import { AI_GATEWAY, AiGateway } from './integrations/ai-gateway.port';
import { PrismaService } from './prisma.service';
import { ProjectService, SpecData } from './project.service';
import { SpecCardService } from './spec-card.service';

const RESOLUTION_OPTIONS = [
  { letter: 'A', label: 'Thu hẹp claim', description: 'Viết lại claim hẹp hơn cho khớp với bằng chứng.' },
  { letter: 'B', label: 'Đổi cách đo evidence', description: 'Cập nhật cách đo bằng chứng mới.' },
  { letter: 'C', label: 'Hủy claim này', description: 'Chuyển claim thành open question để xem xét sau.' },
  { letter: 'D', label: 'Other', description: 'Tự xử lý thủ công.' },
];

@Injectable()
export class ResearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
    private readonly cards: SpecCardService,
    private readonly decisions: DecisionService,
    private readonly dependencyGraph: DependencyGraphService,
    @Inject(AI_GATEWAY) private readonly ai: AiGateway,
  ) {}

  /** Step 3a: load related works once (from ai_service), store in spec data. */
  async getRelatedWorks(projectId: string) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    if (Array.isArray(data.relatedWork) && data.relatedWork.length > 0) {
      return { results: data.relatedWork };
    }
    const cards = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id } });
    const problem = cards.find((card) => card.type === SpecCardType.PROBLEM)?.content ?? '';
    const researchQuestion = cards.find((card) => card.type === SpecCardType.RESEARCH_QUESTION)?.content ?? '';
    const gap = cards.find((card) => card.type === SpecCardType.GAP_CANDIDATE)?.content ?? '';
    const response = await this.ai.relatedWorks(problem, researchQuestion, gap ? [gap] : undefined);
    const results = Array.isArray(response.output.related_works) ? response.output.related_works : [];
    // AI-sourced works don't carry a stable id; assign one so the frontend can
    // reliably delete them later (rows are keyed by id, and the backend matches
    // on id/source_url/paper_title — a synthesized `${title}-${index}` never matches).
    const withIds = results.map((item) => {
      const record = item as Record<string, unknown>;
      return record.id ? item : { ...record, id: randomUUID() };
    });
    // createSpec + invalidation are atomic: the AI call stays outside the tx.
    return this.prisma.$transaction(async (tx) => {
      const nextSpec = await this.projects.createSpec(projectId, { ...data, relatedWork: withIds });
      await this.invalidate(projectId, nextSpec.id, 'related_work', tx);
      return { results: withIds };
    });
  }

  /** Step 3b: gap analysis + A-D directions from ai_service, stored in spec data. */
  async gapAnalysis(projectId: string) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const cards = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id } });
    const gapCandidate = cards.find((card) => card.type === SpecCardType.GAP_CANDIDATE)?.content ?? '';
    const relatedWorks = Array.isArray(data.relatedWork) ? data.relatedWork : [];
    const response = await this.ai.gapAnalysis(gapCandidate, relatedWorks);
    const output = response.output;
    const gapAnalysis = {
      whatWasDone: String(output.what_was_done ?? ''),
      limitation: String(output.limitation ?? ''),
      whyItMatters: String(output.why_it_matters ?? ''),
      testableWith: String(output.testable_with ?? ''),
      directions: Array.isArray(output.directions) ? output.directions : [],
    };
    return this.prisma.$transaction(async (tx) => {
      const nextSpec = await this.projects.createSpec(projectId, { ...data, gapAnalysis });
      await this.invalidate(projectId, nextSpec.id, 'gap', tx);
      return gapAnalysis;
    });
  }

  /** Step 3b2: persist the user's selected focus direction (A-D) for Step 4. */
  async selectDirection(projectId: string, letter: string, customDirection?: string) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const gapAnalysis = (data.gapAnalysis ?? { directions: [] }) as { directions?: { letter: string; label?: string; selected?: boolean }[] };
    const directions = (gapAnalysis.directions ?? []).map((item) => {
      const selected = item.letter === letter;
      // For "Other" (D), persist the user's custom text as the direction label so
      // Step 4 sends the actual content to the AI instead of the bare letter.
      const label = selected && letter === 'D' && customDirection ? customDirection : item.label;
      return { ...item, label, selected };
    });
    const nextGapAnalysis = { ...gapAnalysis, directions };
    return this.prisma.$transaction(async (tx) => {
      const nextSpec = await this.projects.createSpec(projectId, { ...data, gapAnalysis: nextGapAnalysis });
      await this.invalidate(projectId, nextSpec.id, 'gap', tx);
      await this.decisions.record(projectId, 'ACCEPT', 'direction', { letter, customDirection }, tx);
      return { selected: letter, directions };
    });
  }

  /** Step 3c: detect claim–evidence conflicts via ai_service (linked pairs + related work). */
  async checkConflicts(projectId: string) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const links = await this.prisma.specCardLink.findMany({
      where: { projectId, specIterationId: spec.id, type: 'CLAIM_EVIDENCE' },
    });
    const cards = await this.prisma.specCard.findMany({ where: { projectId, specIterationId: spec.id } });
    const cardById = new Map(cards.map((card) => [card.id, card]));
    // Cards are cloned to brand-new ids on every version bump (clone-on-write), so
    // version ids are unstable. lineageId is stable across clones — use it as the
    // conflict identity so a conflict never "expires" after an unrelated mutation.
    const cardByLineage = new Map(cards.map((card) => [card.lineageId, card]));
    const pairs = links
      .filter((link) => cardById.has(link.sourceCardId) && cardById.has(link.targetCardId))
      .map((link) => {
        const claim = cardById.get(link.sourceCardId)!;
        const evidence = cardById.get(link.targetCardId)!;
        return { claimCardId: claim.lineageId, evidenceCardId: evidence.lineageId, claim: claim.content, evidence: evidence.content };
      });
    if (pairs.length === 0) return { conflicts: [] };
    const relatedWorks = Array.isArray(data.relatedWork) ? data.relatedWork : [];
    const response = await this.ai.conflicts(pairs, relatedWorks);
    const rawConflicts = Array.isArray(response.output.conflicts) ? response.output.conflicts : [];
    const conflicts = rawConflicts.map((raw) => {
      const record = raw as Record<string, unknown>;
      const claimLineageId = String(record.claim_card_id ?? record.claimCardId ?? '');
      const evidenceLineageId = String(record.evidence_card_id ?? record.evidenceCardId ?? '');
      // Resolve the stable lineage ids back to the current version ids so the
      // frontend can still look up card content by id (cardContentById is keyed
      // by version id). Fall back to the lineage id if the card is somehow gone.
      const claimCard = cardByLineage.get(claimLineageId);
      const evidenceCard = cardByLineage.get(evidenceLineageId);
      return {
        id: `${claimLineageId}__${evidenceLineageId}`,
        claimCardId: claimCard?.id ?? claimLineageId,
        evidenceCardId: evidenceCard?.id ?? evidenceLineageId,
        linkedSources: Array.isArray(record.linked_sources ?? record.linkedSources) ? (record.linked_sources ?? record.linkedSources) : [],
        reason: String(record.reason ?? ''),
        resolutionOptions: RESOLUTION_OPTIONS,
      };
    });
    return { conflicts };
  }

  /** Step 3d: apply a chosen conflict resolution to the linked cards. */
  async resolveConflict(projectId: string, conflictId: string, choice: string, customResolution?: string) {
    return this.prisma.$transaction(async (tx) => {
      // conflictId is built from stable lineage ids (see checkConflicts), so it
      // survives clone-on-write: cards keep their lineageId across version bumps
      // even though their version id changes.
      const [claimLineageId, evidenceLineageId] = conflictId.split('__');
      if (!claimLineageId || !evidenceLineageId) {
        throw new BadRequestException(`Invalid conflict id ${conflictId}`);
      }
      const spec = await this.projects.latestSpec(projectId);
      const claimCard = await this.prisma.specCard.findFirst({
        where: { lineageId: claimLineageId, projectId, specIterationId: spec.id },
      });
      if (!claimCard) throw new NotFoundException(`Conflict ${conflictId} was not found`);
      let evidenceCard: { id: string } | null = null;
      if (choice === 'B') {
        evidenceCard = await this.prisma.specCard.findFirst({
          where: { lineageId: evidenceLineageId, projectId, specIterationId: spec.id },
        });
        if (!evidenceCard) throw new NotFoundException(`Conflict ${conflictId} was not found`);
      }

      const resolvedAt = new Date().toISOString();
      const resolution = { conflictId, choice, customResolution, resolvedAt };
      let updated: { card: Record<string, unknown> };
      if (choice === 'A') {
        updated = (await this.cards.update(projectId, claimCard.id, { status: SpecCardStatus.PROPOSED, metadata: { resolution } })) as { card: Record<string, unknown> };
      } else if (choice === 'B') {
        updated = (await this.cards.update(projectId, evidenceCard!.id, { status: SpecCardStatus.PROPOSED, metadata: { resolution } })) as { card: Record<string, unknown> };
      } else if (choice === 'C') {
        updated = (await this.cards.update(projectId, claimCard.id, { type: SpecCardType.OPEN_QUESTION, status: SpecCardStatus.PROPOSED, metadata: { resolution } })) as { card: Record<string, unknown> };
      } else {
        updated = (await this.cards.update(projectId, claimCard.id, { metadata: { resolution } })) as { card: Record<string, unknown> };
      }
      const invalidatedNodes = this.dependencyGraph.getAffectedNodes('claim');
      await this.decisions.record(projectId, 'ACCEPT', `conflict:${conflictId}`, { choice, customResolution }, tx);
      return { updatedCard: updated.card, invalidatedNodes };
    });
  }

  /** Marks the dependency-graph dependents of a node STALE on a spec version. */
  private async invalidate(projectId: string, specIterationId: string, node: WorkflowNode, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    for (const affectedNode of this.dependencyGraph.getAffectedNodes(node)) {
      await client.specArtifact.upsert({
        where: { specIterationId_node: { specIterationId, node: affectedNode } },
        create: { projectId, specIterationId, node: affectedNode, status: 'STALE', data: {} },
        update: { status: 'STALE' },
      });
    }
  }
}