import { Logger } from "@nestjs/common";
import { DEFAULT_AI_SERVICE_TIMEOUT_MS } from "../config";
import { AiGateway, AiGatewayResponse } from "./ai-gateway.port";
import { LocalAiGateway } from "./local-ai-gateway.adapter";

/**
 * AiGateway implementation backed by the Python AI microservice (`ai_service`).
 * Reuses the fetch + AbortSignal.timeout + error-handling pattern from
 * `HttpLlmAdapter`, but for the non-judge endpoints.
 */
export class HttpAiGateway implements AiGateway {
  private readonly logger = new Logger(HttpAiGateway.name);

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async understandIdea(
    idea: string,
    feedback?: string,
  ): Promise<AiGatewayResponse> {
    return this.call("/ai/v1/clarify/understand", { idea, feedback });
  }

  async generateQuestions(clarifiedIdea: string): Promise<AiGatewayResponse> {
    return this.call("/ai/v1/clarify/questions", {
      clarified_idea: clarifiedIdea,
    });
  }

  async decompose(
    context: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    return this.call("/ai/v1/decompose", context);
  }

  async relatedWorks(
    problem: string,
    researchQuestion: string,
    keywords?: string[],
  ): Promise<AiGatewayResponse> {
    return this.call("/ai/v1/related-works", {
      problem,
      research_question: researchQuestion,
      keywords,
    });
  }

  // async gapAnalysis(gapCandidate: string, relatedWorks: unknown[]): Promise<AiGatewayResponse> {
  //   return this.call('/ai/v1/gap-analysis', { gap_candidate: gapCandidate, related_works: relatedWorks });
  // }
  async gapAnalysis(
    gapCandidate: string,
    relatedWorks: unknown[],
    revisionInstruction?: string,
  ): Promise<AiGatewayResponse> {
    return this.call("/ai/v1/gap-analysis", {
      gap_candidate: gapCandidate,
      related_works: relatedWorks,
      revision_instruction: revisionInstruction,
    });
  }

  async specExperiment(
    problem: string,
    gap: string,
    direction?: string,
  ): Promise<AiGatewayResponse> {
    return this.call("/ai/v1/spec-experiment", { problem, gap, direction });
  }

  async singleClaimExperiment(
    claimEvidence: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    return this.call("/ai/v1/spec-experiment/single-claim", claimEvidence);
  }

  async finalSpec(
    payload: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    const res = await this.call("/ai/v1/final-spec", payload);
    const data = res.output;
    const normalizedOutput: Record<string, unknown> = {
      ...data,
      markdownContent:
        data.markdownContent ||
        data.markdown_content ||
        "# Research Specification",
      markdown_content:
        data.markdown_content ||
        data.markdownContent ||
        "# Research Specification",
      specJson: (data.specJson || data.spec_json || {}) as Record<
        string,
        unknown
      >,
      spec_json: (data.spec_json || data.specJson || {}) as Record<
        string,
        unknown
      >,
      before: String(data.before || ""),
      after: String(data.after || ""),
    };
    return { ...res, output: normalizedOutput };
  }

  async conflicts(
    claimEvidencePairs: unknown[],
    relatedWorks: unknown[],
  ): Promise<AiGatewayResponse> {
    return this.call("/ai/v1/conflicts/check", {
      claim_evidence_pairs: claimEvidencePairs,
      related_works: relatedWorks,
    });
  }

  async contributionRevision(
    currentContent: unknown,
    instruction: string,
    context: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    return this.reviseSection(
      "contribution",
      currentContent,
      instruction,
      context,
    );
  }

  async experimentRevision(
    currentContent: unknown,
    instruction: string,
    context: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    return this.reviseSection(
      "experiment",
      currentContent,
      instruction,
      context,
    );
  }

  async evidenceRevision(
    currentContent: unknown,
    instruction: string,
    context: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    return this.reviseSection(
      "evidence",
      currentContent,
      instruction,
      context,
    );
  }

  async conferenceReadinessRevision(
    currentContent: unknown,
    instruction: string,
    context: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    return this.reviseSection(
      "conference-readiness",
      currentContent,
      instruction,
      context,
    );
  }

  private async reviseSection(
    sectionType: string,
    currentContent: unknown,
    instruction: string,
    context: Record<string, unknown>,
  ): Promise<AiGatewayResponse> {
    return this.call("/ai/v1/revise-section", {
      section_type: sectionType,
      current_content: currentContent,
      instruction,
      context,
    });
  }

  private async call(
    path: string,
    body: Record<string, unknown>,
    customTimeoutMs?: number,
  ): Promise<AiGatewayResponse> {
    const timeout = customTimeoutMs || this.timeoutMs;
    const url = `${this.baseUrl.replace(/\/+$/, "")}${path}`;
    const startedAt = Date.now();
    this.logger.log(`→ AI call ${path} (${url}) [timeout: ${timeout}ms]`);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error) {
      const detail = this.describe(error, timeout);
      this.logger.error(
        `✗ AI call ${path} failed after ${Date.now() - startedAt}ms: ${detail}`,
      );
      throw new Error(`AI service request to ${url} failed: ${detail}`);
    }

    if (!response.ok) {
      const responseBody = (await response.text().catch(() => "")).slice(
        0,
        500,
      );
      this.logger.error(
        `✗ AI call ${path} responded ${response.status} ${response.statusText} after ${Date.now() - startedAt}ms${responseBody ? `: ${responseBody}` : ""}`,
      );
      throw new Error(
        `AI service ${url} responded ${response.status} ${response.statusText}${responseBody ? `: ${responseBody}` : ""}`,
      );
    }

    const payload: unknown = await response.json().catch(() => {
      this.logger.error(
        `✗ AI call ${path} returned a non-JSON response after ${Date.now() - startedAt}ms`,
      );
      throw new Error(`AI service ${url} returned a non-JSON response`);
    });
    if (typeof payload !== "object" || payload === null) {
      this.logger.error(
        `✗ AI call ${path} returned an unexpected response payload after ${Date.now() - startedAt}ms`,
      );
      throw new Error(
        `AI service ${url} returned an unexpected response payload`,
      );
    }
    this.logger.log(
      `✓ AI call ${path} succeeded in ${Date.now() - startedAt}ms`,
    );
    return { output: payload as Record<string, unknown> };
  }

  private describe(error: unknown, timeoutMs: number = this.timeoutMs): string {
    if (error instanceof Error) {
      return error.name === "TimeoutError" || error.name === "AbortError"
        ? `timed out after ${timeoutMs}ms`
        : error.message;
    }
    return String(error);
  }
}

/** Env-driven adapter selection: HTTP gateway when AI_SERVICE_URL is set, local mock otherwise. */
export function createAiGateway(
  env: NodeJS.ProcessEnv = process.env,
): AiGateway {
  const baseUrl = env.AI_SERVICE_URL?.trim();
  if (!baseUrl) {
    return new LocalAiGateway();
  }
  const timeoutValue = env.AI_SERVICE_TIMEOUT_MS?.trim();
  const parsedTimeout = timeoutValue ? Number(timeoutValue) : Number.NaN;
  const timeoutMs =
    Number.isInteger(parsedTimeout) && parsedTimeout > 0
      ? parsedTimeout
      : DEFAULT_AI_SERVICE_TIMEOUT_MS;
  return new HttpAiGateway(baseUrl, timeoutMs);
}
