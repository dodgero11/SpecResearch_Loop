import { DependencyGraphService } from "../src/dependency-graph.service";
import { IssueService } from "../src/issue.service";

describe("IssueService", () => {
  const prisma = {
    judgeIssue: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    specCard: { findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const projects = { latestSpec: jest.fn(), createSpec: jest.fn() };
  const judges = { rerunJudge: jest.fn() };
  const decisions = { record: jest.fn() };
  //sửa
  const ai = {
    gapAnalysis: jest.fn(),
    contributionRevision: jest.fn(),
    experimentRevision: jest.fn(),
    evidenceRevision: jest.fn(),
    conferenceReadinessRevision: jest.fn(),
  };
  const dependencyGraph = new DependencyGraphService();
  const service = new IssueService(
    prisma as never,
    projects as never,
    judges as never,
    decisions as never,
    dependencyGraph,
    ai as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("list returns judge issues for the latest spec", async () => {
    projects.latestSpec.mockResolvedValue({ id: "spec-1", version: 1 });
    prisma.judgeIssue.findMany.mockResolvedValue([
      { id: "issue-1", title: "Thiếu hidden test" },
    ]);

    const result = await service.list("project-1");

    expect(prisma.judgeIssue.findMany).toHaveBeenCalledWith({
      where: { projectId: "project-1", specIterationId: "spec-1" },
      orderBy: { createdAt: "asc" },
    });
    expect(result).toEqual([{ id: "issue-1", title: "Thiếu hidden test" }]);
  });

  it("resolve marks the issue resolved and re-runs the flagging judge", async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue({
      id: "issue-1",
      projectId: "project-1",
      judgeType: "contribution",
      specIterationId: "spec-1",
      title: "Issue title",
      description: "Issue description",
      choices: [{ letter: "A", understanding: "Fix" }],
    });
    projects.latestSpec.mockResolvedValue({
      id: "spec-1",
      version: 1,
      data: {
        experimentPlan: {
          contributions: [{ id: "c1", label: "Old" }],
          experiments: [],
        },
        gapAnalysis: { limitation: "gap" },
      },
    });
    prisma.specCard.findMany.mockResolvedValue([
      { type: "PROBLEM", content: "Problem" },
    ]);
    ai.contributionRevision.mockResolvedValue({
      output: { revised_content: [{ id: "c1", label: "New" }], summary: "s" },
    });
    projects.createSpec.mockResolvedValue({ id: "spec-2", version: 2 });
    judges.rerunJudge.mockResolvedValue({
      type: "contribution",
      status: "COMPLETED",
      specVersionUsed: 1,
      output: { issues: [] },
    });
    const tx = {
      judgeIssue: {
        update: jest.fn().mockResolvedValue({
          id: "issue-1",
          status: "RESOLVED",
          resolvedChoice: "A",
        }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );

    const result = await service.resolve("project-1", "issue-1", "A");

    expect(tx.judgeIssue.update).toHaveBeenCalledWith({
      where: { id: "issue-1" },
      data: {
        status: "RESOLVED",
        resolvedChoice: "A",
        customResolution: undefined,
      },
    });
    expect(decisions.record).toHaveBeenCalledWith(
      "project-1",
      "ACCEPT",
      "issue:issue-1",
      { choice: "A", customChoice: undefined },
      tx,
    );
    // [FE-fix] resolve() no longer auto-reruns the flagging judge — see the
    // comment above `return { updatedIssue, ... }` in issue.service.ts for why.
    // expect(judges.rerunJudge).toHaveBeenCalledWith(
    //   "project-1",
    //   "contribution",
    // );
    expect(judges.rerunJudge).not.toHaveBeenCalled();
    expect(result.updatedIssue.status).toBe("RESOLVED");
    expect(result.invalidatedNodes).toEqual(
      expect.arrayContaining(["contribution", "claim", "experiment", "judge"]),
    );
  });

  it("resolve updates the cloned issue on the new spec version for a gap issue", async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue({
      id: "issue-1",
      projectId: "project-1",
      judgeType: "gap",
      specIterationId: "spec-1",
      title: "Gap issue",
      description: "Gap description",
      choices: [{ letter: "A", understanding: "Thu hẹp phạm vi" }],
    });
    projects.latestSpec
      .mockResolvedValueOnce({
        id: "spec-1",
        version: 1,
        data: { gapAnalysis: { limitation: "old" }, relatedWork: [] },
      })
      .mockResolvedValueOnce({
        id: "spec-2",
        version: 2,
        data: { gapAnalysis: { limitation: "new" } },
      });
    prisma.specCard.findMany.mockResolvedValue([
      { type: "GAP_CANDIDATE", content: "Gap candidate" },
    ]);
    ai.gapAnalysis.mockResolvedValue({
      output: {
        what_was_done: "done",
        limitation: "new limitation",
        why_it_matters: "matters",
        testable_with: "test",
        directions: [{ letter: "A", label: "Dir A" }],
      },
    });
    projects.createSpec.mockResolvedValue({ id: "spec-2", version: 2 });
    judges.rerunJudge.mockResolvedValue({
      type: "gap",
      status: "COMPLETED",
      specVersionUsed: 2,
      output: { issues: [] },
    });
    const tx = {
      judgeIssue: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "OPEN" }),
        update: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "RESOLVED" }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );

    const result = await service.resolve("project-1", "issue-1", "A");

    expect(ai.gapAnalysis).toHaveBeenCalledWith(
      "Gap candidate",
      [],
      "Thu hẹp phạm vi",
    );
    expect(projects.createSpec).toHaveBeenCalledWith("project-1", {
      gapAnalysis: {
        whatWasDone: "done",
        limitation: "new limitation",
        whyItMatters: "matters",
        testableWith: "test",
        directions: [{ letter: "A", label: "Dir A" }],
      },
      relatedWork: [],
    });
    expect(tx.judgeIssue.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        specIterationId: "spec-2",
        judgeType: "gap",
        title: "Gap issue",
        description: "Gap description",
        status: { not: "RESOLVED" },
      },
    });
    expect(tx.judgeIssue.update).toHaveBeenCalledWith({
      where: { id: "issue-2" },
      data: {
        status: "RESOLVED",
        resolvedChoice: "A",
        customResolution: undefined,
      },
    });
    // expect(judges.rerunJudge).toHaveBeenCalledWith("project-1", "gap");
    expect(judges.rerunJudge).not.toHaveBeenCalled();
    expect(result.after).toEqual({
      whatWasDone: "done",
      limitation: "new limitation",
      whyItMatters: "matters",
      testableWith: "test",
      directions: [{ letter: "A", label: "Dir A" }],
    });
  });

  it("resolve updates the clone on the latest version when the issue id is stale", async () => {
    // The frontend may hold an issue id from an older spec version (e.g. a gap
    // resolve created a new version and cloned issues forward). Resolving a
    // non-gap issue with a stale id must update the clone on the latest version.
    prisma.judgeIssue.findFirst.mockResolvedValue({
      id: "issue-1",
      projectId: "project-1",
      judgeType: "contribution",
      specIterationId: "spec-1",
      title: "Contribution issue",
      description: "Contribution description",
      choices: [{ letter: "A", understanding: "Fix" }],
    });
    projects.latestSpec.mockResolvedValue({
      id: "spec-2",
      version: 2,
      data: {
        experimentPlan: {
          contributions: [{ id: "c1", label: "Old" }],
          experiments: [],
        },
        gapAnalysis: { limitation: "gap" },
      },
    });
    prisma.specCard.findMany.mockResolvedValue([
      { type: "PROBLEM", content: "Problem" },
    ]);
    ai.contributionRevision.mockResolvedValue({
      output: { revised_content: [{ id: "c1", label: "New" }], summary: "s" },
    });
    projects.createSpec.mockResolvedValue({ id: "spec-3", version: 3 });
    judges.rerunJudge.mockResolvedValue({
      type: "contribution",
      status: "COMPLETED",
      specVersionUsed: 2,
      output: { issues: [] },
    });
    const tx = {
      judgeIssue: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "OPEN" }),
        update: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "RESOLVED" }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );

    const result = await service.resolve("project-1", "issue-1", "A");

    expect(tx.judgeIssue.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        specIterationId: "spec-2",
        judgeType: "contribution",
        title: "Contribution issue",
        description: "Contribution description",
        status: { not: "RESOLVED" },
      },
    });
    expect(tx.judgeIssue.update).toHaveBeenCalledWith({
      where: { id: "issue-2" },
      data: {
        status: "RESOLVED",
        resolvedChoice: "A",
        customResolution: undefined,
      },
    });
    // expect(judges.rerunJudge).toHaveBeenCalledWith(
    //   "project-1",
    //   "contribution",
    // );
    expect(judges.rerunJudge).not.toHaveBeenCalled();
    expect(result.updatedIssue.status).toBe("RESOLVED");
  });

  it("resolve rewrites contributions for a contribution issue", async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue({
      id: "issue-1",
      projectId: "project-1",
      judgeType: "contribution",
      specIterationId: "spec-1",
      title: "Contribution issue",
      description: "Contribution description",
      choices: [{ letter: "A", understanding: "Thu hẹp phạm vi" }],
    });
    projects.latestSpec
      .mockResolvedValueOnce({
        id: "spec-1",
        version: 1,
        data: {
          experimentPlan: {
            contributions: [{ id: "c1", label: "Old contribution" }],
            experiments: [],
          },
          gapAnalysis: { limitation: "gap" },
        },
      })
      .mockResolvedValueOnce({ id: "spec-2", version: 2, data: {} });
    prisma.specCard.findMany.mockResolvedValue([
      { type: "PROBLEM", content: "Problem" },
    ]);
    ai.contributionRevision.mockResolvedValue({
      output: {
        revised_content: [{ id: "c1", label: "New contribution" }],
        summary: "s",
      },
    });
    projects.createSpec.mockResolvedValue({ id: "spec-2", version: 2 });
    judges.rerunJudge.mockResolvedValue({
      type: "contribution",
      status: "COMPLETED",
      specVersionUsed: 2,
      output: { issues: [] },
    });
    const tx = {
      judgeIssue: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "OPEN" }),
        update: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "RESOLVED" }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );

    const result = await service.resolve("project-1", "issue-1", "A");

    expect(ai.contributionRevision).toHaveBeenCalledWith(
      [{ id: "c1", label: "Old contribution" }],
      "Thu hẹp phạm vi",
      { problem: "Problem", gap: "gap" },
    );
    expect(projects.createSpec).toHaveBeenCalledWith("project-1", {
      experimentPlan: {
        contributions: [{ id: "c1", label: "New contribution" }],
        experiments: [],
      },
      gapAnalysis: { limitation: "gap" },
    });
    // expect(judges.rerunJudge).toHaveBeenCalledWith(
    //   "project-1",
    //   "contribution",
    // );
    expect(judges.rerunJudge).not.toHaveBeenCalled();
    expect(result.after).toEqual([{ id: "c1", label: "New contribution" }]);
  });

  it("resolve rewrites experiments for an experiment issue", async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue({
      id: "issue-1",
      projectId: "project-1",
      judgeType: "experiment",
      specIterationId: "spec-1",
      title: "Experiment issue",
      description: "Experiment description",
      choices: [{ letter: "A", understanding: "Bổ sung protocol" }],
    });
    projects.latestSpec
      .mockResolvedValueOnce({
        id: "spec-1",
        version: 1,
        data: {
          experimentPlan: {
            contributions: [],
            experiments: [{ name: "TN1", protocol: "old" }],
          },
          gapAnalysis: { limitation: "gap" },
        },
      })
      .mockResolvedValueOnce({ id: "spec-2", version: 2, data: {} });
    prisma.specCard.findMany.mockResolvedValue([
      { type: "PROBLEM", content: "Problem" },
    ]);
    ai.experimentRevision.mockResolvedValue({
      output: {
        revised_content: [{ name: "TN1", protocol: "new" }],
        summary: "s",
      },
    });
    projects.createSpec.mockResolvedValue({ id: "spec-2", version: 2 });
    judges.rerunJudge.mockResolvedValue({
      type: "experiment",
      status: "COMPLETED",
      specVersionUsed: 2,
      output: { issues: [] },
    });
    const tx = {
      judgeIssue: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "OPEN" }),
        update: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "RESOLVED" }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );

    const result = await service.resolve("project-1", "issue-1", "A");

    expect(ai.experimentRevision).toHaveBeenCalledWith(
      [{ name: "TN1", protocol: "old" }],
      "Bổ sung protocol",
      { problem: "Problem", gap: "gap" },
    );
    expect(projects.createSpec).toHaveBeenCalledWith("project-1", {
      experimentPlan: {
        contributions: [],
        experiments: [{ name: "TN1", protocol: "new" }],
      },
      gapAnalysis: { limitation: "gap" },
    });
    // expect(judges.rerunJudge).toHaveBeenCalledWith("project-1", "experiment");
    expect(judges.rerunJudge).not.toHaveBeenCalled();
    expect(result.after).toEqual([{ name: "TN1", protocol: "new" }]);
  });

  it("resolve rewrites claim-evidence pairs for an evidence issue", async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue({
      id: "issue-1",
      projectId: "project-1",
      judgeType: "evidence",
      specIterationId: "spec-1",
      title: "Evidence issue",
      description: "Evidence description",
      choices: [{ letter: "A", understanding: "Bổ sung mã arXiv" }],
    });
    projects.latestSpec
      .mockResolvedValueOnce({
        id: "spec-1",
        version: 1,
        data: {
          experimentPlan: {
            contributions: [
              {
                id: "c1",
                label: "C1",
                claimEvidence: { claim: "Claim 1", evidence: "old" },
              },
            ],
            experiments: [],
          },
          gapAnalysis: { limitation: "gap" },
        },
      })
      .mockResolvedValueOnce({ id: "spec-2", version: 2, data: {} });
    prisma.specCard.findMany.mockResolvedValue([
      { type: "PROBLEM", content: "Problem" },
    ]);
    ai.evidenceRevision.mockResolvedValue({
      output: {
        revised_content: [{ claim: "Claim 1", evidence: "new" }],
        summary: "s",
      },
    });
    projects.createSpec.mockResolvedValue({ id: "spec-2", version: 2 });
    judges.rerunJudge.mockResolvedValue({
      type: "evidence",
      status: "COMPLETED",
      specVersionUsed: 2,
      output: { issues: [] },
    });
    const tx = {
      judgeIssue: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "OPEN" }),
        update: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "RESOLVED" }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );

    const result = await service.resolve("project-1", "issue-1", "A");

    expect(ai.evidenceRevision).toHaveBeenCalledWith(
      [{ claim: "Claim 1", evidence: "old" }],
      "Bổ sung mã arXiv",
      { problem: "Problem", gap: "gap" },
    );
    expect(projects.createSpec).toHaveBeenCalledWith("project-1", {
      experimentPlan: {
        contributions: [
          {
            id: "c1",
            label: "C1",
            claimEvidence: { claim: "Claim 1", evidence: "new" },
          },
        ],
        experiments: [],
      },
      gapAnalysis: { limitation: "gap" },
    });
    // expect(judges.rerunJudge).toHaveBeenCalledWith("project-1", "evidence");
    expect(judges.rerunJudge).not.toHaveBeenCalled();
    expect(result.after).toEqual([{ claim: "Claim 1", evidence: "new" }]);
  });

  it("resolve applies a cross-cutting revision for a conference-readiness issue", async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue({
      id: "issue-1",
      projectId: "project-1",
      judgeType: "conference-readiness",
      specIterationId: "spec-1",
      title: "Readiness issue",
      description: "Readiness description",
      choices: [{ letter: "A", understanding: "Cải thiện clarity" }],
    });
    projects.latestSpec
      .mockResolvedValueOnce({
        id: "spec-1",
        version: 1,
        data: {
          experimentPlan: { contributions: [], experiments: [] },
          gapAnalysis: { limitation: "gap" },
          relatedWork: [],
        },
      })
      .mockResolvedValueOnce({ id: "spec-2", version: 2, data: {} });
    prisma.specCard.findMany.mockResolvedValue([
      { type: "PROBLEM", content: "Problem" },
    ]);
    ai.conferenceReadinessRevision.mockResolvedValue({
      output: {
        revised_content: {
          gapAnalysis: { limitation: "new gap" },
          experimentPlan: { contributions: [], experiments: [] },
        },
        summary: "s",
      },
    });
    projects.createSpec.mockResolvedValue({ id: "spec-2", version: 2 });
    judges.rerunJudge.mockResolvedValue({
      type: "conference-readiness",
      status: "COMPLETED",
      specVersionUsed: 2,
      output: { issues: [] },
    });
    const tx = {
      judgeIssue: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "OPEN" }),
        update: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "RESOLVED" }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );

    const result = await service.resolve("project-1", "issue-1", "A");

    expect(ai.conferenceReadinessRevision).toHaveBeenCalledWith(
      {
        gapAnalysis: { limitation: "gap" },
        experimentPlan: { contributions: [], experiments: [] },
        relatedWork: [],
      },
      "Cải thiện clarity",
      { problem: "Problem", gap: "gap" },
    );
    expect(projects.createSpec).toHaveBeenCalledWith("project-1", {
      experimentPlan: { contributions: [], experiments: [] },
      gapAnalysis: { limitation: "new gap" },
      relatedWork: [],
    });
    // expect(judges.rerunJudge).toHaveBeenCalledWith(
    //   "project-1",
    //   "conference-readiness",
    // );
    expect(judges.rerunJudge).not.toHaveBeenCalled();
    expect(result.after).toEqual({
      gapAnalysis: { limitation: "new gap" },
      experimentPlan: { contributions: [], experiments: [] },
    });
  });

  it("resolve preserves gapAnalysis when conference-readiness AI returns empty content", async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue({
      id: "issue-1",
      projectId: "project-1",
      judgeType: "conference-readiness",
      specIterationId: "spec-1",
      title: "Readiness issue",
      description: "Readiness description",
      choices: [{ letter: "A", understanding: "Cải thiện clarity" }],
    });
    projects.latestSpec.mockResolvedValue({
      id: "spec-1",
      version: 1,
      data: {
        experimentPlan: { contributions: [], experiments: [] },
        gapAnalysis: { limitation: "original gap" },
        relatedWork: [],
      },
    });
    prisma.specCard.findMany.mockResolvedValue([
      { type: "PROBLEM", content: "Problem" },
    ]);
    // AI returns empty content on every attempt.
    ai.conferenceReadinessRevision.mockResolvedValue({
      output: { revised_content: {}, summary: "s" },
    });
    judges.rerunJudge.mockResolvedValue({
      type: "conference-readiness",
      status: "COMPLETED",
      specVersionUsed: 1,
      output: { issues: [] },
    });
    const tx = {
      judgeIssue: {
        update: jest
          .fn()
          .mockResolvedValue({ id: "issue-1", status: "RESOLVED" }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );

    const result = await service.resolve("project-1", "issue-1", "A");

    // No spec write happens — the existing gap is preserved (not wiped).
    expect(projects.createSpec).not.toHaveBeenCalled();
    expect(ai.conferenceReadinessRevision).toHaveBeenCalledTimes(3);
    expect(result.after).toBeUndefined();
  });

  it("resolve syncs the CONTRIBUTION seed card with the revised contributions", async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue({
      id: "issue-1",
      projectId: "project-1",
      judgeType: "contribution",
      specIterationId: "spec-1",
      title: "Contribution issue",
      description: "Contribution description",
      choices: [{ letter: "A", understanding: "Thu hẹp phạm vi" }],
    });
    projects.latestSpec
      .mockResolvedValueOnce({
        id: "spec-1",
        version: 1,
        data: {
          experimentPlan: {
            contributions: [{ id: "c1", label: "Old contribution" }],
            experiments: [],
          },
          gapAnalysis: { limitation: "gap" },
        },
      })
      .mockResolvedValueOnce({ id: "spec-2", version: 2, data: {} });
    prisma.specCard.findMany.mockResolvedValue([
      { type: "PROBLEM", content: "Problem", isSeed: true },
      { id: "card-1", type: "CONTRIBUTION", content: "Old", isSeed: true },
    ]);
    ai.contributionRevision.mockResolvedValue({
      output: {
        revised_content: [{ id: "c1", label: "New contribution" }],
        summary: "s",
      },
    });
    projects.createSpec.mockResolvedValue({ id: "spec-2", version: 2 });
    judges.rerunJudge.mockResolvedValue({
      type: "contribution",
      status: "COMPLETED",
      specVersionUsed: 2,
      output: { issues: [] },
    });
    const tx = {
      judgeIssue: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "OPEN" }),
        update: jest
          .fn()
          .mockResolvedValue({ id: "issue-2", status: "RESOLVED" }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );

    await service.resolve("project-1", "issue-1", "A");

    expect(prisma.specCard.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { content: "New contribution" },
    });
  });

  it("resolve still records the decision when the gap rewrite fails", async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue({
      id: "issue-1",
      projectId: "project-1",
      judgeType: "gap",
      specIterationId: "spec-1",
      title: "Gap issue",
      description: "Gap description",
      choices: [],
    });
    projects.latestSpec.mockResolvedValue({
      id: "spec-1",
      version: 1,
      data: { gapAnalysis: { limitation: "old" } },
    });
    prisma.specCard.findMany.mockResolvedValue([]);
    ai.gapAnalysis.mockRejectedValue(new Error("AI down"));
    judges.rerunJudge.mockResolvedValue({
      type: "gap",
      status: "FAILED",
      specVersionUsed: 1,
      error: "AI down",
    });
    const tx = {
      judgeIssue: {
        update: jest
          .fn()
          .mockResolvedValue({ id: "issue-1", status: "RESOLVED" }),
      },
      decisionLog: { create: jest.fn().mockResolvedValue({}) },
      researchProject: {
        findUnique: jest.fn().mockResolvedValue({ id: "project-1" }),
      },
    };
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) =>
      cb(tx),
    );

    const result = await service.resolve("project-1", "issue-1", "A");

    expect(projects.createSpec).not.toHaveBeenCalled();
    expect(tx.judgeIssue.update).toHaveBeenCalledWith({
      where: { id: "issue-1" },
      data: {
        status: "RESOLVED",
        resolvedChoice: "A",
        customResolution: undefined,
      },
    });
    expect(decisions.record).toHaveBeenCalled();
    expect(result.before).toBeUndefined();
    expect(result.after).toBeUndefined();
  });

  it("resolve throws NotFound for an unknown issue", async () => {
    prisma.judgeIssue.findFirst.mockResolvedValue(null);

    await expect(service.resolve("project-1", "nope", "A")).rejects.toThrow(
      "Issue nope was not found",
    );
    expect(judges.rerunJudge).not.toHaveBeenCalled();
  });
});
