import { DecisionService } from '../src/decision.service';

describe('DecisionService', () => {
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
});
