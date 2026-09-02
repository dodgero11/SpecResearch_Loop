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
    const prisma = {
      llmAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
      specIteration: { findFirst: jest.fn().mockResolvedValue({ id: 'spec-1' }) },
      judgeIssue: {
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'issue-1' }),
      },
      specArtifact: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = new JudgeService(contextBuilder as never, prisma as never, llm);

    await expect(service.runPanel('project-1')).resolves.toMatchObject({
      projectId: 'project-1',
      specVersionUsed: 4,
      status: 'COMPLETED',
      judges: expect.arrayContaining([
        expect.objectContaining({ type: 'gap', status: 'COMPLETED' }),
        expect.objectContaining({ type: 'contribution', status: 'COMPLETED' }),
        expect.objectContaining({ type: 'experiment', status: 'COMPLETED' }),
        expect.objectContaining({ type: 'evidence', status: 'COMPLETED' }),
        expect.objectContaining({ type: 'conference-readiness', status: 'COMPLETED' }),
      ]),
    });
    expect(llm.complete).toHaveBeenCalledTimes(5);
    expect(prisma.llmAuditLog.create).toHaveBeenCalledTimes(5);
  });

  it('uses a single batched panel call when the port supports completePanel', async () => {
    const panelJudges = ['gap', 'contribution', 'experiment', 'evidence', 'conference-readiness'].map((type) => ({
      type,
      verdict: 'ACCEPT',
      issues: [],
    }));
    const contextBuilder = {
      build: jest.fn(),
      buildPanel: jest.fn().mockResolvedValue({ specVersion: 7, inputContext: { problem: 'p', gap: 'g' } }),
    };
    const llm = {
      complete: jest.fn(),
      completePanel: jest.fn().mockResolvedValue({ output: { status: 'COMPLETED', judges: panelJudges } }),
    };
    const prisma = {
      llmAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
      specIteration: { findFirst: jest.fn().mockResolvedValue({ id: 'spec-1' }) },
      judgeIssue: {
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'issue-1' }),
      },
      specArtifact: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = new JudgeService(contextBuilder as never, prisma as never, llm);

    const result = await service.runPanel('project-1', 'run-2');

    expect(contextBuilder.buildPanel).toHaveBeenCalledWith('project-1');
    expect(llm.completePanel).toHaveBeenCalledTimes(1);
    expect(llm.completePanel).toHaveBeenCalledWith('judges-panel', { problem: 'p', gap: 'g' });
    expect(llm.complete).not.toHaveBeenCalled();
    expect(prisma.llmAuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.llmAuditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ task: 'judges-panel', specVersionUsed: 7, workflowRunId: 'run-2' }) });
    expect(result).toMatchObject({ projectId: 'project-1', specVersionUsed: 7, status: 'COMPLETED' });
    expect(result.judges).toHaveLength(5);
    expect(result.judges.every((judge) => judge.status === 'COMPLETED' && judge.specVersionUsed === 7)).toBe(true);
    expect(result.judges.find((judge) => judge.type === 'gap')?.output).toEqual({ type: 'gap', verdict: 'ACCEPT', issues: [] });
  });

  it('marks every judge failed when the batched panel call rejects', async () => {
    const contextBuilder = {
      build: jest.fn(),
      buildPanel: jest.fn().mockResolvedValue({ specVersion: 3, inputContext: {} }),
    };
    const llm = {
      complete: jest.fn(),
      completePanel: jest.fn().mockRejectedValue(new Error('AI service unreachable')),
    };
    const prisma = {
      llmAuditLog: { create: jest.fn() },
      specIteration: { findFirst: jest.fn().mockResolvedValue({ id: 'spec-1' }) },
      judgeIssue: { create: jest.fn().mockResolvedValue({ id: 'issue-1' }) },
    };
    const service = new JudgeService(contextBuilder as never, prisma as never, llm);

    const result = await service.runPanel('project-1');

    expect(result.status).toBe('PARTIAL_FAILURE');
    expect(result.judges).toHaveLength(5);
    expect(result.judges.every((judge) => judge.status === 'FAILED' && judge.error === 'AI service unreachable')).toBe(true);
    expect(prisma.llmAuditLog.create).not.toHaveBeenCalled();
  });

  it('marks only the missing judge failed when the panel response is incomplete', async () => {
    const contextBuilder = {
      build: jest.fn(),
      buildPanel: jest.fn().mockResolvedValue({ specVersion: 2, inputContext: {} }),
    };
    const llm = {
      complete: jest.fn(),
      completePanel: jest.fn().mockResolvedValue({
        output: { status: 'COMPLETED', judges: [{ type: 'gap', verdict: 'ACCEPT', issues: [] }] },
      }),
    };
    const prisma = {
      llmAuditLog: { create: jest.fn() },
      specIteration: { findFirst: jest.fn().mockResolvedValue({ id: 'spec-1' }) },
      judgeIssue: {
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'issue-1' }),
      },
    };
    const service = new JudgeService(contextBuilder as never, prisma as never, llm);

    const result = await service.runPanel('project-1');

    expect(result.status).toBe('PARTIAL_FAILURE');
    expect(result.judges.find((judge) => judge.type === 'gap')).toMatchObject({ status: 'COMPLETED' });
    expect(result.judges.find((judge) => judge.type === 'evidence')).toMatchObject({ status: 'FAILED' });
  });

  it('keeps RESOLVED issues resolved, updates OPEN ones, and deletes OPEN ones no longer flagged', async () => {
    const contextBuilder = {
      build: jest.fn(),
      buildPanel: jest.fn().mockResolvedValue({ specVersion: 5, inputContext: {} }),
    };
    const llm = {
      complete: jest.fn(),
      completePanel: jest.fn().mockResolvedValue({
        output: {
          status: 'COMPLETED',
          judges: [
            {
              type: 'gap',
              verdict: 'REVIEW_REQUIRED',
              issues: [
                {
                  severity: 'MAJOR',
                  title: 'Same issue',
                  description: 'Same desc',
                  suggestion: 'Fix it',
                  choices: [{ letter: 'A', label: 'Fix', understanding: 'u' }],
                },
              ],
            },
          ],
        },
      }),
    };
    const prisma = {
      llmAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
      specIteration: { findFirst: jest.fn().mockResolvedValue({ id: 'spec-1' }) },
      judgeIssue: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'resolved-1', status: 'RESOLVED', title: 'Same issue', description: 'Same desc' },
          { id: 'open-1', status: 'OPEN', title: 'Old issue', description: 'Old desc' },
        ]),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'new-1' }),
      },
      specArtifact: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = new JudgeService(contextBuilder as never, prisma as never, llm);

    await service.runPanel('project-1');

    // The OPEN issue the judge no longer flags is deleted.
    expect(prisma.judgeIssue.delete).toHaveBeenCalledWith({ where: { id: 'open-1' } });
    // The RESOLVED issue matching the re-flagged issue is NOT touched (the
    // user's decision stands even though the judge flags it again).
    expect(prisma.judgeIssue.update).not.toHaveBeenCalled();
    // No new issue is created — the flagged issue matched the resolved row.
    expect(prisma.judgeIssue.create).not.toHaveBeenCalled();
  });

  it('adds fallback choices and an Other option when the judge gives none', async () => {
    const contextBuilder = {
      build: jest.fn(),
      buildPanel: jest.fn().mockResolvedValue({ specVersion: 6, inputContext: {} }),
    };
    const llm = {
      complete: jest.fn(),
      completePanel: jest.fn().mockResolvedValue({
        output: {
          status: 'COMPLETED',
          judges: [
            {
              type: 'evidence',
              verdict: 'REVIEW_REQUIRED',
              issues: [{ severity: 'MINOR', title: 'No choices', description: 'Desc only' }],
            },
          ],
        },
      }),
    };
    const prisma = {
      llmAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
      specIteration: { findFirst: jest.fn().mockResolvedValue({ id: 'spec-1' }) },
      judgeIssue: {
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'issue-1' }),
      },
      specArtifact: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = new JudgeService(contextBuilder as never, prisma as never, llm);

    await service.runPanel('project-1');

    expect(prisma.judgeIssue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        judgeType: 'evidence',
        title: 'No choices',
        description: 'Desc only',
        suggestion: 'Desc only',
        choices: [
          { letter: 'A', label: 'Áp dụng đề xuất của Judge', understanding: 'Áp dụng gợi ý sửa đổi mà Judge đưa ra.' },
          { letter: 'B', label: 'Giữ nguyên nội dung hiện tại', understanding: 'Chấp nhận nội dung hiện tại, không sửa đổi.' },
          { letter: 'C', label: 'Other', understanding: 'Tự nhập phương án xử lý.' },
        ],
      }),
    });
  });

  it('rerunJudge persists issues and merges the result into the judge artifact', async () => {
    const contextBuilder = {
      build: jest.fn().mockResolvedValue({ specVersion: 3, inputContext: { problem: 'p' } }),
    };
    const llm = {
      complete: jest.fn().mockResolvedValue({
        output: {
          type: 'gap',
          verdict: 'REVIEW_REQUIRED',
          issues: [{ severity: 'MAJOR', title: 'T', description: 'D', suggestion: 'S' }],
        },
        inputTokens: 1,
        outputTokens: 1,
      }),
    };
    const prisma = {
      llmAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
      specIteration: { findFirst: jest.fn().mockResolvedValue({ id: 'spec-1' }) },
      judgeIssue: {
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'issue-1' }),
      },
      specArtifact: {
        findUnique: jest.fn().mockResolvedValue({
          data: { judges: [{ type: 'contribution', status: 'COMPLETED' }] },
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new JudgeService(contextBuilder as never, prisma as never, llm);

    const result = await service.rerunJudge('project-1', 'gap');

    expect(result.status).toBe('COMPLETED');
    // Persisted the re-run issue.
    expect(prisma.judgeIssue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ judgeType: 'gap', title: 'T', description: 'D' }),
    });
    // Merged into the judge artifact (contribution kept, gap replaced) and FRESH.
    expect(prisma.specArtifact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: 'FRESH',
          data: {
            judges: expect.arrayContaining([
              expect.objectContaining({ type: 'contribution' }),
              expect.objectContaining({ type: 'gap' }),
            ]),
          },
        }),
      }),
    );
  });
});
