# 01. Workspace and local development

## Outcome

From a fresh clone, a reviewer with Bun and Docker Compose can start PostgreSQL and the Express API with Compose, then run the Vite frontend on the host. A request through Vite verifies that Express can reach PostgreSQL.

## Workspace

- Replace the Next.js starter in `apps/web` with the Vite React TypeScript template. Remove the sample docs app, unused starter UI package, and Next.js-specific configuration. Keep shared configuration where it still has a caller.
- Add `apps/api` with a minimal Express app, a Bun entry point that serves TypeScript directly, and Prisma configuration for PostgreSQL. Generate the Prisma client in the API image. Add the application tables and first schema migration with the accounts spec.
- Use Bun for dependency installation, Vite, Express, and JavaScript and TypeScript tests. Pin the API image to the same Bun version as the workspace, currently `1.4.4`. Keep `bun.lock` committed and use frozen installs. A separate host Node.js install is outside the setup requirements and the clean-start check will verify that.
- Keep Turborepo for frontend development and repository build, lint, and type checking. Root `bun run dev` starts Vite only. Root `bun run build` builds the frontend into its Vite `dist` directory. The API has a type check and runs without a build artifact. Read the installed Turborepo docs before changing tasks or commands.

## Local services and configuration

| Service | Where it runs | Default address |
| --- | --- | --- |
| React and Vite | Host via Bun | `http://localhost:5173` |
| Express API | Compose service `api` via Bun | `http://localhost:3001` |
| PostgreSQL | Compose service `db` with a named data volume | `localhost:5432` from the host and `db:5432` inside Compose |

- Use a root `docker-compose.yml` and an API Dockerfile built from the monorepo root. PostgreSQL uses the local database `sweety` with username and password `postgres`. Expose the API and database ports on host loopback. The API binds to all interfaces inside its container and waits for PostgreSQL to pass its startup health check.
- Commit one root `.env.example` and ignore the local `.env`. Document the API, database, and Vite settings used by this spec. Compose passes the API a database URL using the internal hostname `db`. Vite reads its API proxy target from the root environment, with `http://localhost:3001` as the default. Add JWT configuration with the accounts spec.
- Vite forwards `/api` to Express. The starter frontend requests `GET /api/health` and displays ready or unavailable. Express runs a lightweight PostgreSQL query and returns `200` with `{ "status": "ok" }` when it succeeds, or `503` with `{ "status": "unavailable" }` when it fails. Keep internal errors and configuration out of the response.

## Acceptance checks

1. From a clean checkout, run `bun install --frozen-lockfile`, copy `.env.example` to `.env`, and run `docker compose config --quiet` and `docker compose up --build -d`. Confirm both Compose services start with the documented defaults.
2. Run `curl -fsS http://localhost:3001/api/health` and check for the documented `200` response. Start Vite with `bun run dev` and make the same request through `http://localhost:5173/api/health` to check the host-to-container path.
3. Stop PostgreSQL in the local stack and confirm the API returns the documented `503`. Start PostgreSQL again and confirm the API returns `200` without an API restart. Use read-only health checks for this smoke test. Use a dedicated test database when later specs introduce tests that write data.
4. Run `bun run lint`, `bun run check-types`, and `bun run build`. Verify the frontend build and confirm the API starts from TypeScript in the Bun image. Run the setup without relying on a host Node.js binary.
5. Document startup, shutdown, and the checks in the README. Record the commands and outcomes in the implementation handoff.
