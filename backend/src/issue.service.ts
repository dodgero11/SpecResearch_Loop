// import { Injectable, NotFoundException } from '@nestjs/common';
// import { DecisionService } from './decision.service';
// import { DependencyGraphService, WorkflowNode } from './dependency-graph.service';
// import { JudgeService, JudgeType } from './judge.service';
// import { PrismaService } from './prisma.service';
// import { ProjectService } from './project.service';
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { SpecCardType } from "@prisma/client";
import { AI_GATEWAY, AiGateway } from "./integrations/ai-gateway.port";
import { DecisionService } from "./decision.service";
import {
  DependencyGraphService,
  WorkflowNode,
} from "./dependency-graph.service";
import { JudgeService, JudgeType } from "./judge.service";
import { PrismaService } from "./prisma.service";
import { ProjectService, SpecData } from "./project.service";

/** Maps a judge type to the dependency-graph node it evaluates. */
const JUDGE_NODE: Record<JudgeType, WorkflowNode> = {
  gap: "gap",
  contribution: "contribution",
  experiment: "experiment",
  evidence: "claim",
  "conference-readiness": "judge",
};

@Injectable()
export class IssueService {
  private readonly logger = new Logger(IssueService.name);
  // constructor(
  //   private readonly prisma: PrismaService,
  //   private readonly projects: ProjectService,
  //   private readonly judges: JudgeService,
  //   private readonly decisions: DecisionService,
  //   private readonly dependencyGraph: DependencyGraphService,
  // ) {}
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectService,
    private readonly judges: JudgeService,
    private readonly decisions: DecisionService,
    private readonly dependencyGraph: DependencyGraphService,
    @Inject(AI_GATEWAY) private readonly ai: AiGateway,
  ) {}
  /** Lists persisted judge issues for the latest spec version. */
  async list(projectId: string) {
    const spec = await this.projects.latestSpec(projectId);
    return this.prisma.judgeIssue.findMany({
      where: { projectId, specIterationId: spec.id },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Resolves an issue: records the choice, re-runs the flagging judge to confirm. */
  // async resolve(
  //   projectId: string,
  //   issueId: string,
  //   choice: string,
  //   customChoice?: string,
  // ) {
  //   const issue = await this.prisma.judgeIssue.findFirst({
  //     where: { id: issueId, projectId },
  //   });
  //   if (!issue) throw new NotFoundException(`Issue ${issueId} was not found`);
  //   const judgeType = issue.judgeType as JudgeType;
  //   const invalidatedNodes = this.dependencyGraph.getAffectedNodes(
  //     JUDGE_NODE[judgeType],
  //   );
  //   const spec = await this.projects.latestSpec(projectId);
  //   // DB writes (update issue + upsert STALE artifacts + record decision) are
  //   // atomic. The judge re-run is an external AI call and runs after commit.
  //   const updatedIssue = await this.prisma.$transaction(async (tx) => {
  //     const updated = await tx.judgeIssue.update({
  //       where: { id: issueId },
  //       data: {
  //         status: "RESOLVED",
  //         resolvedChoice: choice,
  //         customResolution: customChoice,
  //       },
  //     });
  //     for (const node of invalidatedNodes) {
  //       await tx.specArtifact.upsert({
  //         where: { specIterationId_node: { specIterationId: spec.id, node } },
  //         create: {
  //           projectId,
  //           specIterationId: spec.id,
  //           node,
  //           status: "STALE",
  //           data: {},
  //         },
  //         update: { status: "STALE" },
  //       });
  //     }
  //     await this.decisions.record(
  //       projectId,
  //       "ACCEPT",
  //       `issue:${issueId}`,
  //       { choice, customChoice },
  //       tx,
  //     );
  //     return updated;
  //   });
  //   // If the judge fails, the issue is still resolved (the user already chose).
  //   const judgeResult = await this.judges.runJudge(projectId, judgeType);
  //   return { updatedIssue, invalidatedNodes, judgeResult };
  // }
  async resolve(
    projectId: string,
    issueId: string,
    choice: string,
    customChoice?: string,
  ) {
    const issue = await this.prisma.judgeIssue.findFirst({
      where: { id: issueId, projectId },
    });
    if (!issue) throw new NotFoundException(`Issue ${issueId} was not found`);
    const judgeType = issue.judgeType as JudgeType;
    const invalidatedNodes = this.dependencyGraph.getAffectedNodes(
      JUDGE_NODE[judgeType],
    );

    // Build the revision instruction from the user's choice.
    const choices = Array.isArray(issue.choices)
      ? (issue.choices as { letter: string; understanding: string }[])
      : [];
    const instruction =
      customChoice ??
      choices.find((c) => c.letter === choice)?.understanding ??
      issue.description;

    // Apply the user's choice to the spec content before the judge re-checks.
    // Each judge type revises its own section via the AI service. If the AI
    // rewrite fails, we still record the user's decision and resolve the issue
    // (graceful degradation).
    let before: unknown;
    let after: unknown;
    const specBefore = await this.projects.latestSpec(projectId);
    const data = specBefore.data as SpecData;
    const cards = await this.prisma.specCard.findMany({
      where: { projectId, specIterationId: specBefore.id },
    });
    const problem =
      cards.find((card) => card.type === SpecCardType.PROBLEM)?.content ?? "";
    const gapAnalysis = (data.gapAnalysis ?? {}) as Record<string, unknown>;
    const context = {
      problem,
      gap: String(gapAnalysis.limitation ?? ""),
    };

    try {
      // Retry the AI revision up to 3 times with the same instruction. LLM
      // responses are non-deterministic, so a retry often succeeds where the
      // first call returned empty. If all attempts return empty, we fall back
      // to preserving the existing content (no destructive wipe).
      const MAX_REVISION_ATTEMPTS = 3;
      let revisionResult: unknown = null;

      for (let attempt = 1; attempt <= MAX_REVISION_ATTEMPTS; attempt++) {
        const result = await this.callRevisionForJudge(
          judgeType,
          data,
          cards,
          instruction,
          context,
        );
        if (!this.isEmptyRevision(judgeType, result)) {
          this.logger.log(
            `[IssueService] ${judgeType} revision succeeded on attempt ${attempt}/${MAX_REVISION_ATTEMPTS}`,
          );
          revisionResult = result;
          break;
        }
        if (attempt < MAX_REVISION_ATTEMPTS) {
          this.logger.warn(
            `[IssueService] ${judgeType} revision returned empty on attempt ${attempt}/${MAX_REVISION_ATTEMPTS}, retrying...`,
          );
        } else {
          this.logger.error(
            `[IssueService] ${judgeType} revision returned empty on all ${MAX_REVISION_ATTEMPTS} attempts. Falling back to preserving existing content.`,
          );
        }
      }

      // Only apply the revision if we got a non-empty result. Each judge
      // applies its own section with guards that preserve existing data when
      // the AI returned empty/malformed content.
      if (revisionResult !== null) {
        if (judgeType === "gap") {
          const output = revisionResult as Record<string, unknown>;
          const existingGap = (data.gapAnalysis ?? {}) as Record<
            string,
            unknown
          >;
          const afterGap: Record<string, unknown> = {
            whatWasDone: String(output.what_was_done ?? ""),
            limitation: String(output.limitation ?? ""),
            whyItMatters: String(output.why_it_matters ?? ""),
            testableWith: String(output.testable_with ?? ""),
            directions: Array.isArray(output.directions)
              ? output.directions
              : [],
          };
          // Preserve each existing field if the AI returned it empty.
          for (const key of [
            "limitation",
            "whatWasDone",
            "whyItMatters",
            "testableWith",
          ]) {
            if (!String(afterGap[key] ?? "").trim() && existingGap[key]) {
              afterGap[key] = existingGap[key];
            }
          }
          if (
            !Array.isArray(afterGap.directions) ||
            afterGap.directions.length === 0
          ) {
            afterGap.directions = existingGap.directions ?? [];
          }
          before = data.gapAnalysis;
          after = afterGap;
          await this.projects.createSpec(projectId, {
            ...data,
            gapAnalysis: afterGap,
          });
        } else if (judgeType === "contribution") {
          const experimentPlan = (data.experimentPlan ?? {}) as Record<
            string,
            unknown
          >;
          const contributions = Array.isArray(experimentPlan.contributions)
            ? experimentPlan.contributions
            : [];
          before = contributions;
          after = revisionResult;
          await this.projects.createSpec(projectId, {
            ...data,
            experimentPlan: { ...experimentPlan, contributions: after },
          });
        } else if (judgeType === "experiment") {
          const experimentPlan = (data.experimentPlan ?? {}) as Record<
            string,
            unknown
          >;
          const experiments = Array.isArray(experimentPlan.experiments)
            ? experimentPlan.experiments
            : [];
          before = experiments;
          after = revisionResult;
          await this.projects.createSpec(projectId, {
            ...data,
            experimentPlan: { ...experimentPlan, experiments: after },
          });
        } else if (judgeType === "evidence") {
          const experimentPlan = (data.experimentPlan ?? {}) as Record<
            string,
            unknown
          >;
          const contributions = Array.isArray(experimentPlan.contributions)
            ? (experimentPlan.contributions as Array<Record<string, unknown>>)
            : [];
          const claimEvidencePairs = contributions
            .filter((c) => c.claimEvidence)
            .map((c) => c.claimEvidence);
          const revisedPairs = revisionResult as unknown[];
          let pairIndex = 0;
          const revisedContributions = contributions.map((c) => {
            if (c.claimEvidence && pairIndex < revisedPairs.length) {
              return { ...c, claimEvidence: revisedPairs[pairIndex++] };
            }
            return c;
          });
          before = claimEvidencePairs;
          after = revisedPairs;
          await this.projects.createSpec(projectId, {
            ...data,
            experimentPlan: {
              ...experimentPlan,
              contributions: revisedContributions,
            },
          });
        } else if (judgeType === "conference-readiness") {
          const revised = revisionResult as Record<string, unknown>;
          before = {
            gapAnalysis: data.gapAnalysis,
            experimentPlan: data.experimentPlan,
            relatedWork: data.relatedWork,
          };
          after = revised;
          const nextData = { ...data };

          // gapAnalysis: deep-merge, preserve non-empty existing fields.
          if (
            revised.gapAnalysis !== undefined &&
            typeof revised.gapAnalysis === "object" &&
            revised.gapAnalysis !== null
          ) {
            const existingGap =
              typeof data.gapAnalysis === "object" &&
              data.gapAnalysis !== null
                ? (data.gapAnalysis as Record<string, unknown>)
                : {};
            const revisedGap = revised.gapAnalysis as Record<string, unknown>;
            const merged: Record<string, unknown> = { ...existingGap };
            for (const [key, value] of Object.entries(revisedGap)) {
              if (value !== undefined && value !== null && value !== "") {
                merged[key] = value;
              }
            }
            nextData.gapAnalysis = merged;
          }

          // experimentPlan: deep-merge, but guard empty arrays.
          if (
            revised.experimentPlan !== undefined &&
            typeof revised.experimentPlan === "object" &&
            revised.experimentPlan !== null
          ) {
            const existingPlan = (data.experimentPlan ?? {}) as Record<
              string,
              unknown
            >;
            const revisedPlan = revised.experimentPlan as Record<
              string,
              unknown
            >;
            const mergedPlan: Record<string, unknown> = {
              ...existingPlan,
              ...revisedPlan,
            };
            if (
              Array.isArray(mergedPlan.contributions) &&
              mergedPlan.contributions.length === 0 &&
              Array.isArray(existingPlan.contributions) &&
              existingPlan.contributions.length > 0
            ) {
              mergedPlan.contributions = existingPlan.contributions;
            }
            if (
              Array.isArray(mergedPlan.experiments) &&
              mergedPlan.experiments.length === 0 &&
              Array.isArray(existingPlan.experiments) &&
              existingPlan.experiments.length > 0
            ) {
              mergedPlan.experiments = existingPlan.experiments;
            }
            nextData.experimentPlan = mergedPlan;
          }

          // relatedWork: don't overwrite with null or empty array.
          if (
            revised.relatedWork !== undefined &&
            Array.isArray(revised.relatedWork) &&
            revised.relatedWork.length > 0
          ) {
            nextData.relatedWork = revised.relatedWork;
          }

          await this.projects.createSpec(projectId, nextData);
        }
      }
    } catch (error) {
      this.logger.warn(
        `[IssueService] ${judgeType} rewrite failed for issue ${issueId}: ${this.errorMessage(error)}`,
      );
    }

    // The issue to mark RESOLVED. The frontend may hold an issue id from an
    // older spec version: a gap resolve (or any spec mutation) creates a new
    // version and cloneVersionData clones every issue forward, so the row the
    // frontend still holds points at the OLD version. Update the clone on the
    // latest version (matched by identity) so the resolution actually sticks
    // even without the frontend reloading the issue list.
    const spec = await this.projects.latestSpec(projectId);
    const updatedIssue = await this.prisma.$transaction(async (tx) => {
      const target =
        spec.id !== issue.specIterationId
          ? await tx.judgeIssue.findFirst({
              where: {
                projectId,
                specIterationId: spec.id,
                judgeType: issue.judgeType,
                title: issue.title,
                description: issue.description,
                status: { not: "RESOLVED" },
              },
            })
          : null;
      const updated = await tx.judgeIssue.update({
        where: { id: target?.id ?? issueId },
        data: {
          status: "RESOLVED",
          resolvedChoice: choice,
          customResolution: customChoice,
        },
      });
      await this.decisions.record(
        projectId,
        "ACCEPT",
        `issue:${issueId}`,
        { choice, customChoice },
        tx,
      );
      return updated;
    });

    // Keep the Step-2 seed cards in sync with the revised section so the card
    // view reflects the change (only when the AI rewrite succeeded). Best-effort:
    // a card-sync failure must not fail the already-committed resolution.
    if (after !== undefined) {
      try {
        await this.syncCardsForRevision(projectId, spec.id, judgeType, after);
      } catch (error) {
        this.logger.warn(
          `[IssueService] card sync failed for issue ${issueId}: ${this.errorMessage(error)}`,
        );
      }
    }

    // Forward-only: re-run the flagging judge, persist its issues idempotently
    // (a RESOLVED issue stays RESOLVED even if re-flagged), and mark the judge
    // node FRESH — no step needs to be re-run by the frontend.
    const judgeResult = await this.judges.rerunJudge(projectId, judgeType);
    return { updatedIssue, invalidatedNodes, judgeResult, before, after };
  }

  /**
   * Calls the AI revision for a judge type and returns the raw revision result
   * (the value that will be applied to the spec). Returns null/empty if the AI
   * produced no meaningful content.
   */
  private async callRevisionForJudge(
    judgeType: JudgeType,
    data: SpecData,
    cards: { type: SpecCardType; content: string }[],
    instruction: string,
    context: { problem: string; gap: string },
  ): Promise<unknown> {
    if (judgeType === "gap") {
      const gapCandidate =
        cards.find((card) => card.type === SpecCardType.GAP_CANDIDATE)
          ?.content ?? "";
      const relatedWorks = Array.isArray(data.relatedWork)
        ? data.relatedWork
        : [];
      const response = await this.ai.gapAnalysis(
        gapCandidate,
        relatedWorks,
        instruction,
      );
      return response.output;
    }
    if (judgeType === "contribution") {
      const experimentPlan = (data.experimentPlan ?? {}) as Record<
        string,
        unknown
      >;
      const contributions = Array.isArray(experimentPlan.contributions)
        ? experimentPlan.contributions
        : [];
      const response = await this.ai.contributionRevision(
        contributions,
        instruction,
        context,
      );
      return response.output.revised_content ?? contributions;
    }
    if (judgeType === "experiment") {
      const experimentPlan = (data.experimentPlan ?? {}) as Record<
        string,
        unknown
      >;
      const experiments = Array.isArray(experimentPlan.experiments)
        ? experimentPlan.experiments
        : [];
      const response = await this.ai.experimentRevision(
        experiments,
        instruction,
        context,
      );
      return response.output.revised_content ?? experiments;
    }
    if (judgeType === "evidence") {
      const experimentPlan = (data.experimentPlan ?? {}) as Record<
        string,
        unknown
      >;
      const contributions = Array.isArray(experimentPlan.contributions)
        ? (experimentPlan.contributions as Array<Record<string, unknown>>)
        : [];
      const claimEvidencePairs = contributions
        .filter((c) => c.claimEvidence)
        .map((c) => c.claimEvidence);
      const response = await this.ai.evidenceRevision(
        claimEvidencePairs,
        instruction,
        context,
      );
      return response.output.revised_content ?? claimEvidencePairs;
    }
    // conference-readiness
    const fullSnapshot = {
      gapAnalysis: data.gapAnalysis,
      experimentPlan: data.experimentPlan,
      relatedWork: data.relatedWork,
    };
    const response = await this.ai.conferenceReadinessRevision(
      fullSnapshot,
      instruction,
      context,
    );
    return response.output.revised_content ?? {};
  }

  /**
   * Checks whether a revision result is "empty" (null, empty object, or missing
   * key fields). Used to decide whether to retry the AI call.
   */
  private isEmptyRevision(judgeType: JudgeType, result: unknown): boolean {
    if (result === null || result === undefined) return true;
    if (typeof result !== "object") return false;
    const obj = result as Record<string, unknown>;
    if (judgeType === "gap") {
      // Gap revision is empty if `limitation` is missing or blank.
      return !String(obj.limitation ?? "").trim();
    }
    if (judgeType === "conference-readiness") {
      // Conference-readiness returns { gapAnalysis?, experimentPlan?, relatedWork? }.
      // Empty if all sub-sections are missing/empty.
      return Object.keys(obj).length === 0;
    }
    // contribution / experiment / evidence return arrays.
    if (Array.isArray(result)) return result.length === 0;
    return Object.keys(obj).length === 0;
  }

  /**
   * Keeps the Step-2 seed cards in sync with a section that was just revised by
   * an issue resolution, so the card view reflects the change. Only updates the
   * seed card (or first card) of the matching type(s); never creates new cards.
   */
  private async syncCardsForRevision(
    projectId: string,
    specIterationId: string,
    judgeType: JudgeType,
    after: unknown,
  ): Promise<void> {
    const cards = await this.prisma.specCard.findMany({
      where: { projectId, specIterationId },
    });
    const updateCard = async (type: SpecCardType, content: string) => {
      const card =
        cards.find((c) => c.type === type && c.isSeed) ??
        cards.find((c) => c.type === type);
      if (card) {
        await this.prisma.specCard.update({
          where: { id: card.id },
          data: { content },
        });
      }
    };

    if (judgeType === "gap") {
      const gap = after as Record<string, unknown>;
      await updateCard(
        SpecCardType.GAP_CANDIDATE,
        String(gap.limitation ?? ""),
      );
    } else if (judgeType === "contribution") {
      const contributions = Array.isArray(after) ? after : [];
      const text = contributions
        .map((c) => String((c as Record<string, unknown>).label ?? ""))
        .filter(Boolean)
        .join("; ");
      await updateCard(SpecCardType.CONTRIBUTION, text);
    } else if (judgeType === "experiment") {
      const experiments = Array.isArray(after) ? after : [];
      const text = experiments
        .map((e) => String((e as Record<string, unknown>).name ?? ""))
        .filter(Boolean)
        .join("; ");
      await updateCard(SpecCardType.CONSTRAINT, text);
    } else if (judgeType === "evidence") {
      const pairs = Array.isArray(after) ? after : [];
      const claims = pairs
        .map((p) => String((p as Record<string, unknown>).claim ?? ""))
        .filter(Boolean)
        .join("; ");
      const evidences = pairs
        .map((p) => String((p as Record<string, unknown>).evidence ?? ""))
        .filter(Boolean)
        .join("; ");
      await updateCard(SpecCardType.CLAIM, claims);
      await updateCard(SpecCardType.EVIDENCE, evidences);
    } else if (judgeType === "conference-readiness") {
      const revised = after as Record<string, unknown>;
      if (revised.gapAnalysis !== undefined) {
        const gap = revised.gapAnalysis as Record<string, unknown>;
        await updateCard(
          SpecCardType.GAP_CANDIDATE,
          String(gap.limitation ?? ""),
        );
      }
      if (revised.experimentPlan !== undefined) {
        const plan = revised.experimentPlan as Record<string, unknown>;
        const contributions = Array.isArray(plan.contributions)
          ? plan.contributions
          : [];
        const experiments = Array.isArray(plan.experiments)
          ? plan.experiments
          : [];
        const contributionText = contributions
          .map((c) => String((c as Record<string, unknown>).label ?? ""))
          .filter(Boolean)
          .join("; ");
        const experimentText = experiments
          .map((e) => String((e as Record<string, unknown>).name ?? ""))
          .filter(Boolean)
          .join("; ");
        if (contributionText) {
          await updateCard(SpecCardType.CONTRIBUTION, contributionText);
        }
        if (experimentText) {
          await updateCard(SpecCardType.CONSTRAINT, experimentText);
        }
      }
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Issue resolution failed";
  }
}
