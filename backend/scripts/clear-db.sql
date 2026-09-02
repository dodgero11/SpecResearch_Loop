-- Clears ALL data from the database. WARNING: irreversible.
TRUNCATE TABLE
  "ResearchProject",
  "SpecIteration",
  "WorkflowRun",
  "ComponentState",
  "SpecCard",
  "SpecCardLink",
  "LlmAuditLog",
  "DecisionLog",
  "ConfirmationQuestion",
  "IdempotencyRecord",
  "SpecArtifact",
  "Clarification",
  "JudgeIssue"
CASCADE;