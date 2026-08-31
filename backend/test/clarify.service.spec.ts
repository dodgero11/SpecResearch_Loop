import { ClarifyService } from '../src/clarify.service';

describe('ClarifyService', () => {
  const prisma = {
    researchProject: { findUnique: jest.fn() },
    clarification: { upsert: jest.fn(), findUnique: jest.fn() },
    confirmationQuestion: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
  };
  const ai = {
    understandIdea: jest.fn(),
    generateQuestions: jest.fn(),
  };
  const service = new ClarifyService(prisma as never, ai as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.researchProject.findUnique.mockResolvedValue({ id: 'project-1' });
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

  it('answer saves selectedIndex and customAnswer without calling ai_service', async () => {
    prisma.confirmationQuestion.findFirst.mockResolvedValue({ id: 'q1', projectId: 'project-1' });
    prisma.confirmationQuestion.update.mockResolvedValue({ id: 'q1' });

    const result = await service.answer('project-1', [{ questionId: 'q1', selectedIndex: 2, customAnswer: 'khác' }]);

    expect(prisma.confirmationQuestion.update).toHaveBeenCalledWith({
      where: { id: 'q1' },
      data: expect.objectContaining({ selectedIndex: 2, customAnswer: 'khác' }),
    });
    expect(ai.understandIdea).not.toHaveBeenCalled();
    expect(result).toEqual({ saved: true });
  });

  it('answer throws NotFound for an unknown question', async () => {
    prisma.confirmationQuestion.findFirst.mockResolvedValue(null);

    await expect(service.answer('project-1', [{ questionId: 'nope', selectedIndex: 0 }])).rejects.toThrow(
      'Confirmation question nope was not found',
    );
  });
});