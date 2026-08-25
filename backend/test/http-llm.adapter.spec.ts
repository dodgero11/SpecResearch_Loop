import { HttpLlmAdapter, createLlmAdapter } from '../src/integrations/http-llm.adapter';
import { LocalLlmAdapter } from '../src/integrations/local.adapters';

const panelResponse = {
  spec_version_used: 1,
  status: 'COMPLETED',
  judges: [
    { type: 'gap', verdict: 'ACCEPT', issues: [] },
    { type: 'contribution', verdict: 'REVIEW_REQUIRED', issues: [{ severity: 'MAJOR', description: 'd', suggestion: 's' }] },
    { type: 'experiment', verdict: 'ACCEPT', issues: [] },
    { type: 'evidence', verdict: 'ACCEPT', issues: [] },
    { type: 'conference-readiness', verdict: 'ACCEPT', issues: [] },
  ],
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Internal Server Error',
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

describe('HttpLlmAdapter', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('maps judge tasks to the panel endpoint and slices the matching judge', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, panelResponse));
    const adapter = new HttpLlmAdapter('http://127.0.0.1:8000', 5000);

    const response = await adapter.complete('gap-judge', { problem: 'p', gap: 'g' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:8000/ai/v1/judges/panel');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      problem: 'p',
      gap: 'g',
      related_work: [],
      contribution: '',
      claims: [],
      experiments: [],
      evidence: [],
    });
    expect(response.output).toEqual({ type: 'gap', verdict: 'ACCEPT', issues: [] });
  });

  it('coerces free-form spec data into the AI service snake_case shapes', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, panelResponse));
    const adapter = new HttpLlmAdapter('http://127.0.0.1:8000/', 5000);

    await adapter.complete('evidence-judge', {
      problem: 'p',
      relatedWork: ['Paper A', 'https://arxiv.org/abs/1', { paperTitle: 'T', authors: ['a'], year: 2024 }],
      claims: ['claim one', { claim: 'c2', rejectionCondition: 'x' }],
      experiment: 'single plan text',
      evidence: ['e1', 42],
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.related_work).toEqual([
      { paper_title: 'Paper A', authors: '', year: 0, what_they_did: '', feedback: '', missing_points: '', source_url: '' },
      { paper_title: 'https://arxiv.org/abs/1', authors: '', year: 0, what_they_did: '', feedback: '', missing_points: '', source_url: 'https://arxiv.org/abs/1' },
      { paper_title: 'T', authors: 'a', year: 2024, what_they_did: '', feedback: '', missing_points: '', source_url: '' },
    ]);
    expect(body.claims).toEqual([
      { claim: 'claim one', baseline: '', metric: '', evidence: '', rejection_condition: '' },
      { claim: 'c2', baseline: '', metric: '', evidence: '', rejection_condition: 'x' },
    ]);
    expect(body.experiments).toEqual([{ name: 'Experiment plan', protocol: 'single plan text', expected_outcome: '' }]);
    expect(body.evidence).toEqual(['e1', '42']);
  });

  it('completePanel returns the normalized full panel output', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, panelResponse));
    const adapter = new HttpLlmAdapter('http://127.0.0.1:8000', 5000);

    const response = await adapter.completePanel('judges-panel', { problem: 'p' });

    expect(response.output).toMatchObject({ status: 'COMPLETED' });
    expect(response.output.judges).toHaveLength(5);
  });

  it('throws a descriptive error on HTTP failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { detail: 'boom' }));
    const adapter = new HttpLlmAdapter('http://127.0.0.1:8000', 5000);

    await expect(adapter.complete('gap-judge', {})).rejects.toThrow('responded 500');
  });

  it('throws a timeout error when the request aborts', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'TimeoutError';
    fetchMock.mockRejectedValue(abortError);
    const adapter = new HttpLlmAdapter('http://127.0.0.1:8000', 1234);

    await expect(adapter.complete('gap-judge', {})).rejects.toThrow('timed out after 1234ms');
  });

  it('throws when the panel response is missing the requested judge', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: 'COMPLETED', judges: [{ type: 'gap', verdict: 'ACCEPT', issues: [] }] }));
    const adapter = new HttpLlmAdapter('http://127.0.0.1:8000', 5000);

    await expect(adapter.complete('evidence-judge', {})).rejects.toThrow('did not include a "evidence" judge result');
  });

  it('rejects unsupported tasks without calling the AI service', async () => {
    const adapter = new HttpLlmAdapter('http://127.0.0.1:8000', 5000);

    await expect(adapter.complete('summarize', {})).rejects.toThrow('Unsupported LLM task "summarize"');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('createLlmAdapter', () => {
  it('returns the HTTP adapter when AI_SERVICE_URL is set', () => {
    expect(createLlmAdapter({ AI_SERVICE_URL: 'http://127.0.0.1:8000' })).toBeInstanceOf(HttpLlmAdapter);
  });

  it('returns the local mock adapter when AI_SERVICE_URL is unset', () => {
    expect(createLlmAdapter({})).toBeInstanceOf(LocalLlmAdapter);
  });

  it('falls back to the default timeout for invalid AI_SERVICE_TIMEOUT_MS values', () => {
    const adapter = createLlmAdapter({ AI_SERVICE_URL: 'http://127.0.0.1:8000', AI_SERVICE_TIMEOUT_MS: 'nope' });
    expect(adapter).toBeInstanceOf(HttpLlmAdapter);
  });
});
