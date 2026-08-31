import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SpecCardStatus, SpecCardType } from '@prisma/client';
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
    const nextSpec = await this.projects.createSpec(projectId, { ...data, relatedWork: results });
    await this.invalidate(projectId, nextSpec.id, 'related_work');
    return { results };
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
    const nextSpec = await this.projects.createSpec(projectId, { ...data, gapAnalysis });
    await this.invalidate(projectId, nextSpec.id, 'gap');
    return gapAnalysis;
  }

  /** Step 3b2: persist the user's selected focus direction (A-D) for Step 4. */
  async selectDirection(projectId: string, letter: string) {
    const spec = await this.projects.latestSpec(projectId);
    const data = spec.data as SpecData;
    const gapAnalysis = (data.gapAnalysis ?? { directions: [] }) as { directions?: { letter: string; selected?: boolean }[] };
    const directions = (gapAnalysis.directions ?? []).map((item) => ({ ...item, selected: item.letter === letter }));
    const nextGapAnalysis = { ...gapAnalysis, directions };
    await this.projects.createSpec(projectId, { ...data, gapAnalysis: nextGapAnalysis });
    return { selected: letter, directions };
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
    const pairs = links
      .filter((link) => cardById.has(link.sourceCardId) && cardById.has(link.targetCardId))
      .map((link) => {
        const claim = cardById.get(link.sourceCardId)!;
        const evidence = cardById.get(link.targetCardId)!;
        return { claimCardId: link.sourceCardId, evidenceCardId: link.targetCardId, claim: claim.content, evidence: evidence.content };
      });
    if (pairs.length === 0) return { conflicts: [] };
    const relatedWorks = Array.isArray(data.relatedWork) ? data.relatedWork : [];
    const response = await this.ai.conflicts(pairs, relatedWorks);
    const rawConflicts = Array.isArray(response.output.conflicts) ? response.output.conflicts : [];
    const conflicts = rawConflicts.map((raw) => {
      const record = raw as Record<string, unknown>;
      const claimCardId = String(record.claim_card_id ?? record.claimCardId ?? '');
      const evidenceCardId = String(record.evidence_card_id ?? record.evidenceCardId ?? '');
      return {
        id: `${claimCardId}__${evidenceCardId}`,
        claimCardId,
        evidenceCardId,
        linkedSources: Array.isArray(record.linked_sources ?? record.linkedSources) ? (record.linked_sources ?? record.linkedSources) : [],
        reason: String(record.reason ?? ''),
        resolutionOptions: RESOLUTION_OPTIONS,
      };
    });
    return { conflicts };
  }

  /** Step 3d: apply a chosen conflict resolution to the linked cards. */
  async resolveConflict(projectId: string, conflictId: string, choice: string, customResolution?: string) {
    const [claimCardId, evidenceCardId] = conflictId.split('__');
    if (!claimCardId || !evidenceCardId) {
      throw new BadRequestException(`Invalid conflict id ${conflictId}`);
    }
    const spec = await this.projects.latestSpec(projectId);
    const claimCard = await this.prisma.specCard.findFirst({
      where: { id: claimCardId, projectId, specIterationId: spec.id },
    });
    if (!claimCard) throw new NotFoundException(`Conflict ${conflictId} was not found`);
    if (choice === 'B') {
      const evidenceCard = await this.prisma.specCard.findFirst({
        where: { id: evidenceCardId, projectId, specIterationId: spec.id },
      });
      if (!evidenceCard) throw new NotFoundException(`Conflict ${conflictId} was not found`);
    }

    const resolvedAt = new Date().toISOString();
    const resolution = { conflictId, choice, customResolution, resolvedAt };
    let updated: { card: Record<string, unknown> };
    if (choice === 'A') {
      updated = (await this.cards.update(projectId, claimCardId, { status: SpecCardStatus.PROPOSED, metadata: { resolution } })) as { card: Record<string, unknown> };
    } else if (choice === 'B') {
      updated = (await this.cards.update(projectId, evidenceCardId, { status: SpecCardStatus.PROPOSED, metadata: { resolution } })) as { card: Record<string, unknown> };
    } else if (choice === 'C') {
      updated = (await this.cards.update(projectId, claimCardId, { type: SpecCardType.OPEN_QUESTION, status: SpecCardStatus.PROPOSED, metadata: { resolution } })) as { card: Record<string, unknown> };
    } else {
      updated = (await this.cards.update(projectId, claimCardId, { metadata: { resolution } })) as { card: Record<string, unknown> };
    }
    const invalidatedNodes = this.dependencyGraph.getAffectedNodes('claim');
    return { updatedCard: updated.card, invalidatedNodes };
  }

  /** Marks the dependency-graph dependents of a node STALE on a spec version. */
  private async invalidate(projectId: string, specIterationId: string, node: WorkflowNode) {
    for (const affectedNode of this.dependencyGraph.getAffectedNodes(node)) {
      await this.prisma.specArtifact.create({
        data: { projectId, specIterationId, node: affectedNode, status: 'STALE', data: {} },
      });
    }
  }
}