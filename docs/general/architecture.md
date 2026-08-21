# Product Architecture

## High-level flow
UI -> HTTP API -> research workflow -> search, verification, and judges -> persisted project state.

The frontend depends on HTTP contracts and does not depend on Prisma models or PostgreSQL tables.

## Product capabilities
- Project and immutable specification versioning
- Resumable research workflow
- Targeted judge context
- Evidence verification through search, reranking, and NLI
- Independent judge evaluation
- Human decisions and confirmation questions

## Backend boundary
The backend owns persistence, workflow execution, dependency invalidation, provider adapters, audit records, and API validation. Its NestJS module and Prisma details belong in backend documentation.

## Frontend boundary
The frontend owns presentation, user interaction, local view state, and HTTP client integration. Flutter implementation is deferred until the frontend project is available.
***