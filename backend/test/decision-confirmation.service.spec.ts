import { DecisionService } from '../src/decision.service';
import { ConfirmationService } from '../src/confirmation.service';

describe('DecisionService and ConfirmationService', () => {
  it('appends decisions without replacing earlier history', async () => {
    const prisma = {
      researchProject: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1' }) },
      decisionLog: {
        create: jest.fn().mockResolvedValue({ id: 'decision-1' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'decision-1' }, { id: 'decision-2' }]),
      },
    };
    const service = new DecisionService(prisma as never);

    await service.record('project-1', 'ACCEPT', 'gap-judge', { accepted: true });
    await service.record('project-1', 'OVERRIDE', 'gap-judge', { accepted: false });

    expect(prisma.decisionLog.create).toHaveBeenCalledTimes(2);
  });

  it('persists and answers confirmation questions', async () => {
    const prisma = {
      researchProject: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1' }) },
      confirmationQuestion: {
        create: jest.fn().mockResolvedValue({ id: 'question-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'question-1' }),
        update: jest.fn().mockResolvedValue({ id: 'question-1', answer: 'yes' }),
      },
    };
    const service = new ConfirmationService(prisma as never);

    await service.ask('project-1', 'Accept this gap?');
    await service.answer('question-1', 'yes');

    expect(prisma.confirmationQuestion.create).toHaveBeenCalled();
    expect(prisma.confirmationQuestion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ answer: 'yes' }) }));
  });
});
