# SpecResearch Loop Backend

NestJS modular monolith for immutable research specifications, durable workflow checkpoints, targeted LLM context, evidence verification, and human confirmation.

## Development

1. Copy `.env.example` to `.env` and start PostgreSQL.
2. Run `npm install`.
3. Run `npx prisma migrate dev --name init`.
4. Run `npm run start:dev`.

`npm test`, `npm run lint`, and `npm run build` are the completion gates.

The LLM and search integrations are ports in `src/integrations`; production adapters can be supplied without changing workflow state management.
