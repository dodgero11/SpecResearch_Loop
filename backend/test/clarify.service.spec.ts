import { ClarifyService } from '../src/clarify.service';

describe('ClarifyService', () => {
  const prisma = {
    researchProject: { findUnique: jest.fn() },
    clarification: { upsert: jest.fn(), findUnique: jest.fn() },
    confirmationQuestion: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const ai = {
    understandIdea: jest.fn(),
    generateQuestions: jest.fn(),
  };
  const decisions = { record: jest.fn().mockResolvedValue({}) };
  const service = new ClarifyService(prisma as never, ai as never, decisions as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.researchProject.findUnique.mockResolvedValue({ id: 'project-1' });
    // $transaction(array) executes the array of operations in order.
    prisma.$transaction.mockImplementation(async (ops: any[]) => {
      const results = [];
      for (const op of ops) results.push(await op);
      return results;
    });
  });

  it('understand calls ai_service and upserts the Clarification', async () => {
    ai.understandIdea.mockResolvedValue({
      output: { clarified_idea: 'Hệ thống hiểu ý tưởng', key_issues: ['k1', 'k2'], confidence: 0.8 },
    });
    prisma.clarification.upsert.mockResolvedValue({ id: 'clar-1' });

    const result = await service.understand('project-1', 'my idea', 'feedback');

    expect(ai.understandIdea).toHaveBeenCalledWith('my idea', 'feedback');
    expect(prisma.clarification.upsert).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: { projectId: 'project-1', idea: 'my idea', clarifiedIdea: 'Hệ thống hiểu ý tưởng', keyIssues: ['k1', 'k2'], confidence: 0.8, feedback: 'feedback' },
      update: { idea: 'my idea', clarifiedIdea: 'Hệ thống hiểu ý tưởng', keyIssues: ['k1', 'k2'], confidence: 0.8, feedback: 'feedback' },
    });
    expect(result).toEqual({ clarifiedIdea: 'Hệ thống hiểu ý tưởng', keyIssues: ['k1', 'k2'], confidence: 0.8 });
  });

  it('understand purges ALL stale questions atomically with the upsert', async () => {
    ai.understandIdea.mockResolvedValue({
      output: { clarified_idea: 'ci', key_issues: [], confidence: 0.5 },
    });
    prisma.clarification.upsert.mockResolvedValue({ id: 'clar-1' });

    await service.understand('project-1', 'my idea');

    // deleteMany must purge every question for the project (answered or not).
    expect(prisma.confirmationQuestion.deleteMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
    });
    // Both operations run inside a single transaction.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const ops = prisma.$transaction.mock.calls[0][0];
    expect(ops).toHaveLength(2);
  });

  it('questions maps ai_service question field to title and persists rows', async () => {
    prisma.clarification.findUnique.mockResolvedValue({ projectId: 'project-1', clarifiedIdea: 'ci' });
    prisma.confirmationQuestion.deleteMany.mockResolvedValue({ count: 0 });
    ai.generateQuestions.mockResolvedValue({
      output: {
        questions: [
          { question: 'Tác vụ chính?', example: 'VD', options: ['A', 'Other'] },
          { question: 'Spec dùng để làm gì?', options: ['B', 'Other'] },
        ],
      },
    });
    prisma.confirmationQuestion.create
      .mockResolvedValueOnce({ id: 'q1', question: 'Tác vụ chính?', title: 'Tác vụ chính?', example: 'VD', options: ['A', 'Other'] })
      .mockResolvedValueOnce({ id: 'q2', question: 'Spec dùng để làm gì?', title: 'Spec dùng để làm gì?', example: null, options: ['B', 'Other'] });

    const result = await service.questions('project-1');

    expect(ai.generateQuestions).toHaveBeenCalledWith('ci');
    expect(prisma.confirmationQuestion.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'project-1', answeredAt: null } });
    expect(prisma.confirmationQuestion.create).toHaveBeenCalledTimes(2);
    expect(result.questions).toEqual([
      { id: 'q1', title: 'Tác vụ chính?', example: 'VD', options: ['A', 'Other'] },
      { id: 'q2', title: 'Spec dùng để làm gì?', example: null, options: ['B', 'Other'] },
    ]);
  });

  it('questions throws NotFound when no clarification exists', async () => {
    prisma.clarification.findUnique.mockResolvedValue(null);

    await expect(service.questions('project-1')).rejects.toThrow('No clarification exists for project project-1');
    expect(ai.generateQuestions).not.toHaveBeenCalled();
  });

  it('answer saves selectedIndex, customAnswer, and the answer column without calling ai_service', async () => {
    const tx = {
      confirmationQuestion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'q1', projectId: 'project-1', options: ['A', 'B', 'C', 'Other'] }),
        update: jest.fn().mockResolvedValue({ id: 'q1' }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1' }) },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));

    const result = await service.answer('project-1', [{ questionId: 'q1', selectedIndex: 2, customAnswer: 'khác' }]);

    expect(tx.confirmationQuestion.update).toHaveBeenCalledWith({
      where: { id: 'q1' },
      data: expect.objectContaining({ selectedIndex: 2, customAnswer: 'khác', answer: 'khác' }),
    });
    expect(decisions.record).toHaveBeenCalledWith('project-1', 'ACCEPT', 'clarify-answers', { answers: [{ questionId: 'q1', selectedIndex: 2, customAnswer: 'khác' }] }, tx);
    expect(ai.understandIdea).not.toHaveBeenCalled();
    expect(result).toEqual({ saved: true });
  });

  it('answer falls back to the selected option when no custom answer is provided', async () => {
    const tx = {
      confirmationQuestion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'q1', projectId: 'project-1', options: ['A', 'B', 'C', 'Other'] }),
        update: jest.fn().mockResolvedValue({ id: 'q1' }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1' }) },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));

    await service.answer('project-1', [{ questionId: 'q1', selectedIndex: 1 }]);

    expect(tx.confirmationQuestion.update).toHaveBeenCalledWith({
      where: { id: 'q1' },
      data: expect.objectContaining({ selectedIndex: 1, answer: 'B' }),
    });
  });

  it('answer throws NotFound for an unknown question', async () => {
    const tx = {
      confirmationQuestion: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1' }) },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));

    await expect(service.answer('project-1', [{ questionId: 'nope', selectedIndex: 0 }])).rejects.toThrow(
      'Confirmation question nope was not found',
    );
  });
});