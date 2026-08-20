# Backend Requirements

## Scope
The backend is a NestJS modular monolith that turns a research idea into a versioned, evidence-backed specification. PostgreSQL is the source of truth for workflow state, artifacts, decisions, and LLM audit records. The Flutter client consumes JSON APIs.

## Actors
- **User:** creates projects, edits spec nodes, answers confirmation questions, and accepts or overrides judge decisions.
- **Workflow engine:** persists checkpoints, executes resumable steps, and invalidates dependent artifacts.
- **LLM judges:** five independent evaluators that receive targeted context and return structured findings.
- **Search and verifier adapters:** retrieve sources and classify claim/evidence entailment.

## Functional Requirements

### REQ-01: Immutable versioning
Every material spec change creates exactly one new `SpecIteration` with a monotonically increasing `(projectId, version)` pair. Existing iterations are never updated or deleted. The project atomically points `latestSpecId` to the new iteration. Every judge result and LLM audit record identifies the exact spec version used.

### REQ-02: Targeted context
`ContextBuilderService` is the only service allowed to construct LLM input context. Each task declares an allowlist of fields. For example, the Gap Judge receives the latest Problem, Gap, and Related Work nodes; it does not receive raw UI chat history or unrelated artifacts. The produced context is JSON-serializable and stored in `LlmAuditLog`.

### REQ-03: Durable state recovery
Each workflow run persists `currentStep`, `completedSteps`, `latestSpecVersion`, artifacts, status, and the last error. A retry loads this record from PostgreSQL and starts at the first incomplete step. Completed steps are not executed again. A timeout or HTTP 429 is retryable; malformed output, authorization failure, and invalid input are terminal until corrected.

### REQ-04: Dependency invalidation
Changing a parent node marks all transitive dependent nodes stale in the same transaction. For MVP, Gap changes invalidate Contribution, Claim, Evidence, and Experiment artifacts. Historical spec versions remain readable, and the workflow engine schedules only affected recomputations.

### REQ-05: Verification
Evidence verification is a pipeline: claim extraction, search, reranking, and NLI. NLI outcomes are `SUPPORTED`, `CONTRADICTED`, or `INSUFFICIENT`; vector similarity alone cannot mark a claim verified.

### REQ-06: Human confirmation and auditability
User decisions, overrides, and confirmation answers are append-only records. APIs expose decision history and audit metadata sufficient to reproduce which version and context produced a result.

## Non-functional requirements
- No Kafka, RabbitMQ, Kubernetes, microservices, or in-memory workflow state in the MVP.
- All externally visible writes are idempotent where a retry can repeat the request.
- Secrets come from environment/configuration and are never persisted in prompts or logs.