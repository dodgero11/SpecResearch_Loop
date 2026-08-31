# AI API Contract

> **Version:** 2.0
> **Status:** Active
> **Audience:** AI developer integrating the Python `ai_service` with the NestJS backend.

This document defines the boundary between the NestJS backend and the external AI service. The AI developer implements the HTTP endpoints described here (see also `ai_service_contract.md` for the wire-level contract). The backend owns everything else.

---

## 1. Purpose & Ownership

### Backend owns

- HTTP endpoints consumed by the frontend
- Selecting the latest spec version
- Building allowlisted context
- Running the five independent judges
- Persisting `LlmAuditLog` records and `JudgeIssue` rows
- Normalizing provider errors
- Enforcing retries and workflow checkpoints
- Keeping provider secrets out of frontend code and audit context

### AI developer owns

- The Python `ai_service` HTTP endpoints that implement the contracts below
- Real provider adapters (Gemini, ArXiv, etc.) behind those endpoints

---

## 2. Integration Surfaces

The backend talks to the AI service through **two** typed ports:

| Port | Source | Purpose |
|------|--------|---------|
| `LlmPort` | `backend/src/integrations/llm.port.ts` | The 5-judge panel |
| `AiGateway` | `backend/src/integrations/ai-gateway.port.ts` | All non-judge endpoints (clarify, decompose, related-works, gap-analysis, experiments, conflicts, final-spec) |

Both are injected via NestJS DI tokens (`LLM_PORT`, `AI_GATEWAY`) and selected by environment: when `AI_SERVICE_URL` is set the HTTP adapters are used; otherwise local mocks are used for tests and local development.

---

## 3. `LlmPort` — Judge Panel

```ts
export type LlmResponse = {
  output: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
};

export interface LlmPort {
  complete(task: string, inputContext: Record<string, unknown>): Promise<LlmResponse>;
  completePanel?(task: string, inputContext: Record<string, unknown>): Promise<LlmResponse>;
}
```

The adapter receives one task at a time:

```text
gap-judge
contribution-judge
experiment-judge
evidence-judge
conference-readiness-judge
```

It must return structured JSON (never prose that requires backend string parsing). When `completePanel` is implemented, the backend makes a single panel call and slices per-judge results.

### Judge context allowlists

The backend `ContextBuilderService` constructs context before calling the LLM. The AI adapter must consume the supplied context as-is and must not request raw chat history.

| Task | Allowed fields |
|------|----------------|
| `gap-judge` | `problem`, `gap`, `relatedWork` |
| `contribution-judge` | `problem`, `gap`, `contribution`, `relatedWork` |
| `experiment-judge` | `claims`, `baselines`, `experiment` |
| `evidence-judge` | `claims`, `evidence`, `relatedWork` |
| `conference-readiness-judge` | `problem`, `gap`, `contribution`, `claims`, `evidence`, `experiment`, `relatedWork` |

The backend records the exact context and `specVersionUsed` in `LlmAuditLog`.

### Judge issue shape

Each judge result may include an `issues` array. The backend normalizes each issue to:

```json
{
  "severity": "MINOR",
  "title": "Short title",
  "description": "Detailed description",
  "suggestion": "Suggested fix",
  "flaggedBy": "gap",
  "choices": [
    { "letter": "A", "label": "Option label", "understanding": "How the system interprets this choice" }
  ]
}
```

---

## 4. `AiGateway` — Non-Judge Endpoints

The `AiGateway` port (`backend/src/integrations/ai-gateway.port.ts`) defines one method per AI endpoint. All methods return `{ output, inputTokens?, outputTokens? }`.

```ts
export interface AiGateway {
  understandIdea(idea: string, feedback?: string): Promise<AiGatewayResponse>;
  generateQuestions(clarifiedIdea: string): Promise<AiGatewayResponse>;
  decompose(context: Record<string, unknown>): Promise<AiGatewayResponse>;
  relatedWorks(problem: string, researchQuestion: string, keywords?: string[]): Promise<AiGatewayResponse>;
  gapAnalysis(gapCandidate: string, relatedWorks: unknown[]): Promise<AiGatewayResponse>;
  specExperiment(problem: string, gap: string, direction?: string): Promise<AiGatewayResponse>;
  singleClaimExperiment(claimEvidence: Record<string, unknown>): Promise<AiGatewayResponse>;
  finalSpec(payload: Record<string, unknown>): Promise<AiGatewayResponse>;
  conflicts(claimEvidencePairs: unknown[], relatedWorks: unknown[]): Promise<AiGatewayResponse>;
}
```

### 4.1 Understand the idea

`POST /ai/v1/clarify/understand`

**Request**

```json
{ "idea": "Build a multi-agent system to detect hallucinated citations", "feedback": "Focus on claim-level verification" }
```

**Response**

```json
{
  "clarified_idea": "Hệ thống hiểu ý tưởng: ...",
  "key_issues": ["Cần làm rõ phạm vi", "Cần xác định baseline"],
  "confidence": 0.7
}
```

### 4.2 Generate confirmation questions

`POST /ai/v1/clarify/questions`

**Request**

```json
{ "clarified_idea": "Hệ thống hiểu ý tưởng: ..." }
```

**Response** — `options` is a flat string array; `"Other"` is always the last element (no `allow_other` flag).

```json
{
  "questions": [
    { "question": "Tác vụ chính là gì?", "example": "Ví dụ: trích xuất thông tin từ paper.", "options": ["Trích xuất thông tin", "Tóm tắt tài liệu", "Other"] }
  ]
}
```

### 4.3 Decompose into 8 seed cards

`POST /ai/v1/decompose`

**Request** — the backend passes the confirmed idea + answers.

```json
{
  "idea": "...",
  "clarifiedIdea": "...",
  "answers": [ { "questionId": "q1", "title": "Tác vụ chính là gì?", "selectedIndex": 0, "customAnswer": null } ]
}
```

**Response** — exactly the 8 fixed card types, all `status: "PROPOSED"`. The backend **forces** `PROPOSED` regardless of what the AI returns.

```json
{
  "cards": [
    { "type": "PROBLEM", "content": "...", "status": "PROPOSED" },
    { "type": "RESEARCH_QUESTION", "content": "...", "status": "PROPOSED" },
    { "type": "GAP_CANDIDATE", "content": "...", "status": "PROPOSED" },
    { "type": "CONTRIBUTION", "content": "...", "status": "PROPOSED" },
    { "type": "CLAIM", "content": "...", "status": "PROPOSED" },
    { "type": "EVIDENCE", "content": "...", "status": "PROPOSED" },
    { "type": "CONSTRAINT", "content": "...", "status": "PROPOSED" },
    { "type": "OPEN_QUESTION", "content": "...", "status": "PROPOSED" }
  ]
}
```

### 4.4 Load related works

`POST /ai/v1/related-works`

**Request**

```json
{
  "problem": "...",
  "research_question": "...",
  "keywords": ["multi-agent systems", "hallucination mitigation"]
}
```

**Response**

```json
{
  "related_works": [
    {
      "paper_title": "Mitigating Hallucinations in Multi-Agent Systems",
      "authors": "John Doe, Jane Smith",
      "year": 2024,
      "what_they_did": "...",
      "feedback": "...",
      "missing_points": "...",
      "source_url": "https://arxiv.org/abs/2401.12345",
      "source_type": "proceedings"
    }
  ]
}
```

### 4.5 Gap analysis + focus directions

`POST /ai/v1/gap-analysis`

**Request**

```json
{
  "gap_candidate": "...",
  "related_works": [ { "paper_title": "...", "source_url": "..." } ]
}
```

**Response** — `directions` are A–D generated per idea (not hardcoded).

```json
{
  "what_was_done": "...",
  "limitation": "...",
  "why_it_matters": "...",
  "testable_with": "...",
  "directions": [
    { "letter": "A", "label": "Claim–evidence verifier", "description": "..." },
    { "letter": "B", "label": "...", "description": "..." },
    { "letter": "C", "label": "...", "description": "..." },
    { "letter": "D", "label": "...", "description": "..." }
  ]
}
```

### 4.6 Generate the experiment plan

`POST /ai/v1/spec-experiment`

**Request**

```json
{ "problem": "...", "gap": "...", "direction": "A" }
```

**Response**

```json
{
  "contributions": ["Đóng góp 1", "Đóng góp 2"],
  "claims": [
    { "claim": "...", "baseline": "...", "metric": "...", "evidence": "...", "rejection_condition": "..." }
  ],
  "experiments": [
    { "name": "TN1", "protocol": "...", "expected_outcome": "..." }
  ],
  "feasibility_estimation": {
    "model_name": "Llama-3-8B-Instruct",
    "seed_prompts_count": 5,
    "candidates_count": 3,
    "vram_needed_gb": 16.5,
    "tokens_estimated": 45000,
    "gpu_time_hours": 0.5,
    "is_feasible": true,
    "explanation": "..."
  }
}
```

### 4.7 Generate a single-claim experiment

`POST /ai/v1/spec-experiment/single-claim`

**Request**

```json
{ "claim": "...", "baseline": "...", "metric": "...", "evidence": "...", "rejection_condition": "..." }
```

**Response**

```json
{ "experiment": { "name": "TN: Claim mới", "protocol": "...", "expected_outcome": "..." } }
```

### 4.8 Generate the final spec

`POST /ai/v1/final-spec`

**Request**

```json
{
  "project_title": "...",
  "problem": "...",
  "gap": "...",
  "related_work": [],
  "contribution": "...",
  "claims": [],
  "experiments": [],
  "judges_summary": [],
  "decision_log": []
}
```

**Response**

```json
{
  "markdown_content": "# Research Specification\n\n## Problem\n...",
  "spec_json": { "title": "...", "problem": "...", "gap": "...", "contribution": "...", "claims": [], "experiments": [] }
}
```

### 4.9 Detect claim–evidence conflicts

`POST /ai/v1/conflicts/check`

**Request**

```json
{
  "claim_evidence_pairs": [
    { "claimCardId": "claim-1", "evidenceCardId": "ev-1", "claim": "Claim text", "evidence": "Evidence text" }
  ],
  "related_works": [ { "paper_title": "...", "source_url": "..." } ]
}
```

**Response** — only genuinely conflicting pairs; `linked_sources` names the related works that contradict the claim.

```json
{
  "conflicts": [
    {
      "claim_card_id": "claim-1",
      "evidence_card_id": "ev-1",
      "linked_sources": [ { "paper_title": "...", "source_url": "..." } ],
      "reason": "Bằng chứng hiện tại chưa đủ để xác nhận claim..."
    }
  ]
}
```

---

## 5. Backend-Internal Diagnostic Endpoints

These routes are for backend integration testing and provider diagnostics. They are **not** part of the frontend API and must not be called from browser code. In production they are protected by the `InternalApiKeyGuard` requiring the `x-api-key` header (`INTERNAL_API_KEY`).

### Run one Gap Judge

```text
POST /internal/ai/projects/:projectId/judges/gap
```

Useful for focused debugging.

### Run the independent judge panel

```text
POST /internal/ai/projects/:projectId/judges/panel
```

The backend executes the five judges and returns:

```json
{
  "projectId": "project-id",
  "specVersionUsed": 4,
  "status": "COMPLETED",
  "judges": [
    { "type": "gap", "status": "COMPLETED", "specVersionUsed": 4, "output": { "verdict": "REVIEW_REQUIRED", "issues": [] } }
  ]
}
```

`PARTIAL_FAILURE` means at least one provider call failed or returned a result for a different spec version.

---

## 6. External Provider Configuration

The API key belongs only in backend runtime configuration:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spec_research_loop?schema=public
PORT=3000
INTERNAL_API_KEY=<secret-for-internal-diagnostics>
AI_SERVICE_URL=http://127.0.0.1:8000
AI_SERVICE_TIMEOUT_MS=30000
```

Never put provider keys in:

- Frontend or browser code
- Frontend environment files
- Request bodies
- Git-tracked documentation
- `LlmAuditLog.inputContext`

The local adapters are the default test doubles. A production adapter is selected through configuration without changing controllers, context builders, or Prisma models.

---

## 7. Provider Error Contract

Adapters must normalize external failures into typed application errors so the backend can apply policy:

- Timeout, temporary network failure, and HTTP 429: retryable
- Malformed provider JSON: terminal for that attempt
- HTTP 401/403: terminal configuration error
- Invalid request or context: terminal input error
- Provider safety refusal: terminal result requiring review

Do not implement unbounded retries inside the adapter.

---

## 8. Adapter Completion Criteria

An AI adapter is ready when it:

1. Implements the relevant backend port (`LlmPort` or `AiGateway`).
2. Reads secrets only from runtime configuration.
3. Returns schema-valid structured output.
4. Reports token usage when the provider exposes it.
5. Has mocked unit tests with no network calls.
6. Has timeout and error normalization tests.
7. Preserves the task name and does not expand the supplied context.
8. Can be selected without modifying the frontend contract.