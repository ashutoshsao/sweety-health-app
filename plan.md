# Sweety main plan

Sweety lets a patient log up to four blood glucose readings per day and view daily, month-to-date, and previous-month reports. The Kenpath submission deadline is Tuesday, November 24, 2026.

## Working agreement

Review one spec at a time. Write the next spec, agree on its behavior and acceptance checks, then implement and verify it in focused commits. Move to the following spec once the current one is complete. Finish the required features before considering optional work.

## Stack and local setup

- Keep the existing Bun and Turborepo monorepo. Use the Vite React TypeScript template for `apps/web` and add a Node.js-compatible Express API in `apps/api`.
- Use Docker Compose to start PostgreSQL and the API. Run Express directly from TypeScript with Bun. Run Vite on the host during development.
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
