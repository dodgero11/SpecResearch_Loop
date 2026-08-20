# Backend Task Contracts

Tasks are independent only after their inputs and outputs are fixed. Each task owns its files and tests; integration is performed after all contracts pass.

## TASK-001: Persistence foundation
**Owner:** backend schema agent  
**Scope:** Prisma models, Prisma service, migrations, database health check.  
**Contract:** expose `ResearchProject`, immutable `SpecIteration`, `WorkflowRun`, `ComponentState`, `LlmAuditLog`, `DecisionLog`, and `ConfirmationQuestion`.  
**Acceptance:** unique project/version and run/step constraints exist; schema generates.  
**Verify:** `npx prisma validate && npx prisma generate`.

## TASK-002: Project and version service
**Owner:** project agent  
**Scope:** project/spec/decision application services and DTOs.  
**Contract:** `createSpec(projectId, data, idempotencyKey)`, `getLatestSpec(projectId)`, `updateNode(projectId, node, value, idempotencyKey)`.  
**Acceptance:** updates create a new version, preserve old data, and invalidate dependents transactionally.

## TASK-003: Resumable workflow engine
**Owner:** workflow agent  
**Scope:** run creation, step runner, checkpoint repository, retry classifier.  
**Contract:** `startOrResume(runId)` reads persisted `currentStep` and skips completed steps; successful output and checkpoint are one transaction.  
**Acceptance:** Step 7 timeout resumes at 7 and does not invoke steps 1-6.

## TASK-004: Context and judge contracts
**Owner:** context/judge agent  
**Scope:** allowlisted context builder, LLM port, audit service, judge aggregation.  
**Contract:** `build(task, projectId)` resolves latest version at call time and returns `{ specVersion, inputContext }`; `runGapJudge` persists that version in the audit log.  
**Acceptance:** version 4 is used after a Gap update from version 3.

## TASK-005: Evidence verification
**Owner:** verification agent  
**Scope:** search, rerank, and NLI ports plus verification application service.  
**Contract:** verification returns `SUPPORTED`, `CONTRADICTED`, or `INSUFFICIENT` only after NLI.  
**Acceptance:** similarity-only results cannot be marked verified.

## TASK-006: API integration and tests
**Owner:** integration agent  
**Scope:** module wiring, controllers, validation, contract tests, and documentation.  
**Contract:** HTTP endpoints delegate to application services and never contain workflow logic.  
**Acceptance:** all documented scenarios pass and the three completion gates are green.
