# Acceptance Criteria and Test Scenarios

## AC-01: Immutable spec update
Given project version 3 exists, updating Gap creates version 4, points the project to version 4, and leaves version 3 unchanged. Repeating the same request with the same idempotency key does not create version 5.

## AC-02: Checkpoint resume
Given a run has steps 1 through 6 in `completedSteps` and `currentStep = 7`, when the Judge adapter times out, a retry loads the checkpoint, executes step 7 only, and never invokes steps 1 through 6.

## AC-03: Latest context
Given a project has version 3 and a Gap edit creates version 4, when `run_gap_judge` starts, the context builder resolves version 4 at execution time and the audit record stores `specVersionUsed = 4`.

## AC-04: Invalidation
Given a completed version has Gap, Contribution, Claim, Evidence, and Experiment outputs, when Gap changes, dependent outputs become `STALE` while the historical version remains available.

## AC-05: Verification classification
Given a claim and retrieved evidence, the verifier returns exactly one NLI outcome. A similarity score without NLI cannot produce a verified claim.

## AC-06: Human decision trace
Given a judge finding, accepting, rejecting, or overriding it appends a decision record. No prior decision is overwritten.

## AC-07: Generalized dependency invalidation
Given a completed version with all nodes, when `problem` changes, `gap`, `contribution`, `claim`, `experiment`, and `judge` become STALE; when `claim` changes only `experiment` and `judge` become STALE; when `judge` changes nothing becomes STALE. The invalidation query reports the correct stale and fresh sets.

## AC-08: Selective recomputation
Given a version with stale nodes, when recompute runs, the stale judges execute in dependency order and a new immutable version is created with fresh artifacts. Recompute is rejected with HTTP 400 while a workflow run is in progress or when an invalid node name is supplied.

## AC-09: Card-driven invalidation
Given an updated `GAP_CANDIDATE` card, the spec is cloned to a new version and `contribution`, `claim`, `experiment`, and `judge` artifacts become STALE, mirroring spec-node invalidation.

## AC-10: Evidence and readiness judges
Given a spec with claims and cited related work, the `evidence` judge evaluates whether each citation supports the accompanying content, and the `conference-readiness` judge scores originality, significance, soundness, clarity, and reproducibility independently. The panel runs `gap`, `contribution`, `experiment`, `evidence`, and `conference-readiness` judges and reports `PARTIAL_FAILURE` if any differ in spec version or fail.

## Contract verification
Acceptance scenarios are verified by backend unit, integration, and HTTP tests. Frontend-specific scenarios will be added when the Flutter client is available.
***