# Engineering Rules and Guidelines

## Canonical stack
- NestJS and TypeScript for the modular monolith.
- Prisma ORM with PostgreSQL as the durable source of truth.
- Flutter is a client; it does not own workflow or versioning state.

## Non-negotiable architecture rules
- Do not add microservices, Kafka, RabbitMQ, Kubernetes, or distributed event sourcing for the MVP.
- Never update or delete a `SpecIteration`; create a new version and move the latest pointer transactionally.
- Never use process memory as the source of truth for long-running tasks. Persist checkpoints and outputs after each step.
- All LLM context must pass through `ContextBuilderService`; never send raw chat history.
- Provider calls must be behind ports so unit tests do not require network access.
- Use DTO validation at HTTP boundaries and typed domain contracts internally.

## Data and retry rules
- Preserve decision, audit, and confirmation history by appending records.
- Make retryable operations idempotent using database uniqueness constraints and component state checks.
- Retry only timeouts, transient provider errors, and rate limits. Do not automatically retry malformed JSON, invalid input, or authorization errors.
- Existing migrations are immutable. Add a new migration for every schema change; never edit an applied migration.
- Do not log secrets, provider credentials, or unbounded user conversation content.

## Completion gates
Before a task is marked complete, run `npm test`, `npm run lint`, and `npm run build` from `backend/`. Acceptance criteria must map to executable tests. Contract changes require updating the relevant document before implementation.