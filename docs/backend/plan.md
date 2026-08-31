# Backend Implementation Plan

## Delivery order
1. Foundation: NestJS bootstrap, configuration, Prisma schema, and health endpoint.
2. Project contracts: immutable spec creation/update, latest-version query, decisions, and confirmation APIs.
3. Workflow engine: persisted run/checkpoint state, ordered steps, idempotency, retry classification, and invalidation.
4. Context and judges: allowlisted context builders, LLM port, audit records, five-judge orchestration, and stale-result handling.
5. Six-step research flow: clarify, decompose, related-works, gap analysis, experiments, issues, and final-spec endpoints.
6. Hardening: DTO validation, transaction tests, API documentation, and operational logging.

## Current status
- Foundation, immutable versioning, idempotency, dependency invalidation, decision history, confirmation questions, HTTP controllers, local adapters, five-judge panel orchestration, and focused tests are implemented.
- The six-step research flow is implemented end-to-end: clarify (understand/questions/answers), decompose (8 seed cards), related-works + gap analysis + conflicts (AI-driven), spec-experiment/contributions/feasibility, judges/panel + issues + temporary spec, and final-spec + PDF export.
- The backend MVP is functionally complete and passes the current test, lint, and build gates.
- Real external provider adapters remain an AI integration task behind the typed ports documented in `../general/ai-api.md`.
- The initial migration and additive migrations through `20260830233423_add_clarification_and_judge_issues` are applied.
- Flutter integration is deferred because the frontend project is not available.
- Frontend integration phase 1 is implemented: named product phases, immutable specification cards, card graph links, and frontend-facing card endpoints are available.
- TASK-012 is complete: summary/history reads, versioned card/link removal, stable card lineage, and sequential phase advancement are implemented and covered by HTTP tests.
- TASK-013 is complete: dependency-graph invalidation and selective recomputation allow users to edit any past workflow step and invalidate/recompute its dependent nodes instead of rerunning from scratch. The judge panel is aligned to the original five (`gap`, `contribution`, `experiment`, `evidence`, `conference-readiness`); the `problem`/`claim` judges and the separate `claim-verifier` task were removed.
- Cards and links are cloned forward on every new spec version, so the latest version always contains the full card graph.
- Remaining backend-only work is production hardening: internal route protection, runtime configuration, logging/observability, workflow concurrency checks, API contract polish, structured error handling, and deployment readiness.

## Definition of done
Every task has a typed contract, focused tests, no raw chat history in an LLM request, and passing `npm test`, `npm run lint`, and `npm run build`. PostgreSQL integration tests are required for transaction and uniqueness behavior. For a production-grade backend, the following backend-only hardening items must also be covered: internal auth, secret-safe configuration, observability, resilience checks, and release-readiness documentation.

## Risks and mitigations
- Stale spec: resolve the maximum version immediately before context construction and audit it.
- Duplicate retry side effects: use unique `(workflowRunId, step)` state and reuse completed output.
- Lost progress: write checkpoint fields transactionally after each successful step.
- Provider instability: bounded backoff for timeout/rate-limit errors; no automatic retry for malformed or unauthorized responses.
- Context bloat: allowlist fields per task and audit token counts without storing UI history.
- Concurrent runs: use database row locking or optimistic version checks.
