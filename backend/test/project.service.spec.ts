import { ProjectService } from '../src/project.service';

describe('ProjectService', () => {
  function makePrisma(project: unknown) {
    const transaction = {
      researchProject: {
        findUnique: jest.fn().mockResolvedValue(project),
        update: jest.fn().mockResolvedValue({}),
      },
      specIteration: { create: jest.fn().mockResolvedValue({ id: 'spec-2', projectId: 'project-1', version: 2, data: { gap: 'new' } }) },
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      specArtifact: { create: jest.fn().mockResolvedValue({}) },
    };
    return { transaction, prisma: { $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)) } };
  }

  it('creates a new immutable version and invalidates Gap dependents', async () => {
    const { prisma, transaction } = makePrisma({
      id: 'project-1',
      latestSpec: { id: 'spec-1', version: 1, data: { gap: 'old', problem: 'p' } },
    });
    const service = new ProjectService(prisma as never);

    const result = await service.updateNode('project-1', 'gap', 'new', 'request-1');

    expect(result.version).toBe(2);
    expect(transaction.specIteration.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ version: 2 }) }));
    expect(transaction.specArtifact.create).toHaveBeenCalledTimes(4);
    expect(transaction.idempotencyRecord.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ key: 'request-1' }) }));
  });

  it('returns the stored result for a repeated idempotency key', async () => {
    const stored = { id: 'spec-2', version: 2, data: { gap: 'new' } };
    const { prisma, transaction } = makePrisma({ id: 'project-1', latestSpec: { version: 1, data: {} } });
    transaction.idempotencyRecord.findUnique.mockResolvedValue({ result: stored });
    const service = new ProjectService(prisma as never);

    await expect(service.updateNode('project-1', 'gap', 'new', 'request-1')).resolves.toEqual(stored);
    expect(transaction.specIteration.create).not.toHaveBeenCalled();
  });
});
