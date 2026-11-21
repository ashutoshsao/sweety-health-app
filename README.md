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

## Demo account

With Compose running, seed the demo and sign in at `http://localhost:5173`.

```sh
docker compose exec -T api bun run seed
```

| Email                         | Password           |
| ----------------------------- | ------------------ |
| `demo@sweety.example.invalid` | `sweety-demo-2026` |

The seed fills all four slots on the current reporting day and adds examples in earlier days and the previous month. Rerunning it adds missing sample slots and preserves existing readings. Use these public credentials with local demo data.

## Checks

With Vite and Compose running, check the API directly and through the frontend proxy.

```sh
curl -fsS http://localhost:3001/api/health
curl -fsS http://localhost:5173/api/health
```

Both requests should return `{"status":"ok"}`. To check recovery, run `docker compose stop db`, then `curl -i http://localhost:3001/api/health` and expect `503`. Run `docker compose up -d --wait db` and check for `200` again.

```sh
bun run --filter api test
bun run --filter web test
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

- The API assigns the reporting timezone from its runtime configuration when an account is created. Docker Compose uses `REPORTING_TIME_ZONE=UTC` by default. Accounts keep that setting for stable historical reports. Readings use PostgreSQL `timestamptz` and UTC on API responses. The UI displays the device's local time. [PostgreSQL date/time types](https://www.postgresql.org/docs/17/datatype-datetime.html)
- The reports use calendar days in the account timezone. “Previous month” means the full calendar month before the selected date's month.
- With more time I'd add a reading trend chart and expand automated end-to-end coverage across browsers.
