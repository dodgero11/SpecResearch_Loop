import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkflowStatus } from '@prisma/client';
import { DependencyGraphService } from '../src/dependency-graph.service';
import { JudgeService } from '../src/judge.service';
import { RecomputeService } from '../src/recompute.service';

describe('RecomputeService', () => {
  function makePrisma(overrides: {
    project?: unknown;
    workflowRun?: unknown;
    specIteration?: unknown;
    specArtifact?: unknown;
  } = {}) {
    const transaction = {
      researchProject: { findUnique: jest.fn().mockResolvedValue(overrides.project ?? null) },
      workflowRun: { findFirst: jest.fn().mockResolvedValue(overrides.workflowRun ?? null) },
      specIteration: { create: jest.fn().mockResolvedValue(overrides.specIteration ?? { id: 'spec-2', projectId: 'project-1', version: 2 }) },
      specArtifact: {
        upsert: jest.fn().mockResolvedValue(overrides.specArtifact ?? {}),
      },
      researchProjectUpdate: jest.fn().mockResolvedValue({}),
    };
    return {
      transaction,
      prisma: {
        researchProject: {
          findUnique: jest.fn().mockResolvedValue(overrides.project ?? null),
          update: jest.fn().mockResolvedValue({}),
        },
        workflowRun: { findFirst: jest.fn().mockResolvedValue(overrides.workflowRun ?? null) },
        specIteration: { create: jest.fn().mockResolvedValue(overrides.specIteration ?? { id: 'spec-2', projectId: 'project-1', version: 2 }) },
        specArtifact: { upsert: jest.fn().mockResolvedValue({}) },
        specCard: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
        specCardLink: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
      },
    };
  }

  function makeService(overrides: {
    project?: unknown;
    workflowRun?: unknown;
    specIteration?: unknown;
    judgeResults?: unknown;
  } = {}) {
    const { prisma } = makePrisma(overrides);
    const judges = {
      runJudge: jest.fn().mockResolvedValue({ type: 'gap', status: 'COMPLETED', specVersionUsed: 2, output: { verdict: 'PASS' } }),
      runPanel: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        specVersionUsed: 2,
        status: 'COMPLETED',
        judges: [
          { type: 'gap', status: 'COMPLETED', specVersionUsed: 2, output: { verdict: 'PASS' } },
          { type: 'contribution', status: 'COMPLETED', specVersionUsed: 2, output: { verdict: 'PASS' } },
          { type: 'experiment', status: 'COMPLETED', specVersionUsed: 2, output: { verdict: 'PASS' } },
          { type: 'evidence', status: 'COMPLETED', specVersionUsed: 2, output: { verdict: 'PASS' } },
          { type: 'conference-readiness', status: 'COMPLETED', specVersionUsed: 2, output: { verdict: 'PASS' } },
        ],
      }),
    };
    const dependencyGraph = new DependencyGraphService();
    const projects = { cloneCardsAndLinks: jest.fn().mockResolvedValue(undefined) };
    const service = new RecomputeService(prisma as never, judges as unknown as JudgeService, dependencyGraph, projects as never);
    return { service, prisma, judges, projects };
  }

  it('throws NotFoundException when project does not exist', async () => {
    const { service } = makeService();
    await expect(service.recompute('missing-project')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when no latest spec exists', async () => {
    const { service } = makeService({ project: { id: 'project-1', latestSpec: null } });
    await expect(service.recompute('project-1')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when a workflow is running', async () => {
    const { service } = makeService({
      project: { id: 'project-1', latestSpec: { id: 'spec-1', version: 1, data: {}, artifacts: [] } },
      workflowRun: { id: 'run-1', status: WorkflowStatus.RUNNING },
    });
    await expect(service.recompute('project-1')).rejects.toThrow(BadRequestException);
  });

  it('returns empty result when no nodes are stale', async () => {
    const { service, prisma } = makeService({
      project: { id: 'project-1', latestSpec: { id: 'spec-1', version: 1, data: {}, artifacts: [] } },
    });

    const result = await service.recompute('project-1');

    expect(result.recomputedNodes).toEqual([]);
    expect(result.judgeResults).toEqual([]);
    expect(prisma.specIteration.create).not.toHaveBeenCalled();
  });

  it('recomputes stale nodes and creates FRESH artifacts', async () => {
    const { service, prisma, judges } = makeService({
      project: {
        id: 'project-1',
        latestSpec: {
          id: 'spec-1',
          version: 1,
          data: {},
          artifacts: [
            { node: 'contribution', status: 'STALE', data: {} },
            { node: 'claim', status: 'STALE', data: {} },
            { node: 'experiment', status: 'STALE', data: {} },
            { node: 'judge', status: 'STALE', data: {} },
          ],
        },
      },
    });

    const result = await service.recompute('project-1');

    expect(result.recomputedNodes).toContain('contribution');
    expect(result.recomputedNodes).toContain('claim');
    expect(result.recomputedNodes).toContain('experiment');
    expect(result.recomputedNodes).toContain('judge');
    expect(judges.runPanel).toHaveBeenCalledWith('project-1');
    expect(judges.runJudge).not.toHaveBeenCalledWith('project-1', 'contribution');
    expect(judges.runJudge).not.toHaveBeenCalledWith('project-1', 'claim');
    expect(judges.runJudge).not.toHaveBeenCalledWith('project-1', 'experiment');
    expect(prisma.specArtifact.upsert).toHaveBeenCalled();
    expect(prisma.specIteration.create).toHaveBeenCalled();
  });

  it('recomputes only user-requested nodes when provided', async () => {
    const { service, judges } = makeService({
      project: {
        id: 'project-1',
        latestSpec: { id: 'spec-1', version: 1, data: {}, artifacts: [] },
      },
    });

    const result = await service.recompute('project-1', ['experiment']);

    expect(result.recomputedNodes).toEqual(['experiment', 'judge']);
    expect(judges.runJudge).not.toHaveBeenCalledWith('project-1', 'experiment');
    expect(judges.runPanel).toHaveBeenCalledWith('project-1');
  });

  it('throws BadRequestException for invalid node names', async () => {
    const { service } = makeService({
      project: {
        id: 'project-1',
        latestSpec: { id: 'spec-1', version: 1, data: {}, artifacts: [] },
      },
    });

    await expect(service.recompute('project-1', ['invalid-node'])).rejects.toThrow(BadRequestException);
  });
});
