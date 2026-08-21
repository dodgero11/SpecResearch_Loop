# Local Backend Development and Testing

## Prerequisites

- Docker Desktop
- Node.js and npm
- PostgreSQL container named `spec_research_db`

Start PostgreSQL if it is not already running:

```powershell
docker run --name spec_research_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=spec_research_loop -p 5432:5432 -d postgres:15
```

If the container already exists but is stopped:

```powershell
docker start spec_research_db
```

## Database setup

From `backend/`:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/spec_research_loop?schema=public"
npx prisma migrate deploy
npx prisma generate
```

## Run the backend

```powershell
npm run start:dev
```

The API is available at `http://localhost:3000`.

## Automated tests

```powershell
npm test
npm run lint
npm run build
```

Run only the HTTP journey:

```powershell
npm test -- --runInBand test/http.e2e-spec.ts
```

The HTTP suite uses the real PostgreSQL database and cleans up its project data after completion.

## Manual API smoke test

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/projects -ContentType "application/json" -Body '{"title":"Manual API test"}'
```

Use the returned project ID with [the frontend API contract](../general/frontend-api.md).

Flutter connection is deferred because the frontend project is not available.
