/**
 * Typed gateway to the Python AI microservice (`ai_service`) for the non-judge
 * endpoints the frontend 6-step flow needs (clarify, decompose, gap analysis,
 * experiments, final spec). Judge execution stays on `LlmPort`.
 */
export const AI_GATEWAY = Symbol("AI_GATEWAY");

export type AiGatewayResponse = {
  output: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
};

export interface AiGateway {
  /** POST /ai/v1/clarify/understand — { idea, feedback? } → { clarified_idea, key_issues, confidence } */
  understandIdea(idea: string, feedback?: string): Promise<AiGatewayResponse>;
  /** POST /ai/v1/clarify/questions — { clarified_idea } → { questions: [{ question, example, options }] } */
  generateQuestions(clarifiedIdea: string): Promise<AiGatewayResponse>;
  /** POST /ai/v1/decompose — context → { cards: [{ type, content, status }] } (8 fixed types, PROPOSED) */
  decompose(context: Record<string, unknown>): Promise<AiGatewayResponse>;
  /** POST /ai/v1/related-works — { problem, research_question, keywords? } → { related_works: [...] } */
  relatedWorks(
    problem: string,
    researchQuestion: string,
    keywords?: string[],
  ): Promise<AiGatewayResponse>;
  /** POST /ai/v1/gap-analysis — { gap_candidate, related_works } → { what_was_done, limitation, why_it_matters, testable_with, directions } */
  // gapAnalysis(gapCandidate: string, relatedWorks: unknown[]): Promise<AiGatewayResponse>;
  gapAnalysis(
    gapCandidate: string,
    relatedWorks: unknown[],
    revisionInstruction?: string,
  ): Promise<AiGatewayResponse>;
  /** POST /ai/v1/spec-experiment — { problem, gap, direction? } → { contributions, claims, experiments, feasibility_estimation } */
  specExperiment(
    problem: string,
    gap: string,
    direction?: string,
  ): Promise<AiGatewayResponse>;
  /** POST /ai/v1/spec-experiment/single-claim — one claim → one experiment */
  singleClaimExperiment(
    claimEvidence: Record<string, unknown>,
  ): Promise<AiGatewayResponse>;
  /** POST /ai/v1/final-spec — full spec payload → { markdown_content, spec_json } */
  finalSpec(payload: Record<string, unknown>): Promise<AiGatewayResponse>;
  /** POST /ai/v1/conflicts/check — { claim_evidence_pairs, related_works } → { conflicts: [{ claim_card_id, evidence_card_id, linked_sources, reason }] } */
  conflicts(
    claimEvidencePairs: unknown[],
    relatedWorks: unknown[],
  ): Promise<AiGatewayResponse>;
}
