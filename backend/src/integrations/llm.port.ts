export type LlmResponse = {
  output: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
};

export interface LlmPort {
  complete(task: string, inputContext: Record<string, unknown>): Promise<LlmResponse>;
}
