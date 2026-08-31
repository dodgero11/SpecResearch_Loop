# Product Architecture

## High-level flow

```
UI (frontend) → HTTP API (NestJS backend) → AI service (Python ai_service) → persisted project state (PostgreSQL)
```

The frontend depends only on HTTP contracts and never touches Prisma models, PostgreSQL tables, or the AI service directly. All AI execution is mediated by the backend.

## Product capabilities

- Project and immutable specification versioning
- Six-step research workflow (clarify → decompose → research/gap → experiment → judge → final spec)
- 8 fixed seed cards with user-controlled statuses and dependency-graph invalidation
- Related-work loading, gap analysis with A–D focus directions, and claim–evidence conflict detection
- Contribution / claim–evidence / experiment / feasibility planning
- Five independent AI judges with persisted, resolvable issues
- Final spec generation (Markdown + JSON) and PDF export
- Human decisions and confirmation questions

## Backend boundary

The backend owns persistence, immutable versioning, dependency invalidation, the AI gateway adapters, audit records, API validation, and the six-step orchestration. Its NestJS module and Prisma details belong in backend documentation.

## Frontend boundary

The frontend owns presentation, user interaction, local view state, and HTTP client integration. It drives the six-step flow through the endpoints in [frontend-api.md](frontend-api.md).

## AI service boundary

The Python `ai_service` implements the generation and judge endpoints defined in [ai-api.md](ai-api.md) and [ai_service_contract.md](ai_service_contract.md). The backend selects it via `AI_SERVICE_URL`; local mocks are used for tests and local development when it is unset.