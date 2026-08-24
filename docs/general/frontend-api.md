# Frontend API Contract

This document is the contract for the client. The frontend must call the HTTP API; it must not depend on Prisma models, PostgreSQL tables, or backend implementation details.

## Local server

Run PostgreSQL, then from `backend/`:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/spec_research_loop?schema=public"
npm run start:dev
```

The default API base URL is `http://localhost:3000`.

## Response conventions

- JSON request and response bodies.
- Successful create operations return HTTP `201`.
- Successful updates and reads return HTTP `200`.
- Workflow resume returns HTTP `202`.
- Invalid request bodies return HTTP `400`.
- Missing resources return HTTP `404`.
- Readiness failures return HTTP `503`.
- Error responses have the shape:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid payload",
  "path": "/projects",
  "method": "POST"
}
```

The backend also emits `x-request-id` on every response for correlation and diagnostics.

## Project and specification

### Create a project

`POST /projects`

```json
{ "title": "Study reproducibility in software research" }
```

### Create a spec version

`POST /projects/:projectId/spec`

```json
{
  "data": {
    "problem": "Research results are difficult to reproduce",
    "gap": "Existing tooling does not capture workflow decisions",
    "relatedWork": ["Paper A"]
  },
  "idempotencyKey": "spec-create-001"
}
```

### Read the latest spec

`GET /projects/:projectId/spec/latest`

### Load project workspace

`GET /projects/:projectId/summary`

Returns the project, latest specification, latest-version cards and links, recent workflows, decisions, and confirmation questions for the initial frontend page load.

### Read specification history

`GET /projects/:projectId/specs`

Returns immutable specification versions in ascending order. Historical versions are never changed by card or spec edits.

### Update a spec node

`PUT /projects/:projectId/spec/nodes/:node`

```json
{ "value": "A revised research gap", "idempotencyKey": "gap-update-001" }
```

Updates create immutable versions. Editing any dependency node marks all downstream workflow nodes stale for the new version. The dependency graph is `related_work → gap → contribution → claim → experiment → judge` (with `problem` feeding `gap` and the judge depending on every node). Editing `problem` invalidates `gap`, `contribution`, `claim`, `experiment`, and `judge`; editing `related_work` invalidates `gap`, `contribution`, `claim`, `experiment`, and `judge`; editing `gap` invalidates `contribution`, `claim`, `experiment`, and `judge`; editing `contribution` invalidates `claim`, `experiment`, and `judge`; editing `claim` invalidates `experiment` and `judge`; editing `experiment` invalidates `judge`; editing `judge` invalidates nothing.

### Read node invalidation state

`GET /projects/:projectId/invalidations`

Returns the latest spec version and which workflow nodes are stale (need recomputation) versus fresh.

```json
{
  "specIterationId": "spec-id",
  "specVersion": 7,
  "staleNodes": ["contribution", "claim", "experiment", "judge"],
  "freshNodes": ["problem", "related_work", "gap"]
}
```

### Recompute stale nodes

`POST /projects/:projectId/recompute`

Runs the judges for stale workflow nodes in dependency order and creates a new immutable spec version with fresh artifacts. Accepts an optional `nodes` array to selectively recompute a subset; when omitted, all stale nodes are recomputed.

```json
{ "nodes": ["gap", "contribution"] }
```

```json
{
  "specIterationId": "spec-id",
  "specVersion": 8,
  "recomputedNodes": ["contribution", "claim", "experiment", "judge"],
  "judgeResults": []
}
```

The recompute is rejected with HTTP `400` if a workflow run is in progress, or if an invalid node name is supplied.

## Workflow

- `POST /workflows` with `{ "projectId": "project-id", "specIterationId": "spec-id" }`
- `GET /workflows/:runId`
- `POST /workflows/:runId/resume`
- `PUT /workflows/:runId/phase` with `{ "phase": "IDEA_DECOMPOSITION" }`

Workflow statuses are `RUNNING`, `COMPLETED`, and `FAILED`. Workflow responses include `id`, `projectId`, `specIterationId`, numeric compatibility fields `currentStep` and `completedSteps`, named phase fields `phase` and `completedPhases`, `artifacts`, `latestSpecVersion`, `status`, and `error`.

Product phases are `IDEA`, `IDEA_DECOMPOSITION`, `RESEARCH_AND_GAP`, `CONTRIBUTION_AND_EXPERIMENT`, `JUDGES_AND_CONFIRMATION`, and `FINAL_SPECIFICATION`. The five AI judges run inside `JUDGES_AND_CONFIRMATION` and are `gap-judge`, `contribution-judge`, `experiment-judge`, `evidence-judge`, and `conference-readiness-judge`. The panel evaluates the spec with these five independent judges.

Phase advancement is sequential. The client cannot skip phases or move a phase backward. Completing a workflow sets the final phase and records all phases as completed.

### Decomposition cards

- `GET /projects/:projectId/cards`
- `GET /projects/:projectId/cards?specIterationId=spec-id`
- `POST /projects/:projectId/cards`
- `PUT /projects/:projectId/cards/:cardId`
- `DELETE /projects/:projectId/cards/:cardId?idempotencyKey=card-remove-001`
- `GET /projects/:projectId/card-links`
- `POST /projects/:projectId/card-links`
- `DELETE /projects/:projectId/card-links/:linkId`

Cards are immutable-versioned with the specification. Supported types are `PROBLEM`, `RESEARCH_QUESTION`, `GAP_CANDIDATE`, `CONTRIBUTION`, `CLAIM`, `EVIDENCE`, `CONSTRAINT`, and `OPEN_QUESTION`. Supported statuses are `CONFIRMED`, `PROPOSED`, `MISSING`, `AMBIGUOUS`, `UNSUPPORTED`, and `CONFLICT`. Card mutations accept an optional `idempotencyKey`.

Card mutations clone the latest version, so historical cards remain readable. A card's `lineageId` identifies the same logical card across versions.

## AI boundary

The frontend does not call AI or provider endpoints directly. AI execution is handled by backend workflow services and backend-internal diagnostic routes documented in [ai-api.md](ai-api.md).

## Human decisions

- `POST /projects/:projectId/decisions`
- `GET /projects/:projectId/decisions`
- `POST /projects/:projectId/confirmations`
- `GET /projects/:projectId/confirmations`
- `PUT /projects/:projectId/confirmations/:questionId`

Decision types are `ACCEPT`, `REJECT`, and `OVERRIDE`. Decisions are append-only.
Confirmation creation accepts `{ "question": "Accept this gap?", "example": "Yes, accept the proposed gap" }`; answers remain append-only state on the question.

## Health check

`GET /health` returns an object similar to:

```json
{
  "status": "ok",
  "database": "ok",
  "dependencies": {
    "database": "ok"
  }
}
```

If the database is not available, the API returns HTTP `503` with the same dependency information and `database: "unavailable"`.

***