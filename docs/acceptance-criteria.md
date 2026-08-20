# Acceptance Criteria and Test Scenarios

## AC-01: Immutable spec update
Given project version 3 exists, updating Gap creates version 4, points the project to version 4, and leaves version 3 unchanged. Repeating the same request with the same idempotency key does not create version 5.

## AC-02: Checkpoint resume
Given a run has steps 1 through 6 in `completedSteps` and `currentStep = 7`, when the Judge adapter times out, the run is persisted as retryable. A retry loads the checkpoint, executes step 7 only, and never invokes steps 1 through 6.

## AC-03: Latest context
Given a project has version 3 and a Gap edit creates version 4, when `run_gap_judge` starts, the context builder resolves version 4 at execution time. The audit record stores `specVersionUsed = 4` and contains only the Gap Judge allowlisted fields.

## AC-04: Invalidation
Given a completed version has Gap, Contribution, Claim, Evidence, and Experiment outputs, when Gap changes, the dependent outputs become `STALE`; the historical version remains available and the next workflow run can recompute only affected steps.

## AC-05: Verification classification
Given a claim and retrieved evidence, the verifier returns exactly one NLI outcome. A similarity score without an NLI result cannot produce a verified claim.

## AC-06: Human decision trace
Given a judge finding, accepting, rejecting, or overriding it appends a DecisionLog entry with actor, target, value, and timestamp. No prior decision is overwritten.

## Completion gate
Unit tests cover AC-01 through AC-06. Integration tests cover Prisma uniqueness and transaction behavior. Run `npm test`, `npm run lint`, and `npm run build` from `backend/`.