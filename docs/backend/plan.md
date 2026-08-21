# Backend Implementation Plan

## Delivery order
1. Foundation: NestJS bootstrap, configuration, Prisma schema, and health endpoint.
2. Project contracts: immutable spec creation/update, latest-version query, decisions, and confirmation APIs.
3. Workflow engine: persisted run/checkpoint state, ordered steps, idempotency, retry classification, and invalidation.
4. Context and judges: allowlisted context builders, LLM port, audit records, five-judge orchestration, and stale-result handling.
5. Verification: search/rerank/NLI ports, pipeline persistence, and classification tests.
6. Hardening: DTO validation, transaction tests, API documentation, and operational logging.

## Current status
- Foundation, immutable versioning, idempotency, dependency invalidation, decision history, confirmation questions, HTTP controllers, local adapters, and focused tests are implemented.
- The initial migration and additive migration `20260821120814_add_idempotency_and_artifacts` are applied.
- Flutter integration is deferred because the frontend project is not available.

## Definition of done
Every task has a typed contract, focused tests, no raw chat history in an LLM request, and passing `npm test`, `npm run lint`, and `npm run build`. PostgreSQL integration tests are required for transaction and uniqueness behavior.

## Risks and mitigations
- Stale spec: resolve the maximum version immediately before context construction and audit it.
- Duplicate retry side effects: use unique `(workflowRunId, step)` state and reuse completed output.
- Lost progress: write checkpoint fields transactionally after each successful step.
- Provider instability: bounded backoff for timeout/rate-limit errors; no automatic retry for malformed or unauthorized responses.
- Context bloat: allowlist fields per task and audit token counts without storing UI history.
- Concurrent runs: use database row locking or optimistic version checks.
