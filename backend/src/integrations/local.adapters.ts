import { EvidenceCandidate, NliOutcome, NliPort, RerankPort, SearchPort } from '../verification.service';
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

export class LocalSearchAdapter implements SearchPort {
  async search(query: string): Promise<EvidenceCandidate[]> {
    return [{ id: 'local-source-1', text: `Local evidence candidate for: ${query}`, score: 0.5 }];
  }
}

export class LocalRerankAdapter implements RerankPort {
  async rerank(_claim: string, candidates: EvidenceCandidate[]): Promise<EvidenceCandidate[]> {
    return [...candidates].sort((left, right) => right.score - left.score);
  }
}

export class LocalNliAdapter implements NliPort {
  async classify(_claim: string, evidence: EvidenceCandidate[]): Promise<NliOutcome> {
    return evidence.length > 0 ? 'INSUFFICIENT' : 'INSUFFICIENT';
  }
}
