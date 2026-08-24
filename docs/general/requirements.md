# Product Requirements

## Scope
SpecResearch Loop turns a research idea into a versioned, evidence-backed specification. The Flutter client consumes JSON APIs; backend implementation details are documented separately.

## Actors
- **User:** creates projects, edits spec nodes, answers confirmation questions, and accepts or overrides judge decisions.
- **Workflow engine:** executes research refinement and preserves progress across failures.
- **LLM judges:** five independent evaluators that assess the current specification: `gap`, `contribution`, `experiment`, `evidence`, and `conference-readiness`.
- **Search and verifier services:** retrieve sources and classify claim/evidence entailment (used by the evidence judge and the verification endpoint).

## Functional Requirements

### REQ-01: Immutable versioning
Every material spec change creates exactly one new version. Previous versions remain readable and every judge result identifies the exact version used.

### REQ-02: Targeted context
Each judge receives only the context required for its task. The `gap` judge receives Problem, Gap, and Related Work; the `contribution` judge receives Problem, Gap, Contribution, and Related Work; the `experiment` judge receives Claims, Baselines, and Experiment; the `evidence` judge receives Claims, Evidence, and Related Work; the `conference-readiness` judge receives the full spec (Problem, Gap, Contribution, Claims, Evidence, Experiment, Related Work). No judge receives raw UI chat history or unrelated artifacts.

### REQ-03: Durable state recovery
A workflow can resume from its persisted checkpoint after a temporary external failure without repeating completed work.

### REQ-04: Dependency invalidation
Changing a parent node invalidates dependent work. The workflow forms a dependency graph `related_work → gap → contribution → claim → experiment → judge` (with `problem` feeding `gap` and the judge depending on every node). Editing any node marks its transitive downstream nodes stale. For example, changing `problem` invalidates `gap`, `contribution`, `claim`, `experiment`, and `judge`; changing `claim` invalidates `experiment` and `judge`; editing `judge` invalidates nothing. Users can query the invalidated set and selectively recompute it.

### REQ-05: Verification
Evidence verification uses search, reranking, and NLI. Outcomes are `SUPPORTED`, `CONTRADICTED`, or `INSUFFICIENT`.

### REQ-06: Human confirmation and auditability
User decisions, overrides, and confirmation answers are preserved as history and can be reviewed later.

## Product constraints
- The MVP is a modular application, not a collection of microservices.
- The frontend communicates through stable HTTP contracts.
- Historical versions and user decisions must not be silently overwritten.
***