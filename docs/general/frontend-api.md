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

### Update a spec node

`PUT /projects/:projectId/spec/nodes/:node`

```json
{ "value": "A revised research gap", "idempotencyKey": "gap-update-001" }
```

Updates create immutable versions. Gap updates mark Contribution, Claim, Evidence, and Experiment stale for the new version.

## Workflow

- `POST /workflows` with `{ "projectId": "project-id", "specIterationId": "spec-id" }`
- `GET /workflows/:runId`
- `POST /workflows/:runId/resume`

Workflow statuses are `RUNNING`, `COMPLETED`, and `FAILED`. Workflow responses include `id`, `projectId`, `specIterationId`, `currentStep`, `completedSteps`, `artifacts`, `latestSpecVersion`, `status`, and `error`.

## AI boundary

The frontend does not call AI or provider endpoints directly. AI execution is handled by backend workflow services and backend-internal diagnostic routes documented in [ai-api.md](../ai/ai-api.md).

## Human decisions

- `POST /projects/:projectId/decisions`
- `GET /projects/:projectId/decisions`
- `POST /projects/:projectId/confirmations`
- `GET /projects/:projectId/confirmations`
- `PUT /projects/:projectId/confirmations/:questionId`

Decision types are `ACCEPT`, `REJECT`, and `OVERRIDE`. Decisions are append-only.

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