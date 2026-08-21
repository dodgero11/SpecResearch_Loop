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
