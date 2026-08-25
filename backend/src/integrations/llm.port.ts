export type LlmResponse = {
  output: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
};

export interface LlmPort {
  complete(task: string, inputContext: Record<string, unknown>): Promise<LlmResponse>;
  /**
   * Optional batched execution for task groups the remote engine can only run
   * together (e.g. the five-judge panel). Implementations without batching
   * support may omit this; callers must fall back to per-task `complete`.
   */
  completePanel?(task: string, inputContext: Record<string, unknown>): Promise<LlmResponse>;
}
