import { JudgeService } from '../src/judge.service';

describe('JudgeService', () => {
  it('audits the latest context version and bounded input', async () => {
    const contextBuilder = {
      build: jest.fn().mockResolvedValue({ specVersion: 4, inputContext: { problem: 'p', gap: 'g', relatedWork: ['r'] } }),
    };
    const llm = { complete: jest.fn().mockResolvedValue({ output: { issues: [] }, inputTokens: 20, outputTokens: 5 }) };
    const prisma = { llmAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) } };
    const service = new JudgeService(contextBuilder as never, prisma as never, llm);

    await expect(service.runGapJudge('project-1', 'run-1')).resolves.toEqual({ issues: [] });

    expect(llm.complete).toHaveBeenCalledWith('gap-judge', { problem: 'p', gap: 'g', relatedWork: ['r'] });
    expect(prisma.llmAuditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ specVersionUsed: 4, workflowRunId: 'run-1', inputTokens: 20, outputTokens: 5 }) });
  });

  it('runs all five independent judges and audits each task', async () => {
    const contextBuilder = {
      build: jest.fn(async (task: string) => ({ specVersion: 4, inputContext: { task } })),
    };
    const llm = { complete: jest.fn(async (task: string) => ({ output: { task }, inputTokens: 10, outputTokens: 2 })) };
    const prisma = { llmAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit' }) } };
    const service = new JudgeService(contextBuilder as never, prisma as never, llm);

    await expect(service.runPanel('project-1')).resolves.toMatchObject({
      projectId: 'project-1',
      specVersionUsed: 4,
      status: 'COMPLETED',
      judges: expect.arrayContaining([
        expect.objectContaining({ type: 'problem', status: 'COMPLETED' }),
        expect.objectContaining({ type: 'gap', status: 'COMPLETED' }),
        expect.objectContaining({ type: 'contribution', status: 'COMPLETED' }),
        expect.objectContaining({ type: 'claim', status: 'COMPLETED' }),
        expect.objectContaining({ type: 'experiment', status: 'COMPLETED' }),
      ]),
    });
    expect(llm.complete).toHaveBeenCalledTimes(5);
    expect(prisma.llmAuditLog.create).toHaveBeenCalledTimes(5);
  });
});
