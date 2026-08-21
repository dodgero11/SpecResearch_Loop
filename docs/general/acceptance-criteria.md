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

## Contract verification
Acceptance scenarios are verified by backend unit, integration, and HTTP tests. Frontend-specific scenarios will be added when the Flutter client is available.
***