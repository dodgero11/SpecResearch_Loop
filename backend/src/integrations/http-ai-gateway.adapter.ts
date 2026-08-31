import { DEFAULT_AI_SERVICE_TIMEOUT_MS } from '../config';
import { AiGateway, AiGatewayResponse } from './ai-gateway.port';
import { LocalAiGateway } from './local-ai-gateway.adapter';

/**
 * AiGateway implementation backed by the Python AI microservice (`ai_service`).
 * Reuses the fetch + AbortSignal.timeout + error-handling pattern from
 * `HttpLlmAdapter`, but for the non-judge endpoints.
 */
export class HttpAiGateway implements AiGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async understandIdea(idea: string, feedback?: string): Promise<AiGatewayResponse> {
    return this.call('/ai/v1/clarify/understand', { idea, feedback });
  }

  async generateQuestions(clarifiedIdea: string): Promise<AiGatewayResponse> {
    return this.call('/ai/v1/clarify/questions', { clarified_idea: clarifiedIdea });
  }

  async decompose(context: Record<string, unknown>): Promise<AiGatewayResponse> {
    return this.call('/ai/v1/decompose', context);
  }

  async relatedWorks(problem: string, researchQuestion: string, keywords?: string[]): Promise<AiGatewayResponse> {
    return this.call('/ai/v1/related-works', { problem, research_question: researchQuestion, keywords });
  }

  async gapAnalysis(gapCandidate: string, relatedWorks: unknown[]): Promise<AiGatewayResponse> {
    return this.call('/ai/v1/gap-analysis', { gap_candidate: gapCandidate, related_works: relatedWorks });
  }

  async specExperiment(problem: string, gap: string, direction?: string): Promise<AiGatewayResponse> {
    return this.call('/ai/v1/spec-experiment', { problem, gap, direction });
  }

  async singleClaimExperiment(claimEvidence: Record<string, unknown>): Promise<AiGatewayResponse> {
    return this.call('/ai/v1/spec-experiment/single-claim', claimEvidence);
  }

  async finalSpec(payload: Record<string, unknown>): Promise<AiGatewayResponse> {
    return this.call('/ai/v1/final-spec', payload);
  }

  async conflicts(claimEvidencePairs: unknown[], relatedWorks: unknown[]): Promise<AiGatewayResponse> {
    return this.call('/ai/v1/conflicts/check', { claim_evidence_pairs: claimEvidencePairs, related_works: relatedWorks });
  }

  private async call(path: string, body: Record<string, unknown>): Promise<AiGatewayResponse> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new Error(`AI service request to ${url} failed: ${this.describe(error)}`);
    }

    if (!response.ok) {
      const responseBody = (await response.text().catch(() => '')).slice(0, 500);
      throw new Error(`AI service ${url} responded ${response.status} ${response.statusText}${responseBody ? `: ${responseBody}` : ''}`);
    }

    const payload: unknown = await response.json().catch(() => {
      throw new Error(`AI service ${url} returned a non-JSON response`);
    });
    if (typeof payload !== 'object' || payload === null) {
      throw new Error(`AI service ${url} returned an unexpected response payload`);
    }
    return { output: payload as Record<string, unknown> };
  }

  private describe(error: unknown): string {
    if (error instanceof Error) {
      return error.name === 'TimeoutError' || error.name === 'AbortError'
        ? `timed out after ${this.timeoutMs}ms`
        : error.message;
    }
    return String(error);
  }
}

/** Env-driven adapter selection: HTTP gateway when AI_SERVICE_URL is set, local mock otherwise. */
export function createAiGateway(env: NodeJS.ProcessEnv = process.env): AiGateway {
  const baseUrl = env.AI_SERVICE_URL?.trim();
  if (!baseUrl) {
    return new LocalAiGateway();
  }
  const timeoutValue = env.AI_SERVICE_TIMEOUT_MS?.trim();
  const parsedTimeout = timeoutValue ? Number(timeoutValue) : Number.NaN;
  const timeoutMs = Number.isInteger(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_AI_SERVICE_TIMEOUT_MS;
  return new HttpAiGateway(baseUrl, timeoutMs);
}