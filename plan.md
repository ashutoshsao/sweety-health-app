# Sweety main plan

Sweety lets a patient log up to four blood glucose readings per day and view daily, month-to-date, and previous-month reports. The Kenpath submission deadline is Tuesday, November 24, 2026.

## Working agreement

Review one spec at a time. Write the next spec, agree on its behavior and acceptance checks, then implement and verify it in focused commits. Each spec identifies the checks it needs and records the results, including the bounds of any formal check. Move to the following spec once the current one is complete. Finish the required features before considering optional work.

## Stack and local setup

- Keep the existing Bun and Turborepo monorepo. Use the Vite React TypeScript template for `apps/web` and add a Node.js-compatible Express API in `apps/api`.
- Use Docker Compose to start PostgreSQL and the API. Bun is the runtime for Express, the Vite development and build commands, and the JavaScript and TypeScript test suites. Run the API directly from TypeScript inside Compose and Vite on the host during development.
- Use local development defaults of API port `3001`, Vite port `5173`, and PostgreSQL port `5432` with username `postgres`, password `postgres`, and database `sweety`.
- Use Prisma with UUID primary keys declared as `@id @default(uuid())`. Hash passwords with bcrypt and issue login tokens with `jsonwebtoken`. Auth middleware sets `req.userId`, declared through global Express request type augmentation in `express.d.ts`.
- Exchange full ISO 8601 timestamps with an explicit UTC offset or `Z`. Store reading timestamps as timezone-aware PostgreSQL values so the same instant can be displayed in any timezone. Use a consistent reporting timezone for calendar-day validation, slot limits, and report boundaries. The readings spec will define how that timezone is chosen and how the calendar day is stored and enforced.

## Spec order

1. **Workspace and local development.** Set up the Vite and Express workspaces, PostgreSQL and API services in Compose, Prisma tooling, and environment defaults. Verify that a fresh checkout can start both services and that the host frontend can reach the API.
2. **Accounts and authentication.** Define sign-up, login, bcrypt password hashing, JWT handling, and authenticated request identity. Verify that protected routes reject unauthenticated requests.
3. **Reading management.** Define add, list, edit, and delete behavior, timestamp and timezone handling, user ownership, and validation. Support Morning (fasting), After breakfast, After lunch, and After dinner. Require a whole-number value from 40 to 600 mg/dl, reject future calendar dates, and enforce one reading per slot and up to four readings per day. Verify duplicate handling and user isolation against PostgreSQL.
4. **Reports.** Define the selected-day report, month-to-date through the selected day, and the full previous calendar month. Each shows highest, lowest, average to one decimal, and count. The daily report also shows each reading by slot. Verify empty reports, rounding, and month and year boundaries.
5. **React experience.** Use the `frontend-design` skill to design a responsive glucose logbook around the four daily slots. Build sign-up, login, reading management, and date-driven reports with clear validation and empty states. Verify the seeded flow on desktop and mobile.
6. **Submission.** Verify the full flow and automated tests from a clean setup. Finish the README with installation, database setup, API and client startup, test commands, assumptions, and improvements. Include `.env.example`, a repeatable demo seed with readings across reporting periods, and screenshots of the working app. Publish the regular commits to a public GitHub repository and prepare the email reply with the repository link and screenshots.

## Verification plan

| Checks | Evidence for Sweety |
| --- | --- |
| Unit, functional, and contract | Test input validation, date and report calculations, and the documented HTTP status codes and response bodies. |
| Integration, configuration, and smoke | Exercise the API with real PostgreSQL in a dedicated test database. Check Compose startup, migrations, the health endpoint, and connectivity from the host frontend. |
| Component, acceptance, usability, and UI | Test reading form errors and empty states. Walk through sign-up, login, CRUD, and reports on desktop and mobile, including keyboard navigation. |
| Fuzz and property-based | Use repeatable seeds for malformed input and generated readings. Check offset equivalence, calendar boundaries, and report count and aggregate invariants against a simple reference calculation. |
| Regression, lint, static analysis, and coverage | Add a regression case for each discovered correctness bug. Run lint and TypeScript checks and inspect coverage for missing cases around validation, ownership, and report boundaries. |
| Mutation | Change selected checks in validation, ownership, and report ranges and verify the relevant tests fail. Record any surviving changes and what they reveal. |
| Threat modeling and defensive security verification | Review trust boundaries and verify that unauthenticated users and other accounts cannot read or change someone else's data. Check that responses omit passwords and hashes, login tokens appear only in the intended response, and logs omit credentials and tokens. |
| Benchmark, performance, load, and soak | Measure report latency and errors on seeded PostgreSQL, then run a short sustained load against local Compose. Record the workload, environment, and observed timings. |

### Formal verification

Create an executable state model in the readings spec and check it exhaustively within documented finite bounds. Include two users, all four slots, multiple calendar days, and sequences of create, edit, delete, and read operations. Check that each user has at most one reading per slot per day, at most four per day, and can only see or change their own readings. Include an edit into an occupied slot and verify that a rejected move preserves the original state. Add report selection properties in the reports spec once its date rules are agreed.

Commit the model, checker configuration, and reproducible run command. State what each invariant covers and the bounds explored. Back the modeled rules with API and PostgreSQL tests, including simultaneous writes to the same slot, to check that the implementation enforces them.

### Release and post-release checks

The submission targets a public source repository and local Compose. Use local smoke tests, synthetic traffic, timings and profiling when needed, and inspect logs and errors during a database restart and recovery check. Canarying, traffic shaping, feature flags, tap compare, shadowing, teeing, production monitoring and exception tracking, live chaos testing, A/B tests, production tracing and exploration, real-user monitoring, production auditing, and on-call exercises require a deployed service or a release process. Revisit them if Sweety is deployed.
