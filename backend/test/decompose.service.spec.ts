import { DecomposeService } from '../src/decompose.service';

describe('DecomposeService', () => {
  const prisma = {
    clarification: { findUnique: jest.fn() },
    confirmationQuestion: { findMany: jest.fn() },
    researchProject: { findUnique: jest.fn() },
    specCard: { findMany: jest.fn() },
  };
  const projects = { createSpec: jest.fn(), latestSpec: jest.fn() };
  const cards = { createMany: jest.fn() };
  const ai = { decompose: jest.fn() };
  const service = new DecomposeService(prisma as never, projects as never, cards as never, ai as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('decompose reads clarification + answers, calls ai_service, and creates 8 seed cards', async () => {
    prisma.clarification.findUnique.mockResolvedValue({ projectId: 'project-1', idea: 'idea', clarifiedIdea: 'ci' });
    prisma.researchProject.findUnique.mockResolvedValue({ id: 'project-1', latestSpec: { id: 'spec-1', version: 1 } });
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1 });
    prisma.specCard.findMany.mockResolvedValue([]);
    prisma.confirmationQuestion.findMany.mockResolvedValue([
      { id: 'q1', question: 'Tác vụ?', title: 'Tác vụ?', selectedIndex: 0, customAnswer: null },
    ]);
    ai.decompose.mockResolvedValue({
      output: {
        cards: [
          { type: 'PROBLEM', content: 'P', status: 'PROPOSED' },
          { type: 'RESEARCH_QUESTION', content: 'RQ', status: 'PROPOSED' },
          { type: 'GAP_CANDIDATE', content: 'G', status: 'PROPOSED' },
          { type: 'CONTRIBUTION', content: 'C', status: 'PROPOSED' },
          { type: 'CLAIM', content: 'CL', status: 'PROPOSED' },
          { type: 'EVIDENCE', content: 'E', status: 'PROPOSED' },
          { type: 'CONSTRAINT', content: 'CO', status: 'PROPOSED' },
          { type: 'OPEN_QUESTION', content: 'OQ', status: 'PROPOSED' },
        ],
      },
    });
    cards.createMany.mockResolvedValue({
      specIterationId: 'spec-2',
      specVersion: 2,
      cards: [
        { type: 'PROBLEM', content: 'P', status: 'PROPOSED' },
        { type: 'RESEARCH_QUESTION', content: 'RQ', status: 'PROPOSED' },
        { type: 'GAP_CANDIDATE', content: 'G', status: 'PROPOSED' },
        { type: 'CONTRIBUTION', content: 'C', status: 'PROPOSED' },
        { type: 'CLAIM', content: 'CL', status: 'PROPOSED' },
        { type: 'EVIDENCE', content: 'E', status: 'PROPOSED' },
        { type: 'CONSTRAINT', content: 'CO', status: 'PROPOSED' },
        { type: 'OPEN_QUESTION', content: 'OQ', status: 'PROPOSED' },
      ],
    });

    const result = await service.decompose('project-1');

    expect(ai.decompose).toHaveBeenCalledWith({
      idea: 'idea',
      clarifiedIdea: 'ci',
      answers: [{ questionId: 'q1', title: 'Tác vụ?', selectedIndex: 0, customAnswer: null }],
    });
    expect(cards.createMany).toHaveBeenCalledWith(
      'project-1',
      expect.arrayContaining([expect.objectContaining({ type: 'PROBLEM', status: 'PROPOSED' })]),
      { isSeed: true },
    );
    expect(result.cards).toHaveLength(8);
    expect(result.cards.every((card) => card.status === 'PROPOSED')).toBe(true);
  });

  it('creates the first spec version when none exists yet', async () => {
    prisma.clarification.findUnique.mockResolvedValue({ projectId: 'project-1', idea: 'idea', clarifiedIdea: 'ci' });
    prisma.researchProject.findUnique.mockResolvedValue({ id: 'project-1', latestSpec: null });
    projects.createSpec.mockResolvedValue({ id: 'spec-1', version: 1 });
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1 });
    prisma.specCard.findMany.mockResolvedValue([]);
    prisma.confirmationQuestion.findMany.mockResolvedValue([]);
    ai.decompose.mockResolvedValue({ output: { cards: [] } });
    cards.createMany.mockResolvedValue({ specIterationId: 'spec-1', specVersion: 1, cards: [] });

    await service.decompose('project-1');

    expect(projects.createSpec).toHaveBeenCalledWith('project-1', {});
  });

  it('returns existing seed cards without calling ai_service when already decomposed', async () => {
    prisma.clarification.findUnique.mockResolvedValue({ projectId: 'project-1', idea: 'idea', clarifiedIdea: 'ci' });
    prisma.researchProject.findUnique.mockResolvedValue({ id: 'project-1', latestSpec: { id: 'spec-1', version: 1 } });
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1 });
    prisma.specCard.findMany.mockResolvedValue([
      { type: 'PROBLEM', content: 'P', status: 'PROPOSED' },
      { type: 'CLAIM', content: 'CL', status: 'PROPOSED' },
    ]);

    const result = await service.decompose('project-1');

    expect(ai.decompose).not.toHaveBeenCalled();
    expect(cards.createMany).not.toHaveBeenCalled();
    expect(result.cards).toHaveLength(2);
  });

  it('filters out cards with invalid types and coerces any status to PROPOSED', async () => {
    prisma.clarification.findUnique.mockResolvedValue({ projectId: 'project-1', idea: 'idea', clarifiedIdea: 'ci' });
    prisma.researchProject.findUnique.mockResolvedValue({ id: 'project-1', latestSpec: { id: 'spec-1', version: 1 } });
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1 });
    prisma.specCard.findMany.mockResolvedValue([]);
    prisma.confirmationQuestion.findMany.mockResolvedValue([]);
    ai.decompose.mockResolvedValue({
      output: {
        cards: [
          { type: 'PROBLEM', content: 'P', status: 'PROPOSED' },
          { type: 'NOT_A_TYPE', content: 'bad', status: 'PROPOSED' },
          { type: 'CLAIM', content: 'CL', status: 'CONFIRMED' },
        ],
      },
    });
    cards.createMany.mockResolvedValue({
      specIterationId: 'spec-2',
      specVersion: 2,
      cards: [
        { type: 'PROBLEM', content: 'P', status: 'PROPOSED' },
        { type: 'CLAIM', content: 'CL', status: 'PROPOSED' },
      ],
    });

    await service.decompose('project-1');

    expect(cards.createMany).toHaveBeenCalledWith(
      'project-1',
      [
        { type: 'PROBLEM', content: 'P', status: 'PROPOSED' },
        { type: 'CLAIM', content: 'CL', status: 'PROPOSED' },
      ],
      { isSeed: true },
    );
  });

  it('decompose throws NotFound when no clarification exists', async () => {
    prisma.clarification.findUnique.mockResolvedValue(null);

    await expect(service.decompose('project-1')).rejects.toThrow('No clarification exists for project project-1');
    expect(ai.decompose).not.toHaveBeenCalled();
  });
});