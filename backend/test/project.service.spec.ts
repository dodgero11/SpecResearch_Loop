import { DependencyGraphService } from '../src/dependency-graph.service';
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

  function makeService(project: unknown) {
    const { prisma, transaction } = makePrisma(project);
    const dependencyGraph = new DependencyGraphService();
    const service = new ProjectService(prisma as never, dependencyGraph);
    return { service, transaction, prisma };
  }

  it('creates a new immutable version and invalidates Gap dependents', async () => {
    const { service, transaction } = makeService({
      id: 'project-1',
      latestSpec: { id: 'spec-1', version: 1, data: { gap: 'old', problem: 'p' } },
    });

    const result = await service.updateNode('project-1', 'gap', 'new', 'request-1');

    expect(result.version).toBe(2);
    expect(transaction.specIteration.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ version: 2 }) }));
    expect(transaction.specArtifact.create).toHaveBeenCalledTimes(4);
    expect(transaction.idempotencyRecord.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ key: 'request-1' }) }));
  });

  it('returns the stored result for a repeated idempotency key', async () => {
    const stored = { id: 'spec-2', version: 2, data: { gap: 'new' } };
    const { service, transaction } = makeService({ id: 'project-1', latestSpec: { version: 1, data: {} } });
    transaction.idempotencyRecord.findUnique.mockResolvedValue({ result: stored });

    await expect(service.updateNode('project-1', 'gap', 'new', 'request-1')).resolves.toEqual(stored);
    expect(transaction.specIteration.create).not.toHaveBeenCalled();
  });

  it('invalidates all downstream nodes when Problem changes', async () => {
    const { service, transaction } = makeService({
      id: 'project-1',
      latestSpec: { id: 'spec-1', version: 1, data: { problem: 'old' } },
    });

    await service.updateNode('project-1', 'problem', 'new problem');

    expect(transaction.specArtifact.create).toHaveBeenCalledTimes(5);
    const createdNodes = transaction.specArtifact.create.mock.calls.map((call: unknown[]) => (call[0] as { data: { node: string } }).data.node);
    expect(createdNodes).toEqual(expect.arrayContaining(['gap', 'contribution', 'claim', 'experiment', 'judge']));
  });

  it('invalidates claim, experiment, and judge when Contribution changes', async () => {
    const { service, transaction } = makeService({
      id: 'project-1',
      latestSpec: { id: 'spec-1', version: 1, data: { contribution: 'old' } },
    });

    await service.updateNode('project-1', 'contribution', 'new contribution');

    expect(transaction.specArtifact.create).toHaveBeenCalledTimes(3);
    const createdNodes = transaction.specArtifact.create.mock.calls.map((call: unknown[]) => (call[0] as { data: { node: string } }).data.node);
    expect(createdNodes).toEqual(expect.arrayContaining(['claim', 'experiment', 'judge']));
  });

  it('invalidates experiment and judge when Claim changes', async () => {
    const { service, transaction } = makeService({
      id: 'project-1',
      latestSpec: { id: 'spec-1', version: 1, data: { claim: 'old' } },
    });

    await service.updateNode('project-1', 'claim', 'new claim');

    expect(transaction.specArtifact.create).toHaveBeenCalledTimes(2);
    const createdNodes = transaction.specArtifact.create.mock.calls.map((call: unknown[]) => (call[0] as { data: { node: string } }).data.node);
    expect(createdNodes).toEqual(expect.arrayContaining(['experiment', 'judge']));
  });

  it('invalidates only judge when Experiment changes', async () => {
    const { service, transaction } = makeService({
      id: 'project-1',
      latestSpec: { id: 'spec-1', version: 1, data: { experiment: 'old' } },
    });

    await service.updateNode('project-1', 'experiment', 'new experiment');

    expect(transaction.specArtifact.create).toHaveBeenCalledTimes(1);
    const createdNodes = transaction.specArtifact.create.mock.calls.map((call: unknown[]) => (call[0] as { data: { node: string } }).data.node);
    expect(createdNodes).toEqual(['judge']);
  });

  it('does not create artifacts for invalid node names', async () => {
    const { service, transaction } = makeService({
      id: 'project-1',
      latestSpec: { id: 'spec-1', version: 1, data: {} },
    });

    await service.updateNode('project-1', 'custom-field', 'value');

    expect(transaction.specArtifact.create).not.toHaveBeenCalled();
  });

  it('invalidates gap and downstream when related_work changes', async () => {
    const { service, transaction } = makeService({
      id: 'project-1',
      latestSpec: { id: 'spec-1', version: 1, data: { relatedWork: ['old'] } },
    });

    await service.updateNode('project-1', 'related_work', ['new']);

    expect(transaction.specArtifact.create).toHaveBeenCalledTimes(5);
    const createdNodes = transaction.specArtifact.create.mock.calls.map((call: unknown[]) => (call[0] as { data: { node: string } }).data.node);
    expect(createdNodes).toEqual(expect.arrayContaining(['gap', 'contribution', 'claim', 'experiment', 'judge']));
  });
});
