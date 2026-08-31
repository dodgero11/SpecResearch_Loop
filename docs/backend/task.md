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
**Acceptance:** latest spec version is used and recorded in `LlmAuditLog`; the panel runs Gap, Contribution, Experiment, Evidence, and Conference Readiness judges independently and reports partial failure.

## TASK-005: Evidence verification [REMOVED]
**Scope:** search, rerank, and NLI ports, local adapters, verification service, endpoint, and tests.
**Status:** Removed on 2026-08-31. The verification pipeline was dormant infrastructure not used by the six-step flow; the evidence judge runs through the LLM panel instead. `VerificationService`, its controller, the search/rerank/NLI ports, and their local adapters were deleted.

## TASK-006: API integration and tests [IMPLEMENTED]
**Scope:** module wiring, controllers, validation, stable response DTOs, local adapters, HTTP contract tests, and documentation.  
**Acceptance:** HTTP project, workflow, judge, decision, confirmation, health, and validation flows pass.

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

## TASK-012: Frontend workflow phases and decomposition cards [IMPLEMENTED]
**Scope:** named six-phase product workflow, immutable decomposition cards, typed card statuses/types, graph links, and frontend-facing HTTP contracts.  
**Implemented:** `WorkflowPhase`, `SpecCard`, `SpecCardLink`, stable card lineage, additive migrations, card/link CRUD routes, project summary/history reads, sequential phase transitions, phase-aware workflow responses, and complete HTTP coverage for the frontend workflow slice.  
**Boundary:** persisted judge result entities remain a separate AI/backend result-persistence task; internal AI routes remain protected and are not frontend endpoints.

## TASK-013: Dependency-graph invalidation and selective recomputation [IMPLEMENTED]
**Scope:** declarative workflow-node dependency graph, generalized downstream invalidation, invalidation query API, and selective judge recomputation for every editable workflow step.  
**Implemented:** `DependencyGraphService` defines the node graph and transitive-closure/order helpers; `ProjectService.updateNode` and `SpecCardService` mark all downstream nodes stale; `GET /projects/:projectId/invalidations` reports stale versus fresh nodes; `POST /projects/:projectId/recompute` reruns stale judges in dependency order into a new immutable spec version.  
**Acceptance:** editing `problem`, `related_work`, `gap`, `contribution`, `claim`, or `experiment` invalidates exactly the transitive dependent nodes; editing a `GAP_CANDIDATE`/`CONTRIBUTION`/`CLAIM` card triggers the same invalidation; recompute creates a new version with fresh artifacts and is rejected while a workflow is running. The judge panel is aligned to the original five: `gap`, `contribution`, `experiment`, `evidence`, `conference-readiness` (the `problem`/`claim` judges and the separate `claim-verifier` task are removed; `evidence` absorbs the claim-verification role).

## TASK-014: Six-step research flow [IMPLEMENTED]
**Scope:** the frontend-driven six-step flow: clarify, decompose, related-works, gap analysis, conflicts, experiments, issues, and final spec.
**Implemented:** `ClarifyService` (understand/questions/answers), `DecomposeService` (8 seed cards, all `PROPOSED`, `isSeed`), `ResearchService` (related-works, gap-analysis + select, AI-driven conflicts/check + resolve), `ExperimentService` (spec-experiment, contributions, claim-evidence, feasibility, confirm), `IssueService` (persisted `JudgeIssue` rows, resolve re-runs the flagging judge), `FinalSpecService` (temporary spec, finalize, final-spec, confirm, PDF export), and the `AiGateway` port + HTTP/local adapters.
**Acceptance:** each step endpoint persists state in a new immutable spec version; cards and links are cloned forward on every new version; conflicts/check calls the AI service; the final spec can be generated, confirmed, and exported as PDF.
