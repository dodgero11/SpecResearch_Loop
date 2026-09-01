import { DependencyGraphService } from '../src/dependency-graph.service';
import { ResearchService } from '../src/research.service';

describe('ResearchService', () => {
  const prisma = {
    specCard: { findMany: jest.fn(), findFirst: jest.fn() },
    specCardLink: { findMany: jest.fn() },
    specArtifact: { create: jest.fn() },
  };
  const projects = {
    latestSpec: jest.fn(),
    createSpec: jest.fn(),
  };
  const cards = { update: jest.fn() };
  const decisions = { record: jest.fn() };
  const dependencyGraph = new DependencyGraphService();
  const ai = { relatedWorks: jest.fn(), gapAnalysis: jest.fn(), conflicts: jest.fn() };
  const service = new ResearchService(prisma as never, projects as never, cards as never, decisions as never, dependencyGraph, ai as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getRelatedWorks returns existing relatedWork without calling ai_service', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: { relatedWork: [{ paper_title: 'P' }] } });

    const result = await service.getRelatedWorks('project-1');

    expect(ai.relatedWorks).not.toHaveBeenCalled();
    expect(result.results).toEqual([{ paper_title: 'P' }]);
  });

  it('getRelatedWorks calls ai_service and stores results when empty', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: {} });
    prisma.specCard.findMany.mockResolvedValue([
      { type: 'PROBLEM', content: 'P' },
      { type: 'RESEARCH_QUESTION', content: 'RQ' },
      { type: 'GAP_CANDIDATE', content: 'G' },
    ]);
    ai.relatedWorks.mockResolvedValue({ output: { related_works: [{ paper_title: 'OPRO' }] } });
    projects.createSpec.mockResolvedValue({ id: 'spec-2' });

    const result = await service.getRelatedWorks('project-1');

    expect(ai.relatedWorks).toHaveBeenCalledWith('P', 'RQ', ['G']);
    expect(projects.createSpec).toHaveBeenCalledWith('project-1', { relatedWork: [{ paper_title: 'OPRO' }] });
    expect(prisma.specArtifact.create).toHaveBeenCalledTimes(5);
    expect(result.results).toEqual([{ paper_title: 'OPRO' }]);
  });

  it('gapAnalysis calls ai_service and stores the mapped result', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: { relatedWork: [{ paper_title: 'P' }] } });
    prisma.specCard.findMany.mockResolvedValue([{ type: 'GAP_CANDIDATE', content: 'G' }]);
    ai.gapAnalysis.mockResolvedValue({
      output: {
        what_was_done: 'done',
        limitation: 'lim',
        why_it_matters: 'why',
        testable_with: 'test',
        directions: [{ letter: 'A', label: 'x', description: 'y' }],
      },
    });
    projects.createSpec.mockResolvedValue({ id: 'spec-2' });

    const result = await service.gapAnalysis('project-1');

    expect(ai.gapAnalysis).toHaveBeenCalledWith('G', [{ paper_title: 'P' }]);
    expect(projects.createSpec).toHaveBeenCalledWith('project-1', expect.objectContaining({ gapAnalysis: expect.any(Object) }));
    expect(prisma.specArtifact.create).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      whatWasDone: 'done',
      limitation: 'lim',
      whyItMatters: 'why',
      testableWith: 'test',
      directions: [{ letter: 'A', label: 'x', description: 'y' }],
    });
  });

  it('checkConflicts calls ai_service and returns real conflicts', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: { relatedWork: [{ paper_title: 'P' }] } });
    prisma.specCardLink.findMany.mockResolvedValue([
      { id: 'link-1', sourceCardId: 'claim-1', targetCardId: 'ev-1', type: 'CLAIM_EVIDENCE' },
    ]);
    prisma.specCard.findMany.mockResolvedValue([
      { id: 'claim-1', content: 'Claim A' },
      { id: 'ev-1', content: 'Evidence A' },
    ]);
    ai.conflicts.mockResolvedValue({
      output: {
        conflicts: [
          { claim_card_id: 'claim-1', evidence_card_id: 'ev-1', linked_sources: [{ paper_title: 'P' }], reason: 'Mâu thuẫn thực sự' },
        ],
      },
    });

    const result = await service.checkConflicts('project-1');

    expect(ai.conflicts).toHaveBeenCalledWith(
      [{ claimCardId: 'claim-1', evidenceCardId: 'ev-1', claim: 'Claim A', evidence: 'Evidence A' }],
      [{ paper_title: 'P' }],
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      id: 'claim-1__ev-1',
      claimCardId: 'claim-1',
      evidenceCardId: 'ev-1',
      linkedSources: [{ paper_title: 'P' }],
      reason: 'Mâu thuẫn thực sự',
      resolutionOptions: expect.arrayContaining([expect.objectContaining({ letter: 'A' })]),
    });
  });

  it('checkConflicts returns empty without calling ai_service when there are no links', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: {} });
    prisma.specCardLink.findMany.mockResolvedValue([]);
    prisma.specCard.findMany.mockResolvedValue([]);

    const result = await service.checkConflicts('project-1');

    expect(ai.conflicts).not.toHaveBeenCalled();
    expect(result.conflicts).toEqual([]);
  });

  it('selectDirection persists the chosen direction and marks it selected', async () => {
    projects.latestSpec.mockResolvedValue({
      id: 'spec-1',
      version: 1,
      data: { gapAnalysis: { directions: [{ letter: 'A', label: 'x' }, { letter: 'B', label: 'y' }] } },
    });
    projects.createSpec.mockResolvedValue({});

    const result = await service.selectDirection('project-1', 'B');

    expect(projects.createSpec).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        gapAnalysis: expect.objectContaining({
          directions: [
            { letter: 'A', label: 'x', selected: false },
            { letter: 'B', label: 'y', selected: true },
          ],
        }),
      }),
    );
    expect(result.selected).toBe('B');
  });

  it('selectDirection with Other (D) persists the custom text as the direction label', async () => {
    projects.latestSpec.mockResolvedValue({
      id: 'spec-1',
      version: 1,
      data: { gapAnalysis: { directions: [{ letter: 'D', label: 'Kết hợp' }] } },
    });
    projects.createSpec.mockResolvedValue({});

    const result = await service.selectDirection('project-1', 'D', 'Hướng tự chọn của tôi');

    expect(projects.createSpec).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        gapAnalysis: expect.objectContaining({
          directions: [{ letter: 'D', label: 'Hướng tự chọn của tôi', selected: true }],
        }),
      }),
    );
    expect(decisions.record).toHaveBeenCalledWith('project-1', 'ACCEPT', 'direction', { letter: 'D', customDirection: 'Hướng tự chọn của tôi' });
    expect(result.selected).toBe('D');
  });

  it('resolveConflict choice A narrows the claim status to PROPOSED', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: {} });
    prisma.specCard.findMany.mockResolvedValue([]);
    prisma.specCard.findFirst = jest.fn().mockResolvedValue({ id: 'claim-1', content: 'Claim A' });
    cards.update.mockResolvedValue({ card: { id: 'claim-1', status: 'PROPOSED' } });

    const result = await service.resolveConflict('project-1', 'claim-1__ev-1', 'A');

    expect(cards.update).toHaveBeenCalledWith('project-1', 'claim-1', expect.objectContaining({ status: 'PROPOSED', metadata: expect.objectContaining({ resolution: expect.objectContaining({ choice: 'A' }) }) }));
    expect(result.updatedCard.status).toBe('PROPOSED');
    expect(result.invalidatedNodes).toEqual(expect.arrayContaining(['experiment', 'judge']));
  });

  it('resolveConflict choice C converts the claim to OPEN_QUESTION', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: {} });
    prisma.specCard.findMany.mockResolvedValue([]);
    prisma.specCard.findFirst = jest.fn().mockResolvedValue({ id: 'claim-1', content: 'Claim A' });
    cards.update.mockResolvedValue({ card: { id: 'claim-1', type: 'OPEN_QUESTION' } });

    await service.resolveConflict('project-1', 'claim-1__ev-1', 'C');

    expect(cards.update).toHaveBeenCalledWith('project-1', 'claim-1', expect.objectContaining({ type: 'OPEN_QUESTION', status: 'PROPOSED' }));
  });

  it('resolveConflict throws NotFound for an unknown conflict', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1, data: {} });
    prisma.specCard.findMany.mockResolvedValue([]);
    prisma.specCard.findFirst = jest.fn().mockResolvedValue(null);

    await expect(service.resolveConflict('project-1', 'nope__nope', 'A')).rejects.toThrow('Conflict nope__nope was not found');
  });

  it('resolveConflict rejects a malformed conflict id', async () => {
    await expect(service.resolveConflict('project-1', 'no-separator', 'A')).rejects.toThrow('Invalid conflict id no-separator');
    expect(cards.update).not.toHaveBeenCalled();
  });
});