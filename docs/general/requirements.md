# Product Requirements

## Scope
SpecResearch Loop turns a research idea into a versioned, evidence-backed specification. The Flutter client consumes JSON APIs; backend implementation details are documented separately.

## Actors
- **User:** creates projects, edits spec nodes, answers confirmation questions, and accepts or overrides judge decisions.
- **Workflow engine:** executes research refinement and preserves progress across failures.
- **LLM judges:** five independent evaluators that assess the current specification.
- **Search and verifier services:** retrieve sources and classify claim/evidence entailment.

## Functional Requirements

### REQ-01: Immutable versioning
Every material spec change creates exactly one new version. Previous versions remain readable and every judge result identifies the exact version used.

### REQ-02: Targeted context
Each judge receives only the context required for its task. The Gap Judge receives Problem, Gap, and Related Work, not raw UI chat history or unrelated artifacts.

### REQ-03: Durable state recovery
A workflow can resume from its persisted checkpoint after a temporary external failure without repeating completed work.

### REQ-04: Dependency invalidation
Changing a parent node invalidates dependent work. For MVP, changing Gap invalidates Contribution, Claim, Evidence, and Experiment outputs.

### REQ-05: Verification
Evidence verification uses search, reranking, and NLI. Outcomes are `SUPPORTED`, `CONTRADICTED`, or `INSUFFICIENT`.

### REQ-06: Human confirmation and auditability
User decisions, overrides, and confirmation answers are preserved as history and can be reviewed later.

## Product constraints
- The MVP is a modular application, not a collection of microservices.
- The frontend communicates through stable HTTP contracts.
- Historical versions and user decisions must not be silently overwritten.
***