# Backend Task Contracts

Tasks are independent only after their inputs and outputs are fixed. Each task owns its files and tests; integration is performed after all contracts pass.

## TASK-001: Persistence foundation [IMPLEMENTED]
**Scope:** Prisma models, Prisma service, migrations, and database health check.  
**Acceptance:** unique project/version and run/step constraints exist; schema generates. Additive migration `20260821120814_add_idempotency_and_artifacts` is applied; the original migration remains unchanged.

## TASK-002: Project and version service [IMPLEMENTED]
**Scope:** project/spec/decision application services and DTOs.  
**Contract:** immutable versions, idempotency-aware mutations, latest-spec reads, and transactional Gap dependency invalidation. Decision and confirmation services append history.

## TASK-003: Resumable workflow engine [IMPLEMENTED]
**Scope:** run lifecycle, step runner, checkpoint repository, retry behavior, and status/resume endpoints.  
**Acceptance:** a persisted checkpoint resumes at the first incomplete step and does not invoke completed steps again.

## TASK-004: Context and judge contracts [IMPLEMENTED]
**Scope:** allowlisted context builder, LLM port, five independent judge executions, panel endpoint, audit service, and adapter contracts.  
**Acceptance:** latest spec version is used and recorded in `LlmAuditLog`; the panel runs Problem, Gap, Contribution, Claim, and Experiment judges independently and reports partial failure.

## TASK-005: Evidence verification [IMPLEMENTED]
**Scope:** search, rerank, and NLI ports, local adapters, verification service, endpoint, and tests.  
**Acceptance:** verification returns `SUPPORTED`, `CONTRADICTED`, or `INSUFFICIENT` only after NLI.

## TASK-006: API integration and tests [IMPLEMENTED]
**Scope:** module wiring, controllers, validation, stable response DTOs, local adapters, HTTP contract tests, and documentation.  
**Acceptance:** HTTP project, workflow, judge, verification, decision, confirmation, health, and validation flows pass.

## TASK-007: Backend production hardening [IMPLEMENTED]
**Scope:** backend-only production readiness: internal route protection, secret-safe configuration, request logging, rate limiting, and API error standardization.  
**Acceptance:** internal AI routes are protected, runtime config is validated at startup, secrets remain out of logs and audits, and unauthenticated access is blocked.

## TASK-008: Workflow resilience and concurrency hardening [IMPLEMENTED]
**Scope:** explicit concurrency tests, retry classification, bounded backoff, stale-result prevention, and checkpoint consistency validation.  
**Acceptance:** overlapping workflow runs and stale spec races are tested; retry behavior distinguishes transient provider failures from malformed or permission errors; checkpoint state is consistent across resume attempts.

## TASK-009: Observability and operations [IMPLEMENTED]
**Scope:** structured logging, correlation IDs, health checks, workflow diagnostics, and operational visibility for provider latency and step timing.  
**Acceptance:** backend operators can diagnose failed or stalled runs without raw chat content; health endpoints report dependency status and request metadata is traceable.

## TASK-010: Release readiness and deployment documentation [IMPLEMENTED]
**Scope:** migration safety, rollback checks, environment documentation, openapi/contract polish, and final backend release checklist.  
**Acceptance:** deployment instructions, migration safety, and backend release criteria are documented and match the implementation; the backend can be shipped with a clear operational checklist.

## TASK-011: API error normalization and structured failures [IMPLEMENTED]
**Scope:** consistent HTTP error envelope, request metadata propagation, and stable failure payloads across validation and application errors.  
**Acceptance:** every handled error is returned through a consistent JSON structure including statusCode, error name, message, path, and method; the global filter is active in the Nest bootstrap.
