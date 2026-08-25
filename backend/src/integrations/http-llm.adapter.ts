import { DEFAULT_AI_SERVICE_TIMEOUT_MS } from '../config';
import { judgeTypeFromTask, sliceJudge, toPanelOutput, toPanelRequest } from './ai-payload-mapper';
import { LocalLlmAdapter } from './local.adapters';
import { LlmPort, LlmResponse } from './llm.port';

const PANEL_ENDPOINT = '/ai/v1/judges/panel';

/**
 * LlmPort implementation backed by the Python AI microservice (`ai_service`).
 *
 * The AI service currently exposes judges only as a single panel endpoint
 * (`POST /ai/v1/judges/panel`), so:
 * - `complete('<type>-judge', ctx)` runs the panel and slices the matching judge.
 * - `completePanel(...)` runs the panel once and returns all five judges,
 *   which `JudgeService.runPanel` uses to avoid five duplicate panel calls.
 */
export class HttpLlmAdapter implements LlmPort {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async complete(task: string, inputContext: Record<string, unknown>): Promise<LlmResponse> {
    const judgeType = judgeTypeFromTask(task);
    const panel = await this.callPanel(inputContext);
    return { output: sliceJudge(panel, judgeType) };
  }

  async completePanel(_task: string, inputContext: Record<string, unknown>): Promise<LlmResponse> {
    const panel = await this.callPanel(inputContext);
    return { output: toPanelOutput(panel) };
  }

  private async callPanel(inputContext: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}${PANEL_ENDPOINT}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toPanelRequest(inputContext)),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new Error(`AI service request to ${url} failed: ${this.describe(error)}`);
    }

    if (!response.ok) {
      const body = (await response.text().catch(() => '')).slice(0, 500);
      throw new Error(`AI service ${url} responded ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`);
    }

    const payload: unknown = await response.json().catch(() => {
      throw new Error(`AI service ${url} returned a non-JSON response`);
    });
    if (typeof payload !== 'object' || payload === null) {
      throw new Error(`AI service ${url} returned an unexpected response payload`);
    }
    return payload as Record<string, unknown>;
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

/** Env-driven adapter selection: HTTP adapter when AI_SERVICE_URL is set, local mock otherwise. */
export function createLlmAdapter(env: NodeJS.ProcessEnv = process.env): LlmPort {
  const baseUrl = env.AI_SERVICE_URL?.trim();
  if (!baseUrl) {
    return new LocalLlmAdapter();
  }
  const timeoutValue = env.AI_SERVICE_TIMEOUT_MS?.trim();
  const parsedTimeout = timeoutValue ? Number(timeoutValue) : Number.NaN;
  const timeoutMs = Number.isInteger(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_AI_SERVICE_TIMEOUT_MS;
  return new HttpLlmAdapter(baseUrl, timeoutMs);
}
