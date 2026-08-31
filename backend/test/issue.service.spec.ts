import { DependencyGraphService } from '../src/dependency-graph.service';
import { IssueService } from '../src/issue.service';

describe('IssueService', () => {
  const prisma = {
    judgeIssue: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    specArtifact: { upsert: jest.fn() },
  };
  const projects = { latestSpec: jest.fn() };
  const judges = { runJudge: jest.fn() };
  const dependencyGraph = new DependencyGraphService();
  const service = new IssueService(prisma as never, projects as never, judges as never, dependencyGraph);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('list returns judge issues for the latest spec', async () => {
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1 });
    prisma.judgeIssue.findMany.mockResolvedValue([{ id: 'issue-1', title: 'Thiếu hidden test' }]);

    const result = await service.list('project-1');

    expect(prisma.judgeIssue.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', specIterationId: 'spec-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual([{ id: 'issue-1', title: 'Thiếu hidden test' }]);
  });

  it('resolve marks the issue resolved, invalidates affected nodes, and re-runs the flagging judge', async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue({ id: 'issue-1', projectId: 'project-1', judgeType: 'gap' });
    prisma.judgeIssue.update.mockResolvedValue({ id: 'issue-1', status: 'RESOLVED', resolvedChoice: 'A' });
    projects.latestSpec.mockResolvedValue({ id: 'spec-1', version: 1 });
    prisma.specArtifact.upsert.mockResolvedValue({});
    judges.runJudge.mockResolvedValue({ type: 'gap', status: 'COMPLETED', specVersionUsed: 1, output: { issues: [] } });

    const result = await service.resolve('project-1', 'issue-1', 'A');

    expect(prisma.judgeIssue.update).toHaveBeenCalledWith({
      where: { id: 'issue-1' },
      data: { status: 'RESOLVED', resolvedChoice: 'A', customResolution: undefined },
    });
    expect(prisma.specArtifact.upsert).toHaveBeenCalled();
    expect(judges.runJudge).toHaveBeenCalledWith('project-1', 'gap');
    expect(result.updatedIssue.status).toBe('RESOLVED');
    expect(result.invalidatedNodes).toEqual(expect.arrayContaining(['contribution', 'claim', 'experiment', 'judge']));
  });

  it('resolve throws NotFound for an unknown issue', async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue(null);

    await expect(service.resolve('project-1', 'nope', 'A')).rejects.toThrow('Issue nope was not found');
    expect(judges.runJudge).not.toHaveBeenCalled();
  });
});