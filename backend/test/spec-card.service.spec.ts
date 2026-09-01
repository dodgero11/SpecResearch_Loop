import { DependencyGraphService } from '../src/dependency-graph.service';
import { SpecCardService } from '../src/spec-card.service';

describe('SpecCardService', () => {
  function makePrisma() {
    const transaction = {
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: 'project-1', latestSpec: { id: 'spec-1', version: 1, data: {} } }),
        update: jest.fn().mockResolvedValue({}),
      },
      specIteration: { create: jest.fn().mockResolvedValue({ id: 'spec-2', projectId: 'project-1', version: 2 }) },
      specCard: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'card-1', projectId: 'project-1', specIterationId: 'spec-1', type: 'GAP_CANDIDATE', content: 'old' }),
        create: jest.fn().mockResolvedValue({ id: 'card-2', projectId: 'project-1', specIterationId: 'spec-2', type: 'GAP_CANDIDATE', content: 'new' }),
        update: jest.fn().mockResolvedValue({ id: 'card-2', projectId: 'project-1', specIterationId: 'spec-2', type: 'GAP_CANDIDATE', content: 'updated' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      specCardLink: { findMany: jest.fn().mockResolvedValue([]) },
      specArtifact: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      judgeIssue: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
      idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    };
    return {
      transaction,
      prisma: {
        $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
        researchProject: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1', latestSpec: { id: 'spec-1', version: 1 } }) },
      },
    };
  }

  function makeService() {
    const { prisma, transaction } = makePrisma();
    const dependencyGraph = new DependencyGraphService();
    const decisions = { record: jest.fn().mockResolvedValue({}) };
    const service = new SpecCardService(prisma as never, dependencyGraph, decisions as never);
    return { service, transaction, prisma, decisions };
  }

  it('invalidates downstream nodes when creating a GAP_CANDIDATE card', async () => {
    const { service, transaction } = makeService();

    await service.create('project-1', { type: 'GAP_CANDIDATE', content: 'A gap' });

    expect(transaction.specArtifact.upsert).toHaveBeenCalledTimes(5);
    const createdNodes = transaction.specArtifact.upsert.mock.calls.map((call: unknown[]) => (call[0] as { create: { node: string } }).create.node);
    expect(createdNodes).toEqual(expect.arrayContaining(['contribution', 'claim', 'experiment', 'judge']));
  });

  it('invalidates downstream nodes when updating a CONTRIBUTION card', async () => {
    const { service, transaction } = makeService();
    transaction.specCard.findFirst.mockResolvedValue({
      id: 'card-1', projectId: 'project-1', specIterationId: 'spec-1', type: 'CONTRIBUTION', content: 'old',
    });
    transaction.specCard.findMany.mockResolvedValue([
      { id: 'card-1', projectId: 'project-1', specIterationId: 'spec-1', type: 'CONTRIBUTION', content: 'old' },
    ]);
    transaction.specCard.create.mockResolvedValue({
      id: 'card-2', projectId: 'project-1', specIterationId: 'spec-2', type: 'CONTRIBUTION', content: 'old',
    });

    await service.update('project-1', 'card-1', { content: 'new contribution' });

    expect(transaction.specArtifact.upsert).toHaveBeenCalledTimes(4);
    const createdNodes = transaction.specArtifact.upsert.mock.calls.map((call: unknown[]) => (call[0] as { create: { node: string } }).create.node);
    expect(createdNodes).toEqual(expect.arrayContaining(['claim', 'experiment', 'judge']));
  });

  it('invalidates downstream nodes when creating an OPEN_QUESTION card', async () => {
    const { service, transaction } = makeService();

    await service.create('project-1', { type: 'OPEN_QUESTION', content: 'A question' });

    expect(transaction.specArtifact.upsert).toHaveBeenCalledTimes(5);
    const createdNodes = transaction.specArtifact.upsert.mock.calls.map((call: unknown[]) => (call[0] as { create: { node: string } }).create.node);
    expect(createdNodes).toEqual(expect.arrayContaining(['contribution', 'claim', 'experiment', 'judge']));
  });

  it('does not invalidate when creating a CONSTRAINT card', async () => {
    const { service, transaction } = makeService();

    await service.create('project-1', { type: 'CONSTRAINT', content: 'A constraint' });

    expect(transaction.specArtifact.upsert).toHaveBeenCalledTimes(2);
    const createdNodes = transaction.specArtifact.upsert.mock.calls.map((call: unknown[]) => (call[0] as { create: { node: string } }).create.node);
    expect(createdNodes).toEqual(['experiment', 'judge']);
  });

  it('createMany creates all cards in one new spec version with isSeed', async () => {
    const { service, transaction } = makeService();

    const result = await service.createMany(
      'project-1',
      [
        { type: 'PROBLEM', content: 'P' },
        { type: 'CLAIM', content: 'CL' },
      ],
      { isSeed: true },
    );

    expect(transaction.specIteration.create).toHaveBeenCalledTimes(1);
    expect(transaction.specCard.create).toHaveBeenCalledTimes(2);
    expect(transaction.specCard.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isSeed: true, type: 'PROBLEM' }) }),
    );
    expect(result.specVersion).toBe(2);
    expect(result.cards).toHaveLength(2);
  });

  it('rejects deleting a seed card', async () => {
    const { service, transaction } = makeService();
    transaction.specCard.findFirst.mockResolvedValue({
      id: 'card-1', projectId: 'project-1', specIterationId: 'spec-1', type: 'PROBLEM', content: 'P', isSeed: true,
    });

    await expect(service.remove('project-1', 'card-1')).rejects.toThrow('Seed card card-1 cannot be deleted');
    expect(transaction.specCard.delete).not.toHaveBeenCalled();
  });

  it('update persists the reason field', async () => {
    const { service, transaction, decisions } = makeService();
    transaction.specCard.findFirst.mockResolvedValue({
      id: 'card-1', projectId: 'project-1', specIterationId: 'spec-1', type: 'GAP_CANDIDATE', content: 'old', isSeed: false, status: 'PROPOSED',
    });
    transaction.specCard.findMany.mockResolvedValue([
      { id: 'card-1', projectId: 'project-1', specIterationId: 'spec-1', type: 'GAP_CANDIDATE', content: 'old', isSeed: false, status: 'PROPOSED' },
    ]);
    transaction.specCard.create.mockResolvedValue({
      id: 'card-2', projectId: 'project-1', specIterationId: 'spec-2', type: 'GAP_CANDIDATE', content: 'old', isSeed: false, status: 'PROPOSED',
    });

    await service.update('project-1', 'card-1', { status: 'AMBIGUOUS', reason: 'Chưa rõ nghĩa' });

    expect(transaction.specCard.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'AMBIGUOUS', reason: 'Chưa rõ nghĩa' }) }),
    );
    expect(decisions.record).toHaveBeenCalledWith(
      'project-1',
      'ACCEPT',
      'card-status:card-1',
      { oldStatus: 'PROPOSED', newStatus: 'AMBIGUOUS' },
      transaction,
    );
  });
});
