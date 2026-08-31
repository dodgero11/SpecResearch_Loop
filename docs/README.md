# Project Documentation

Documentation for the SpecResearch Loop project. The docs are organized into cross-team contracts (General) and backend implementation details (Backend).

## General

Product behavior and cross-team contracts:

- [Requirements](general/requirements.md) — product requirements
- [Acceptance Criteria](general/acceptance-criteria.md) — testable acceptance criteria
- [Product Architecture](general/architecture.md) — system boundaries and high-level flow
- [Frontend API Contract](general/frontend-api.md) — the HTTP contract the frontend consumes
- [AI API Contract](general/ai-api.md) — the backend's typed AI ports and endpoint contracts
- [AI Service Contract](general/ai_service_contract.md) — the wire-level HTTP contract the Python `ai_service` must satisfy

## Backend

Backend implementation and operations:

- [Engineering Rules](backend/engineering-rules.md) — canonical stack and architecture rules
- [Implementation Plan](backend/plan.md) — phased implementation plan
- [Task Contracts](backend/task.md) — task-level contracts
- [Local Development and Testing](backend/local-development.md) — local setup, DB, and test commands