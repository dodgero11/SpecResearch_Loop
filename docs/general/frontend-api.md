# Frontend API Contract

> **Version:** 2.0
> **Status:** Active
> **Audience:** Frontend developers integrating with the SpecResearch Loop backend.

This document is the authoritative contract between the frontend client and the NestJS backend. The frontend **must** call the HTTP API described here; it must **not** depend on Prisma models, PostgreSQL tables, or any backend implementation detail.

---

## 1. Overview

The backend exposes a REST API that drives a six-step research specification workflow:

| Step | Purpose | Key endpoints |
|------|---------|---------------|
| 1 | Clarify the raw idea into a confirmed understanding + confirmation questions | `clarify/*` |
| 2 | Decompose the understanding into 8 fixed seed cards | `decompose` |
| 3 | Load related work, run gap analysis, detect claim–evidence conflicts | `related-works`, `gap-analysis`, `conflicts/*` |
| 4 | Generate contributions, claim–evidence, experiments, feasibility | `spec-experiment`, `contributions`, `feasibility` |
| 5 | Run the 5-judge panel, review issues, synthesize the temporary spec | `judges/panel`, `issues`, `spec/temporary` |
| 6 | Generate, confirm, and export the final spec | `final-spec`, `final-spec/export-pdf` |

All state is persisted server-side in **immutable spec versions**. Every mutation creates a new version; historical versions are never changed.

---

## 2. Base URL & Conventions

- **Base URL (local):** `http://localhost:3000`
- **Content type:** `application/json` for requests and responses (except the PDF export, which returns `application/pdf`).
- **Request IDs:** every response includes an `x-request-id` header for correlation and diagnostics.

### HTTP status codes

| Code | Meaning |
|------|---------|
| `200` | Successful read or update |
| `201` | Successful create |
| `202` | Accepted (workflow resume) |
| `400` | Invalid request body or state transition |
| `404` | Resource not found |
| `503` | Service unavailable (e.g. database down) |

### Error response shape

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid payload",
  "path": "/projects",
  "method": "POST"
}
```

---

## 3. Project & Specification Management

### 3.1 Create a project

`POST /projects`

```json
{ "title": "Study reproducibility in software research" }
```

**Response `201`**

```json
{ "id": "project-id", "title": "Study reproducibility in software research" }
```

### 3.2 Load the project workspace

`GET /projects/:projectId/summary`

Returns the project, latest specification, latest-version cards and links, recent workflows, decisions, and confirmation questions — the initial page-load payload.

### 3.3 Read specification history

`GET /projects/:projectId/specs`

Returns immutable specification versions in ascending order.

### 3.4 Read the latest spec

`GET /projects/:projectId/spec/latest`

Returns the current spec version and its `data` blob.

### 3.5 Create a spec version

`POST /projects/:projectId/spec`

```json
{
  "data": { "problem": "Research results are difficult to reproduce", "gap": "..." },
  "idempotencyKey": "spec-create-001"
}
```

Creates a new immutable version. Cards and links from the previous version are carried forward automatically.

### 3.6 Update a spec node

`PUT /projects/:projectId/spec/nodes/:node`

```json
{ "value": "A revised research gap", "idempotencyKey": "gap-update-001" }
```

Updates create a new immutable version and mark all downstream workflow nodes stale. See [§8 Versioning & Invalidation](#8-versioning--invalidation).

### 3.7 Add a related work entry (manual)

`POST /projects/:projectId/related-works`

```json
{
  "title": "A user-added paper",
  "sourceUrl": "https://arxiv.org/abs/2401.99999",
  "year": "2024",
  "whatItDid": "Proposed a claim-level verifier",
  "feedbackType": "No independent evidence check",
  "missingGap": "No claim-level signal",
  "sourceType": "proceedings",
  "idempotencyKey": "related-work-001"
}
```

Appends one entry to the spec's `relatedWork` array, creates a new version, and invalidates downstream nodes. `title` is required; the rest are optional. Duplicate entries (same `sourceUrl`, or same `title` when no URL) are a no-op.

### 3.8 Read node invalidation state

`GET /projects/:projectId/invalidations`

```json
{
  "specIterationId": "spec-id",
  "specVersion": 7,
  "staleNodes": ["contribution", "claim", "experiment", "judge"],
  "freshNodes": ["problem", "related_work", "gap"]
}
```

### 3.9 Recompute stale nodes

`POST /projects/:projectId/recompute`

```json
{ "nodes": ["gap", "contribution"] }
```

Runs the judges for stale workflow nodes in dependency order and creates a new immutable version with fresh artifacts. When `nodes` is omitted, all stale nodes are recomputed. Rejected with `400` if a workflow run is in progress or an invalid node name is supplied.

---

## 4. Cards & Links

Cards are the atomic units of the specification (Step 2). They are immutable-versioned with the specification.

### 4.1 Card types

`PROBLEM`, `RESEARCH_QUESTION`, `GAP_CANDIDATE`, `CONTRIBUTION`, `CLAIM`, `EVIDENCE`, `CONSTRAINT`, `OPEN_QUESTION`

### 4.2 Card statuses

`CONFIRMED`, `PROPOSED`, `MISSING`, `AMBIGUOUS`, `UNSUPPORTED`, `CONFLICT`

### 4.3 Link types

`CLAIM_EVIDENCE`, `DEPENDS_ON`, `SUPPORTS`, `CONTRADICTS`

### 4.4 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/:projectId/cards` | List cards (optionally `?specIterationId=`) |
| `POST` | `/projects/:projectId/cards` | Create a card |
| `PUT` | `/projects/:projectId/cards/:cardId` | Update a card |
| `DELETE` | `/projects/:projectId/cards/:cardId?idempotencyKey=` | Delete a card |
| `GET` | `/projects/:projectId/card-links` | List links |
| `POST` | `/projects/:projectId/card-links` | Create a link |
| `DELETE` | `/projects/:projectId/card-links/:linkId` | Delete a link |

**Create card**

```json
{
  "type": "PROBLEM",
  "content": "Manual prompts are unstable",
  "status": "CONFIRMED",
  "idempotencyKey": "card-001"
}
```

**Update card** — accepts `type`, `content`, `status`, `reason` (user-entered ambiguity/conflict rationale), and `metadata`.

**Delete card** — seed cards (`isSeed: true`, the 8 generated in Step 2) **cannot** be deleted; the backend returns `400`.

> **Note:** card and link IDs are immutable-versioned. Re-fetch `GET /cards` to obtain the latest-version IDs before any subsequent card or link mutation.

---

## 5. Six-Step Research Flow

Each step builds on the previous one. The backend persists state in immutable spec versions.

### Step 1 — Clarify

#### 1a. Understand the idea

`POST /projects/:projectId/clarify/understand`

```json
{ "idea": "Build a multi-agent system to detect hallucinated citations", "feedback": "Focus on claim-level verification" }
```

**Response `201`**

```json
{
  "clarifiedIdea": "Hệ thống hiểu ý tưởng: ...",
  "keyIssues": ["Cần làm rõ phạm vi", "Cần xác định baseline"],
  "confidence": 0.7
}
```

Persists the system's understanding of the idea.

#### 1b. Generate confirmation questions

`POST /projects/:projectId/clarify/questions`

Body `{}`. Generates multiple-choice confirmation questions from the confirmed understanding. Regenerating replaces unanswered questions.

**Response `201`**

```json
{
  "questions": [
    {
      "id": "question-id",
      "title": "Tác vụ chính là gì?",
      "example": "Ví dụ: trích xuất thông tin từ paper.",
      "options": ["Trích xuất thông tin", "Tóm tắt tài liệu", "Other"]
    }
  ]
}
```

> `options` is a flat string array; `"Other"` is always the last element. There is no separate `allow_other` flag.

#### 1c. Submit answers

`POST /projects/:projectId/clarify/questions/answers`

```json
{
  "answers": [
    { "questionId": "question-id", "selectedIndex": 0 },
    { "questionId": "question-id-2", "selectedIndex": 2, "customAnswer": "My own answer" }
  ]
}
```

Batch-saves answers (no AI call). `customAnswer` is required when `selectedIndex` points at `"Other"`.

**Response `201`** → `{ "saved": true }`

### Step 2 — Decompose

`POST /projects/:projectId/decompose`

Body `{}`. Generates the **8 fixed seed cards** (one per card type) from the confirmed idea + answers. All cards are created with `status: "PROPOSED"` and `isSeed: true` (non-deletable). Idempotent: returns existing seed cards if already run.

**Response `201`**

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

The user then edits card statuses manually (e.g. `CONFIRMED`, `MISSING`, `AMBIGUOUS`) and may add extra cards.

### Step 3 — Related work, gap analysis, conflicts

#### 3a. Load related works

`GET /projects/:projectId/related-works`

Loads related works once from the AI service and stores them in the spec. Returns existing results if already loaded. This is a **load-once** operation — filtering/searching is client-side and does not call the API again.

**Response `200`**

```json
{ "results": [ { "paper_title": "OPRO", "authors": "Yang et al.", "year": 2023, "what_they_did": "...", "feedback": "...", "missing_points": "...", "source_url": "https://arxiv.org/abs/2309.03409", "source_type": "proceedings" } ] }
```

#### 3b. Gap analysis + focus directions

`POST /projects/:projectId/gap-analysis`

Body `{}`. Computes the gap analysis from the `GAP_CANDIDATE` card + related work and returns A–D focus directions generated by the AI.

**Response `201`**

```json
{
  "whatWasDone": "...",
  "limitation": "...",
  "whyItMatters": "...",
  "testableWith": "...",
  "directions": [
    { "letter": "A", "label": "Claim–evidence verifier", "description": "..." },
    { "letter": "B", "label": "...", "description": "..." },
    { "letter": "C", "label": "...", "description": "..." },
    { "letter": "D", "label": "...", "description": "..." }
  ]
}
```

#### 3b2. Select a focus direction

`POST /projects/:projectId/gap-analysis/select`

```json
{ "letter": "A" }
```

Persists the chosen direction (marks it `selected: true`) for Step 4. **Response `201`** → `{ "selected": "A", "directions": [...] }`.

#### 3c. Detect claim–evidence conflicts

`POST /projects/:projectId/conflicts/check`

Body `{}`. The backend gathers all linked `CLAIM_EVIDENCE` card pairs + related work and asks the AI service which pairs actually conflict.

**Response `201`**

```json
{
  "conflicts": [
    {
      "id": "claim-card-id__evidence-card-id",
      "claimCardId": "claim-card-id",
      "evidenceCardId": "evidence-card-id",
      "linkedSources": [ { "paper_title": "...", "source_url": "..." } ],
      "reason": "Bằng chứng hiện tại chưa đủ để xác nhận claim...",
      "resolutionOptions": [
        { "letter": "A", "label": "Thu hẹp claim", "description": "..." },
        { "letter": "B", "label": "Đổi cách đo evidence", "description": "..." },
        { "letter": "C", "label": "Hủy claim này", "description": "..." },
        { "letter": "D", "label": "Other", "description": "..." }
      ]
    }
  ]
}
```

Returns an empty array when there are no linked claim–evidence pairs.

#### 3d. Resolve a conflict

`POST /projects/:projectId/conflicts/:conflictId/resolve`

```json
{ "choice": "A", "customResolution": "optional free text" }
```

Applies the chosen resolution to the linked cards and records it in the card's `metadata.resolution`:

- **A** — narrow the claim (status → `PROPOSED`)
- **B** — change the evidence measurement (evidence status → `PROPOSED`)
- **C** — convert the claim to an `OPEN_QUESTION`
- **D** — other (free text stored in metadata)

**Response `201`**

```json
{ "updatedCard": { "id": "...", "status": "PROPOSED", "metadata": { "resolution": { "conflictId": "...", "choice": "A", "resolvedAt": "..." } } }, "invalidatedNodes": ["experiment", "judge"] }
```

### Step 4 — Contributions, claim–evidence, experiments, feasibility

#### 4a. Generate the initial plan

`POST /projects/:projectId/spec-experiment`

Body `{}`. Uses the selected gap direction from Step 3. Returns contributions (paired with claims), experiments, and feasibility.

**Response `201`**

```json
{
  "contributions": [
    { "id": "contrib-1", "label": "Đóng góp 1", "claimEvidence": { "claim": "...", "baseline": "...", "metric": "...", "evidence": "...", "rejectionCondition": "..." } }
  ],
  "experiments": [ { "name": "TN1", "protocol": "...", "expected_outcome": "..." } ],
  "feasibility": { "model_name": "Llama-3-8B-Instruct", "is_feasible": true, "explanation": "..." }
}
```

#### 4b. Add a manual contribution

`POST /projects/:projectId/contributions`

```json
{ "label": "My own contribution" }
```

Creates a contribution with `claimEvidence: null` (no experiment generated). **Response `201`** → `{ "contribution": { "id": "...", "label": "...", "claimEvidence": null } }`.

#### 4c. Save claim–evidence (triggers experiment generation)

`PUT /projects/:projectId/contributions/:id/claim-evidence`

```json
{
  "claim": "...",
  "baseline": "...",
  "metric": "...",
  "evidence": "...",
  "rejectionCondition": "..."
}
```

Generates a new experiment **only when** the contribution has no linked experiment yet. If one already exists, returns `needsReview: true` instead of duplicating.

**Response `200`**

```json
{ "claimEvidence": { "...": "..." }, "experiment": { "name": "TN: Claim mới", "protocol": "...", "expected_outcome": "..." } | null, "needsReview": false }
```

#### 4d. Compute feasibility

`POST /projects/:projectId/feasibility`

```json
{ "selectedContributionIds": ["contrib-1", "contrib-2"] }
```

Scales the AI feasibility estimate by the selected contribution ratio.

**Response `201`**

```json
{
  "model": "Llama-3-8B-Instruct",
  "seedPrompts": 5,
  "rounds": 0,
  "candidates": 3,
  "vram": 16.5,
  "hours": 0.25,
  "tokens": 22500,
  "isFeasible": true,
  "explanation": "..."
}
```

#### 4e. Confirm the plan

`POST /projects/:projectId/spec-experiment/confirm`

```json
{ "selectedContributionIds": ["contrib-1"] }
```

**Response `201`** → `{ "saved": true }`

### Step 5 — Temporary spec, judges, issues

#### 5a. Run the judge panel

`POST /projects/:projectId/judges/panel`

Body `{}`. Runs the 5 independent judges (gap, contribution, experiment, evidence, conference-readiness) and persists any flagged issues as stable `JudgeIssue` rows.

**Response `201`**

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

#### 5b. Read the temporary spec

`GET /projects/:projectId/spec/temporary`

Synthesizes the 6 items the frontend displays.

**Response `200`**

```json
{
  "problemStatement": "...",
  "researchGap": "...",
  "contributions": ["..."],
  "claimEvidenceMatrix": [ { "claim": "...", "baseline": "...", "metric": "...", "evidence": "...", "rejectionCondition": "..." } ],
  "experimentalProtocol": [ { "name": "TN1", "protocol": "...", "expected_outcome": "..." } ],
  "computeBudget": { "model_name": "...", "is_feasible": true }
}
```

#### 5c. List judge issues

`GET /projects/:projectId/issues`

Returns persisted judge issues for the latest spec version.

```json
[
  {
    "id": "issue-id",
    "judgeType": "gap",
    "severity": "MAJOR",
    "title": "...",
    "description": "...",
    "suggestion": "...",
    "flaggedBy": "...",
    "choices": [ { "letter": "A", "label": "...", "understanding": "..." } ],
    "status": "OPEN"
  }
]
```

#### 5d. Resolve an issue

`POST /projects/:projectId/issues/:issueId/resolve`

```json
{ "choice": "A", "customChoice": "optional" }
```

Marks the issue `RESOLVED`, records the choice, marks affected dependency nodes stale, and re-runs the flagging judge to confirm the problem is gone.

**Response `201`**

```json
{ "updatedIssue": { "id": "...", "status": "RESOLVED", "resolvedChoice": "A" }, "invalidatedNodes": ["contribution", "judge"], "judgeResult": { "type": "gap", "status": "COMPLETED", "output": { "issues": [] } } }
```

#### 5e. Finalize the temporary spec

`POST /projects/:projectId/spec/finalize`

Body `{}`. Marks the spec as finalized. **Response `201`** → `{ "saved": true }`

### Step 6 — Final spec & export

#### 6a. Generate the final spec

`POST /projects/:projectId/final-spec`

Body `{}`. Gathers all Step 1–5 data, calls the AI service, and persists the result as a `final-spec` artifact.

**Response `201`**

```json
{
  "markdownContent": "# Research Specification\n\n## Problem\n...",
  "specJson": { "title": "...", "problem": "...", "gap": "...", "contribution": "...", "claims": [], "experiments": [] },
  "before": "Original idea from Step 1",
  "after": "Confirmed contribution label"
}
```

`before`/`after` feed the frontend's ExamplePanel (Trước/Sau).

#### 6b. Confirm the final spec

`POST /projects/:projectId/final-spec/confirm`

Body `{}`. **Response `201`** → `{ "saved": true }`

#### 6c. Export the final spec as PDF

`POST /projects/:projectId/final-spec/export-pdf`

Body `{}`. Returns a binary PDF (`application/pdf`) rendered from the saved `markdownContent`. Returns `404` if the final spec has not been generated.

---

## 6. Human Decisions

- `POST /projects/:projectId/decisions` — record a decision
- `GET /projects/:projectId/decisions` — list decisions

```json
{ "type": "ACCEPT", "target": "gap-judge", "value": { "accepted": true } }
```

Decision types: `ACCEPT`, `REJECT`, `OVERRIDE`. Decisions are append-only and feed the final-spec `decision_log`.

---

## 7. Health Check

`GET /health`

```json
{
  "status": "ok",
  "database": "ok",
  "dependencies": { "database": "ok" }
}
```

Returns `503` with `database: "unavailable"` when the database is down.

---

## 8. Versioning & Invalidation

### 8.1 Immutable versions

Every mutation creates a new `SpecIteration` with an incremented `version`. Historical versions are never updated or deleted. Cards and links are cloned forward on every new version, so the latest version always contains the full card graph.

### 8.2 Dependency graph

```
problem → gap → contribution → claim → experiment → judge
related_work → gap
```

Editing a node marks all transitive dependents `STALE`:

| Edited node | Invalidated nodes |
|-------------|-------------------|
| `problem` | `gap`, `contribution`, `claim`, `experiment`, `judge` |
| `related_work` | `gap`, `contribution`, `claim`, `experiment`, `judge` |
| `gap` | `contribution`, `claim`, `experiment`, `judge` |
| `contribution` | `claim`, `experiment`, `judge` |
| `claim` | `experiment`, `judge` |
| `experiment` | `judge` |
| `judge` | *(none)* |

The `related_work` node is stored under the spec `data` key `relatedWork` (camelCase).

### 8.3 Card type → node mapping

| Card type | Node |
|-----------|------|
| `PROBLEM`, `RESEARCH_QUESTION` | `problem` |
| `GAP_CANDIDATE`, `OPEN_QUESTION` | `gap` |
| `CONTRIBUTION` | `contribution` |
| `CLAIM`, `EVIDENCE` | `claim` |
| `CONSTRAINT` | `experiment` |

---

## 9. Legacy Workflow Engine

The following endpoints belong to the legacy workflow orchestration engine. They are **not** part of the six-step flow (the frontend drives steps directly) but remain available and tested:

- `POST /workflows` — `{ "projectId": "...", "specIterationId": "..." }`
- `GET /workflows/:runId`
- `PUT /workflows/:runId/phase` — `{ "phase": "IDEA_DECOMPOSITION" }`
- `POST /workflows/:runId/resume`

Phases: `IDEA`, `IDEA_DECOMPOSITION`, `RESEARCH_AND_GAP`, `CONTRIBUTION_AND_EXPERIMENT`, `JUDGES_AND_CONFIRMATION`, `FINAL_SPECIFICATION`. Phase advancement is sequential.

---

## 10. Idempotency

Mutations accept an optional `idempotencyKey`. When provided, the backend stores the operation result and returns it for repeated calls with the same key, making retries safe. Keys are scoped per project.