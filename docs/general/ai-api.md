# AI API Contract

## Purpose

This document defines the boundary between the NestJS backend and the external AI/search providers. The AI developer integrates existing external services using an API key; they are not training a new model.

The backend remains responsible for:

- HTTP endpoints consumed by the frontend
- Selecting the latest spec version
- Building allowlisted context
- Running the five independent judges
- Persisting `LlmAuditLog` records
- Normalizing provider errors
- Enforcing retries and workflow checkpoints
- Keeping provider secrets out of frontend code and audit context

The AI developer is responsible for provider adapters that implement the typed backend ports.

## Backend-facing ports

### LLM adapter

Source contract: `backend/src/integrations/llm.port.ts`

```ts
export type LlmResponse = {
  output: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
};

export interface LlmPort {
  complete(task: string, inputContext: Record<string, unknown>): Promise<LlmResponse>;
}
```

The adapter receives one task at a time:

```text
problem-judge
 gap-judge
contribution-judge
 claim-judge
experiment-judge
```

It must return structured JSON. Do not return prose that requires backend string parsing.

### Search adapter

```ts
export interface SearchPort {
  search(query: string): Promise<EvidenceCandidate[]>;
}
```

### Rerank adapter

```ts
export interface RerankPort {
  rerank(claim: string, candidates: EvidenceCandidate[]): Promise<EvidenceCandidate[]>;
}
```

### NLI adapter

```ts
export interface NliPort {
  classify(
    claim: string,
    evidence: EvidenceCandidate[],
  ): Promise<'SUPPORTED' | 'CONTRADICTED' | 'INSUFFICIENT'>;
}
```

## Judge context allowlists

The backend `ContextBuilderService` constructs context before calling the LLM. The AI adapter must consume the supplied context as-is and must not request raw chat history.

| Task | Allowed fields |
|---|---|
| `problem-judge` | `idea`, `problem`, `relatedWork` |
| `gap-judge` | `problem`, `gap`, `relatedWork` |
| `contribution-judge` | `problem`, `gap`, `contribution`, `relatedWork` |
| `claim-judge` | `problem`, `gap`, `contribution`, `claims`, `relatedWork` |
| `experiment-judge` | `claims`, `baselines`, `experiment` |
| `claim-verifier` | `claim`, `evidence` |

The backend records the exact context and `specVersionUsed` in `LlmAuditLog`.

## Backend-internal diagnostic endpoints

These routes are for backend integration testing and provider diagnostics. They are not part of the frontend API and should not be called from Flutter or browser code. In production they are protected by an internal API key guard requiring the `x-api-key` header. The required runtime value is `INTERNAL_API_KEY`.

### Run one Gap Judge

```text
POST /internal/ai/projects/:projectId/judges/gap
```

This route is useful for focused debugging.

### Run the independent judge panel

```text
POST /internal/ai/projects/:projectId/judges/panel
```

The backend executes five independent calls and returns:

```json
{
  "projectId": "project-id",
  "specVersionUsed": 4,
  "status": "COMPLETED",
  "judges": [
    {
      "type": "problem",
      "status": "COMPLETED",
      "specVersionUsed": 4,
      "output": {
        "task": "problem-judge",
        "verdict": "REVIEW_REQUIRED",
        "issues": []
      }
    }
  ]
}
```

The `judges` array contains `problem`, `gap`, `contribution`, `claim`, and `experiment` results. `PARTIAL_FAILURE` means at least one provider call failed or returned a result for a different spec version.

### Verify a claim

```text
POST /internal/ai/verification/claims
```

Request:

```json
{ "claim": "The proposed method improves reproducibility" }
```

The backend runs Search -> Rerank -> NLI and returns one NLI outcome.

## External provider configuration

The API key belongs only in backend runtime configuration, for example:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spec_research_loop?schema=public
PORT=3000
INTERNAL_API_KEY=<secret-for-internal-diagnostics>
LLM_PROVIDER=openai
LLM_API_KEY=<secret>
LLM_MODEL=<model-name>
SEARCH_API_KEY=<secret>
```

Never put provider keys in:

- Flutter or browser code
- frontend environment files
- request bodies
- git-tracked documentation
- `LlmAuditLog.inputContext`

The local adapters are the default test doubles. A production adapter should be selected through configuration without changing controllers, context builders, or Prisma models.

## Provider error contract

Adapters must normalize external failures into typed application errors so the backend can apply policy:

- Timeout, temporary network failure, and HTTP 429: retryable
- Malformed provider JSON: terminal for that attempt
- HTTP 401/403: terminal configuration error
- Invalid request or context: terminal input error
- Provider safety refusal: terminal result requiring review

Do not implement unbounded retries inside the adapter.

## Adapter completion criteria

An AI adapter is ready when it:

1. Implements the relevant backend port.
2. Reads secrets only from runtime configuration.
3. Returns schema-valid structured output.
4. Reports token usage when the provider exposes it.
5. Has mocked unit tests with no network calls.
6. Has timeout and error normalization tests.
7. Preserves the task name and does not expand the supplied context.
8. Can be selected without modifying the frontend contract.

Real provider integration and Flutter connection are separate from this backend contract.
