# Sweety

Sweety is a blood glucose tracker built with React, Express, Prisma, and PostgreSQL. See the [Kenpath assignment](assignment.md) and [implementation plan](plan.md).

## Local development

Install Bun 1.4.4 and Docker with Compose. Start the Docker engine before running the setup commands.

```sh
bun install --frozen-lockfile
cp .env.example .env
bun -e 'import { randomBytes } from "node:crypto"; console.log(randomBytes(32).toString("hex"))'
```

Paste the generated value into `JWT_SECRET` in `.env`. Then start the services.

```sh
docker compose up --build -d --wait
bun run dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to Express on `localhost:3001`. Compose starts PostgreSQL, applies pending Prisma migrations, and starts the API. PostgreSQL retains data in a named volume. The default host database connection is `postgresql://postgres:postgres@localhost:5432/sweety`. Settings are listed in `.env.example`. If you change `API_PORT`, update `API_PROXY_TARGET` to match it.

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

Run the integration suite against a separate PostgreSQL database. Create `sweety_test` once per database volume. These commands use the default local credentials, and the suite cleans up the account rows it creates.

```sh
docker compose up -d --wait db
docker compose exec -T db createdb -U postgres sweety_test
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sweety_test
DATABASE_URL="$TEST_DATABASE_URL" bun run --filter api prisma:deploy
bun run --filter api prisma:generate
bun run --filter api test:integration
```

The [formal verification instructions](verification/README.md) show how to rerun the Alloy checks for readings and reports.

## Notes

- The account's reporting timezone groups readings into calendar days. A reading's timestamp is stored as an instant so the frontend can display its time in the device's local timezone.
