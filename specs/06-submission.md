# 06. Submission

## Outcome

A Kenpath reviewer can clone the public GitHub repository, start Sweety from the README, sign in with a synthetic demo account, and inspect the logbook and reports shown in the submission screenshots. The deadline is Tuesday, November 24, 2026.

## Demo data and documentation

- Add an explicit `docker compose exec -T api bun run seed` command. Create a demo account with an `example.invalid` address and a documented demo password hashed with bcrypt. Use the API's configured reporting timezone when creating the account and the account's stored timezone for its reading dates.
- Seed a full day for today, earlier days in the current month where available, and readings across the previous calendar month. Generate timestamps that map to their intended reporting days. A repeat run adds only missing demo slots. Existing readings and account settings are preserved.
- Finish the README with prerequisites, install steps, `.env` setup, migration behavior, API and Vite startup, demo credentials, test commands, and formal verification instructions. Include the date and timezone assumptions and a short note on what could improve with more time. Keep `.env.example` complete with development placeholders or blank values.
- Capture PNG screenshots with synthetic data showing the desktop logbook and all three reports, an open reading form, and the mobile logbook. Add them under `docs/screenshots/` and link them from the README and the submission reply.

## Release verification

1. Follow the README from a fresh checkout and isolated Compose volume. Verify migrations, the seed command, a repeat seed run, and demo sign-in. Check that the current and previous-month reports show the seeded data.
2. Run Bun unit, frontend, and PostgreSQL integration tests, lint, type checks, the Vite build, and both Alloy models. Collect coverage for authored code and review gaps in validation, ownership, and report boundaries.
3. Walk the desktop and mobile flows against Compose with synthetic data. Check form errors, reports after edits and deletion, session behavior, and keyboard focus. Stop and restart PostgreSQL and verify the health response recovers without restarting the API.
4. Run a short sustained report workload with synthetic data against local Compose. Record the duration, concurrency, request count, observed latency, and errors. Review the auth and reporting trust boundaries and verify that credentials, password hashes, and tokens stay out of logs and unintended responses.

## GitHub and handoff

- Check the tracked files and commit history for real secrets and personal data before publication. Publish `main` and its existing commit history to a public GitHub repository named `sweety-health-app` under the authenticated account, then verify the repository and screenshots are accessible to a reviewer.
- Prepare a concise reply for the user to send in the original Kenpath email thread. Include the public repository link and the screenshot files or links. The handoff includes the verification results and the exact submission assets.
