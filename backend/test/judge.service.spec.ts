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
});
