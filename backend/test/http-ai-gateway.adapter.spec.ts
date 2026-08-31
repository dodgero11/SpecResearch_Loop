import { HttpAiGateway, createAiGateway } from '../src/integrations/http-ai-gateway.adapter';
import { LocalAiGateway } from '../src/integrations/local-ai-gateway.adapter';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Internal Server Error',
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

describe('HttpAiGateway', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('understandIdea posts to /ai/v1/clarify/understand with idea and feedback', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { clarified_idea: 'c', key_issues: ['k'], confidence: 0.7 }));
    const gateway = new HttpAiGateway('http://127.0.0.1:8000', 5000);

    const response = await gateway.understandIdea('my idea', 'feedback');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/ai/v1/clarify/understand');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ idea: 'my idea', feedback: 'feedback' });
    expect(response.output).toEqual({ clarified_idea: 'c', key_issues: ['k'], confidence: 0.7 });
  });

  it('generateQuestions posts clarified_idea (snake_case) to /ai/v1/clarify/questions', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { questions: [{ question: 'q', example: 'e', options: ['a', 'Other'] }] }));
    const gateway = new HttpAiGateway('http://127.0.0.1:8000/', 5000);

    await gateway.generateQuestions('clarified idea');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/ai/v1/clarify/questions');
    expect(JSON.parse(String(init.body))).toEqual({ clarified_idea: 'clarified idea' });
  });

  it('decompose posts the context to /ai/v1/decompose', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { cards: [{ type: 'PROBLEM', content: 'c', status: 'PROPOSED' }] }));
    const gateway = new HttpAiGateway('http://127.0.0.1:8000', 5000);

    await gateway.decompose({ idea: 'i', clarifiedIdea: 'ci' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/ai/v1/decompose');
    expect(JSON.parse(String(init.body))).toEqual({ idea: 'i', clarifiedIdea: 'ci' });
  });

  it('gapAnalysis posts gap_candidate and related_works to /ai/v1/gap-analysis', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { directions: [{ letter: 'A', label: 'x', description: 'y' }] }));
    const gateway = new HttpAiGateway('http://127.0.0.1:8000', 5000);

    await gateway.gapAnalysis('gap', [{ paper_title: 'p' }]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/ai/v1/gap-analysis');
    expect(JSON.parse(String(init.body))).toEqual({ gap_candidate: 'gap', related_works: [{ paper_title: 'p' }] });
  });

  it('specExperiment posts problem, gap, direction to /ai/v1/spec-experiment', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { contributions: ['c'] }));
    const gateway = new HttpAiGateway('http://127.0.0.1:8000', 5000);

    await gateway.specExperiment('problem', 'gap', 'A');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/ai/v1/spec-experiment');
    expect(JSON.parse(String(init.body))).toEqual({ problem: 'problem', gap: 'gap', direction: 'A' });
  });

  it('singleClaimExperiment posts claim evidence to /ai/v1/spec-experiment/single-claim', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { experiment: { name: 'TN' } }));
    const gateway = new HttpAiGateway('http://127.0.0.1:8000', 5000);

    await gateway.singleClaimExperiment({ claim: 'c', baseline: 'b' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/ai/v1/spec-experiment/single-claim');
    expect(JSON.parse(String(init.body))).toEqual({ claim: 'c', baseline: 'b' });
  });

  it('finalSpec posts the payload to /ai/v1/final-spec', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { markdown_content: '# spec', spec_json: {} }));
    const gateway = new HttpAiGateway('http://127.0.0.1:8000', 5000);

    await gateway.finalSpec({ problem: 'p' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/ai/v1/final-spec');
    expect(JSON.parse(String(init.body))).toEqual({ problem: 'p' });
  });

  it('conflicts posts claim_evidence_pairs and related_works to /ai/v1/conflicts/check', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { conflicts: [{ claim_card_id: 'c', evidence_card_id: 'e', linked_sources: [], reason: 'r' }] }));
    const gateway = new HttpAiGateway('http://127.0.0.1:8000', 5000);

    await gateway.conflicts([{ claimCardId: 'c', evidenceCardId: 'e', claim: 'cl', evidence: 'ev' }], [{ paper_title: 'p' }]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/ai/v1/conflicts/check');
    expect(JSON.parse(String(init.body))).toEqual({
      claim_evidence_pairs: [{ claimCardId: 'c', evidenceCardId: 'e', claim: 'cl', evidence: 'ev' }],
      related_works: [{ paper_title: 'p' }],
    });
  });

  it('throws a descriptive error on HTTP failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { detail: 'boom' }));
    const gateway = new HttpAiGateway('http://127.0.0.1:8000', 5000);

    await expect(gateway.understandIdea('i')).rejects.toThrow('responded 500');
  });

  it('throws a timeout error when the request aborts', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'TimeoutError';
    fetchMock.mockRejectedValue(abortError);
    const gateway = new HttpAiGateway('http://127.0.0.1:8000', 1234);

    await expect(gateway.understandIdea('i')).rejects.toThrow('timed out after 1234ms');
  });
});

describe('createAiGateway', () => {
  it('returns the HTTP gateway when AI_SERVICE_URL is set', () => {
    expect(createAiGateway({ AI_SERVICE_URL: 'http://127.0.0.1:8000' })).toBeInstanceOf(HttpAiGateway);
  });

  it('returns the local mock gateway when AI_SERVICE_URL is unset', () => {
    expect(createAiGateway({})).toBeInstanceOf(LocalAiGateway);
  });
});