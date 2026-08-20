# Architecture Blueprint

## Runtime flow
Flutter UI -> HTTP controllers -> application services -> Prisma/PostgreSQL. Workflow services call LLM, search, and NLI ports; adapters own provider-specific details. Long-running work is internally scheduled and always reloads its checkpoint before doing work.

## Modules and ownership
- **ProjectModule:** project creation, latest-spec reads, immutable spec updates, decisions, and confirmation APIs.
- **WorkflowModule:** run lifecycle, ordered steps, checkpoint transactions, retry classification, idempotency, and dependency invalidation.
- **ContextBuilderModule:** latest-spec resolution and task-specific allowlisted context. No other module builds prompts.
- **VerificationModule:** claim -> search -> rerank -> NLI pipeline and evidence result persistence.
- **JudgeModule:** five independent judge executions, audit creation, finding aggregation, and stale-result detection.
- **IntegrationsModule:** ports and provider adapters for LLM, search, reranking, and NLI.

## Durable model
`ResearchProject` references `latestSpecId`; `SpecIteration` is immutable. `WorkflowRun` stores the checkpoint and `ComponentState` stores per-step idempotency/output state. `LlmAuditLog` records task, spec version, bounded input context, and token metrics. `DecisionLog` and `ConfirmationQuestion` preserve human-in-the-loop history.

## Workflow contract
Steps are numbered and ordered. Before executing a step, the engine reloads the run, checks `ComponentState` for an existing completed output, and marks the step running. On success it writes the output and checkpoint in one transaction. On retryable failure it stores the error without clearing completed steps. A run is complete only when every step has a completed state.

## Consistency and security
Spec creation, latest pointer movement, and dependent invalidation use one database transaction. Provider errors are normalized into retryable or terminal categories. API DTOs validate input, and logs exclude secrets and raw conversation history.