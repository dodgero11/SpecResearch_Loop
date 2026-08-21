import { VerificationService, EvidenceCandidate, NliOutcome } from '../src/verification.service';

describe('VerificationService', () => {
  it.each<NliOutcome>(['SUPPORTED', 'CONTRADICTED', 'INSUFFICIENT'])('returns the NLI outcome %s after search and rerank', async (outcome) => {
    const calls: string[] = [];
    const candidates: EvidenceCandidate[] = [{ id: 'paper-1', text: 'evidence', score: 0.8 }];
    const search = { search: jest.fn(async () => { calls.push('search'); return candidates; }) };
    const rerank = { rerank: jest.fn(async () => { calls.push('rerank'); return candidates; }) };
    const nli = { classify: jest.fn(async () => { calls.push('nli'); return outcome; }) };
    const service = new VerificationService(search, rerank, nli);

    await expect(service.verify('claim')).resolves.toEqual({ outcome, evidence: candidates });
    expect(calls).toEqual(['search', 'rerank', 'nli']);
  });
});
