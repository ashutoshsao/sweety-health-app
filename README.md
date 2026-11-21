# Sweety

Sweety is a blood glucose tracker built with React, Express, Prisma, and PostgreSQL. See the [Kenpath assignment](assignment.md) and [implementation plan](plan.md).

## Local development

Install Bun 1.4.4 and Docker with Compose. Start the Docker engine before running the setup commands.

```sh
bun install --frozen-lockfile
cp .env.example .env
docker compose up --build -d
bun run dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to Express on `localhost:3001`. Compose starts the API and PostgreSQL and retains the database in a named volume. The default host database connection is `postgresql://postgres:postgres@localhost:5432/sweety`. Settings are listed in `.env.example`. If you change `API_PORT`, update `API_PROXY_TARGET` to match it.

Stop Vite with Ctrl+C and stop the containers with `docker compose down`.

## Checks

With Vite and Compose running, check the API directly and through the frontend proxy.

```sh
curl -fsS http://localhost:3001/api/health
curl -fsS http://localhost:5173/api/health
```

Both requests should return `{"status":"ok"}`. To check recovery, run `docker compose stop db`, then `curl -i http://localhost:3001/api/health` and expect `503`. Run `docker compose up -d --wait db` and check for `200` again.

```sh
bun run --filter api test
bun run lint
bun run check-types
bun run build
```
