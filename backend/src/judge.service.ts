import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ContextBuilderService } from "./context-builder.service";
import { sliceJudge } from "./integrations/ai-payload-mapper";
import { LlmPort, LlmResponse } from "./integrations/llm.port";
import { PrismaService } from "./prisma.service";

export const LLM_PORT = Symbol("LLM_PORT");

export const JUDGE_TYPES = [
  "gap",
  "contribution",
  "experiment",
  "evidence",
  "conference-readiness",
] as const;
export type JudgeType = (typeof JUDGE_TYPES)[number];
export type JudgeTask = `${JudgeType}-judge`;
export type JudgeResult = {
  type: JudgeType;
  status: "COMPLETED" | "FAILED";
  specVersionUsed: number;
  output?: Record<string, unknown>;
  error?: string;
};
export type JudgePanelResult = {
  projectId: string;
  specVersionUsed: number;
  status: "COMPLETED" | "PARTIAL_FAILURE";
  judges: JudgeResult[];
};

@Injectable()
export class JudgeService {
  constructor(
    private readonly contextBuilder: ContextBuilderService,
    private readonly prisma: PrismaService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
  ) {}

  async runJudge(
    projectId: string,
    type: JudgeType,
    workflowRunId?: string,
  ): Promise<JudgeResult> {
    const task = `${type}-judge` as JudgeTask;
    const context = await this.contextBuilder.build(task, projectId);
    try {
      const response = await this.llm.complete(
        task,
        context.inputContext as Record<string, unknown>,
      );
      await this.audit(
        projectId,
        workflowRunId,
        task,
        context.specVersion,
        context.inputContext,
        response.inputTokens,
        response.outputTokens,
      );
      return {
        type,
        status: "COMPLETED",
        specVersionUsed: context.specVersion,
        output: response.output,
      };
    } catch (error) {
      return {
        type,
        status: "FAILED",
        specVersionUsed: context.specVersion,
        error: this.errorMessage(error),
      };
    }
  }

  async runGapJudge(
    projectId: string,
    workflowRunId?: string,
  ): Promise<Record<string, unknown>> {
    const result = await this.runJudge(projectId, "gap", workflowRunId);
    if (result.status === "FAILED") throw new Error(result.error);
    return result.output ?? {};
  }

  async runPanel(
    projectId: string,
    workflowRunId?: string,
  ): Promise<JudgePanelResult> {
    const completePanel = this.llm.completePanel?.bind(this.llm);
    if (typeof completePanel === "function") {
      return this.runPanelBatched(projectId, workflowRunId, completePanel);
    }
    const results = await Promise.all(
      JUDGE_TYPES.map((type) => this.runJudge(projectId, type, workflowRunId)),
    );
    const versions = new Set(results.map((result) => result.specVersionUsed));
    const failed = results.some((result) => result.status === "FAILED");
    const panel: JudgePanelResult = {
      projectId,
      specVersionUsed: results[0]?.specVersionUsed ?? 0,
      status: failed || versions.size > 1 ? "PARTIAL_FAILURE" : "COMPLETED",
      judges: results,
    };
    await this.persistIssues(projectId, panel.specVersionUsed, results);
    if (panel.status === "COMPLETED") {
      await this.persistJudgeArtifact(
        projectId,
        panel.specVersionUsed,
        results,
      );
    }
    return panel;
  }

  /**
   * Single remote panel call (port supports batching) instead of five per-judge
   * calls. The AI service only exposes the judges as one panel endpoint, so this
   * avoids running the whole panel five times.
   */
  private async runPanelBatched(
    projectId: string,
    workflowRunId: string | undefined,
    completePanel: (
      task: string,
      inputContext: Record<string, unknown>,
    ) => Promise<LlmResponse>,
  ): Promise<JudgePanelResult> {
    const context = await this.contextBuilder.buildPanel(projectId);
    try {
      const response = await completePanel(
        "judges-panel",
        context.inputContext as Record<string, unknown>,
      );
      await this.audit(
        projectId,
        workflowRunId,
        "judges-panel",
        context.specVersion,
        context.inputContext,
        response.inputTokens,
        response.outputTokens,
      );
      const judges = JUDGE_TYPES.map((type) =>
        this.slicePanelJudge(response.output, type, context.specVersion),
      );
      const failed = judges.some((judge) => judge.status === "FAILED");
      const panel: JudgePanelResult = {
        projectId,
        specVersionUsed: context.specVersion,
        status: failed ? "PARTIAL_FAILURE" : "COMPLETED",
        judges,
      };
      await this.persistIssues(projectId, panel.specVersionUsed, judges);
      if (panel.status === "COMPLETED") {
        await this.persistJudgeArtifact(
          projectId,
          panel.specVersionUsed,
          judges,
        );
      }
      return panel;
    } catch (error) {
      const message = this.errorMessage(error);
      return {
        projectId,
        specVersionUsed: context.specVersion,
        status: "PARTIAL_FAILURE",
        judges: JUDGE_TYPES.map((type) => ({
          type,
          status: "FAILED" as const,
          specVersionUsed: context.specVersion,
          error: message,
        })),
      };
    }
  }

  private slicePanelJudge(
    output: Record<string, unknown>,
    type: JudgeType,
    specVersion: number,
  ): JudgeResult {
    try {
      return {
        type,
        status: "COMPLETED",
        specVersionUsed: specVersion,
        output: sliceJudge(output, type),
      };
    } catch {
      return {
        type,
        status: "FAILED",
        specVersionUsed: specVersion,
        error: `AI service panel response did not include a "${type}" judge result`,
      };
    }
  }

  private async audit(
    projectId: string,
    workflowRunId: string | undefined,
    task: string,
    specVersionUsed: number,
    inputContext: unknown,
    inputTokens?: number,
    outputTokens?: number,
  ): Promise<void> {
    await this.prisma.llmAuditLog.create({
      data: {
        projectId,
        workflowRunId,
        task,
        specVersionUsed,
        inputContext: inputContext as Prisma.InputJsonValue,
        inputTokens,
        outputTokens,
      },
    });
  }

  /**
   * Persists judge issues as stable JudgeIssue rows so the frontend can resolve
   * them by id. Persistence is idempotent by issue identity (judgeType + title +
   * description): a re-run that flags the same issue updates the existing row
   * instead of recreating it, and a RESOLVED issue stays RESOLVED even if the
   * judge flags it again (the user's decision stands). OPEN issues the judge no
   * longer flags are removed. A failed judge keeps its previously persisted
   * issues instead of losing them.
   */
  private async persistIssues(
    projectId: string,
    specVersion: number,
    results: JudgeResult[],
  ): Promise<void> {
    const spec = await this.prisma.specIteration.findFirst({
      where: { projectId, version: specVersion },
    });
    if (!spec) return;
    for (const result of results) {
      if (result.status !== "COMPLETED") continue;
      const rawIssues = Array.isArray(result.output?.issues)
        ? result.output.issues
        : [];
      const issues = rawIssues.map((issue) =>
        this.normalizeIssue(issue as Record<string, unknown>),
      );
      const existing: {
        id: string;
        status: string;
        title: string;
        description: string;
      }[] = await this.prisma.judgeIssue.findMany({
        where: { projectId, specIterationId: spec.id, judgeType: result.type },
      });
      const flaggedKeys = new Set(issues.map((issue) => this.issueKey(issue)));
      // Remove OPEN issues the judge no longer flags. RESOLVED issues are kept
      // as history even when the judge stops flagging them.
      const remaining: typeof existing = [];
      for (const row of existing) {
        if (
          row.status !== "RESOLVED" &&
          !flaggedKeys.has(this.issueKeyFromRow(row))
        ) {
          await this.prisma.judgeIssue.delete({ where: { id: row.id } });
        } else {
          remaining.push(row);
        }
      }
      for (const issue of issues) {
        const match = remaining.find(
          (row) => this.issueKeyFromRow(row) === this.issueKey(issue),
        );
        if (match) {
          // A RESOLVED issue stays resolved — the user's decision stands even
          // if the judge flags the same thing again on a re-run.
          if (match.status !== "RESOLVED") {
            await this.prisma.judgeIssue.update({
              where: { id: match.id },
              data: {
                severity: issue.severity,
                title: issue.title,
                description: issue.description,
                suggestion: issue.suggestion,
                flaggedBy: issue.flaggedBy,
                choices: issue.choices as Prisma.InputJsonValue,
              },
            });
          }
        } else {
          await this.prisma.judgeIssue.create({
            data: {
              projectId,
              specIterationId: spec.id,
              judgeType: result.type,
              severity: issue.severity,
              title: issue.title,
              description: issue.description,
              suggestion: issue.suggestion,
              flaggedBy: issue.flaggedBy,
              choices: issue.choices as Prisma.InputJsonValue,
            },
          });
        }
      }
    }
  }

  /**
   * Normalizes a raw AI issue into the shape stored on JudgeIssue, guaranteeing
   * the user can always resolve it: a non-empty `suggestion` and a non-empty
   * `choices` list that always ends with an "Other" option for custom input.
   */
  private normalizeIssue(record: Record<string, unknown>): {
    severity: string;
    title: string;
    description: string;
    suggestion: string;
    flaggedBy: string;
    choices: { letter: string; label: string; understanding: string }[];
  } {
    const description = String(record.description ?? "");
    const title = String(record.title ?? record.description ?? "");
    const suggestion =
      String(record.suggestion ?? "") ||
      description ||
      "Xem xét lại nội dung liên quan và điều chỉnh cho phù hợp.";
    let choices = Array.isArray(record.choices)
      ? record.choices.filter(
          (
            choice,
          ): choice is {
            letter: string;
            label: string;
            understanding?: string;
          } =>
            typeof choice === "object" &&
            choice !== null &&
            typeof (choice as { letter?: unknown }).letter === "string" &&
            typeof (choice as { label?: unknown }).label === "string",
        )
      : [];
    if (choices.length === 0) {
      // The judge gave no usable choices — provide sensible defaults so the
      // user always has something to resolve with.
      choices = [
        {
          letter: "A",
          label: "Áp dụng đề xuất của Judge",
          understanding: "Áp dụng gợi ý sửa đổi mà Judge đưa ra.",
        },
        {
          letter: "B",
          label: "Giữ nguyên nội dung hiện tại",
          understanding: "Chấp nhận nội dung hiện tại, không sửa đổi.",
        },
        {
          letter: "C",
          label: "Other",
          understanding: "Tự nhập phương án xử lý.",
        },
      ];
    } else if (
      !choices.some((choice) => String(choice.label).toLowerCase() === "other")
    ) {
      // Always guarantee an "Other" option for custom user input.
      choices.push({
        letter: this.nextChoiceLetter(choices),
        label: "Other",
        understanding: "Tự nhập phương án xử lý.",
      });
    }
    return {
      severity: String(record.severity ?? "MINOR"),
      title,
      description,
      suggestion,
      flaggedBy: String(record.flaggedBy ?? record.flagged_by ?? ""),
      choices: choices.map((choice) => ({
        letter: String(choice.letter),
        label: String(choice.label),
        understanding: String(choice.understanding ?? ""),
      })),
    };
  }

  /** Stable identity for an issue within a judge type (title + description). */
  private issueKey(issue: { title: string; description: string }): string {
    return `${issue.title.trim()}\u0000${issue.description.trim()}`;
  }

  private issueKeyFromRow(row: {
    title: string;
    description: string;
  }): string {
    return `${row.title.trim()}\u0000${row.description.trim()}`;
  }

  private nextChoiceLetter(choices: { letter: string }[]): string {
    const used = new Set(choices.map((choice) => choice.letter.toUpperCase()));
    for (const letter of ["A", "B", "C", "D", "E"]) {
      if (!used.has(letter)) return letter;
    }
    return String.fromCharCode(65 + choices.length);
  }

  /**
   * Marks the judge node FRESH after a successful panel run and persists the
   * per-judge verdicts in the judge artifact's data (so they survive the HTTP
   * response instead of being lost).
   */
  private async persistJudgeArtifact(
    projectId: string,
    specVersion: number,
    results: JudgeResult[],
  ): Promise<void> {
    const spec = await this.prisma.specIteration.findFirst({
      where: { projectId, version: specVersion },
    });
    if (!spec) return;
    await this.prisma.specArtifact.upsert({
      where: {
        specIterationId_node: { specIterationId: spec.id, node: "judge" },
      },
      create: {
        projectId,
        specIterationId: spec.id,
        node: "judge",
        status: "FRESH",
        data: { judges: results } as Prisma.InputJsonValue,
      },
      update: {
        status: "FRESH",
        data: { judges: results } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Re-runs a single judge after an issue is resolved, persists its issues
   * idempotently, and merges the result into the judge artifact so the judge
   * node is FRESH again. Forward-only: no step needs to be re-run by the
   * frontend after a resolve.
   */
  async rerunJudge(projectId: string, type: JudgeType): Promise<JudgeResult> {
    const result = await this.runJudge(projectId, type);
    if (result.status === "COMPLETED") {
      await this.persistIssues(projectId, result.specVersionUsed, [result]);
      await this.mergeJudgeArtifact(projectId, result.specVersionUsed, result);
    }
    return result;
  }

  /**
   * Merges a single judge result into the persisted judge artifact (replacing
   * the matching judge type) and marks the judge node FRESH.
   */
  private async mergeJudgeArtifact(
    projectId: string,
    specVersion: number,
    result: JudgeResult,
  ): Promise<void> {
    const spec = await this.prisma.specIteration.findFirst({
      where: { projectId, version: specVersion },
    });
    if (!spec) return;
    const existing = await this.prisma.specArtifact.findUnique({
      where: {
        specIterationId_node: { specIterationId: spec.id, node: "judge" },
      },
    });
    const existingData = (existing?.data ?? {}) as Record<string, unknown>;
    const judges = Array.isArray(existingData.judges) ? existingData.judges : [];
    const merged = judges
      .filter((judge) => {
        const record = judge as Record<string, unknown>;
        return record.type !== result.type;
      })
      .concat([result]);
    await this.prisma.specArtifact.upsert({
      where: {
        specIterationId_node: { specIterationId: spec.id, node: "judge" },
      },
      create: {
        projectId,
        specIterationId: spec.id,
        node: "judge",
        status: "FRESH",
        data: { judges: merged } as Prisma.InputJsonValue,
      },
      update: {
        status: "FRESH",
        data: { judges: merged } as Prisma.InputJsonValue,
      },
    });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Judge execution failed";
  }
}
