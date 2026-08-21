import { Inject, Injectable } from '@nestjs/common';

export const SEARCH_PORT = Symbol('SEARCH_PORT');
export const RERANK_PORT = Symbol('RERANK_PORT');
export const NLI_PORT = Symbol('NLI_PORT');

export type NliOutcome = 'SUPPORTED' | 'CONTRADICTED' | 'INSUFFICIENT';
export type EvidenceCandidate = { id: string; text: string; score: number };

export interface SearchPort { search(query: string): Promise<EvidenceCandidate[]>; }
export interface RerankPort { rerank(claim: string, candidates: EvidenceCandidate[]): Promise<EvidenceCandidate[]>; }
export interface NliPort { classify(claim: string, evidence: EvidenceCandidate[]): Promise<NliOutcome>; }

@Injectable()
export class VerificationService {
  constructor(
    @Inject(SEARCH_PORT) private readonly search: SearchPort,
    @Inject(RERANK_PORT) private readonly rerank: RerankPort,
    @Inject(NLI_PORT) private readonly nli: NliPort,
  ) {}

  async verify(claim: string): Promise<{ outcome: NliOutcome; evidence: EvidenceCandidate[] }> {
    const candidates = await this.search.search(claim);
    const ranked = await this.rerank.rerank(claim, candidates);
    const outcome = await this.nli.classify(claim, ranked);
    return { outcome, evidence: ranked };
  }
}
