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
    const completePanel = this.llm.completePanel;
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
      await this.persistJudgeArtifact(projectId, panel.specVersionUsed, results);
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
        await this.persistJudgeArtifact(projectId, panel.specVersionUsed, judges);
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
   * them by id. Delete-then-recreate happens PER judge type: a failed judge keeps
   * its previously persisted issues instead of losing them to a blanket delete.
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
      await this.prisma.judgeIssue.deleteMany({
        where: {
          projectId,
          specIterationId: spec.id,
          judgeType: result.type,
          status: { not: "RESOLVED" },
        },
      });
      if (!result.output) continue;
      const issues = Array.isArray(result.output.issues)
        ? result.output.issues
        : [];
      for (const issue of issues) {
        const record = issue as Record<string, unknown>;
        await this.prisma.judgeIssue.create({
          data: {
            projectId,
            specIterationId: spec.id,
            judgeType: result.type,
            severity: String(record.severity ?? "MINOR"),
            title: String(record.title ?? record.description ?? ""),
            description: String(record.description ?? ""),
            suggestion: String(record.suggestion ?? ""),
            flaggedBy: String(record.flaggedBy ?? record.flagged_by ?? ""),
            choices: (Array.isArray(record.choices)
              ? record.choices
              : []) as Prisma.InputJsonValue,
          },
        });
      }
    }
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
      where: { specIterationId_node: { specIterationId: spec.id, node: "judge" } },
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

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Judge execution failed";
  }
}
