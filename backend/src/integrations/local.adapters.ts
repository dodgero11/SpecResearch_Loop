import { LlmPort, LlmResponse } from './llm.port';

export class LocalLlmAdapter implements LlmPort {
  async complete(task: string, inputContext: Record<string, unknown>): Promise<LlmResponse> {
    return {
      output: {
        task,
        verdict: 'REVIEW_REQUIRED',
        issues: [],
        contextFields: Object.keys(inputContext),
      },
      inputTokens: JSON.stringify(inputContext).length,
      outputTokens: 3,
    };
  }
}
