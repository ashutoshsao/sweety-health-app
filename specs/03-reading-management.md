# 03. Reading management

## Outcome

A signed-in patient can add, list, edit, and delete their own readings. PostgreSQL enforces one reading per slot per calendar day, including when requests run concurrently. This spec delivers the API and data model. The React forms and reports follow in their own specs.

## Timestamps and calendar days

- Accept `recordedAt` as a full ISO 8601 timestamp, such as `2026-11-22T13:30:00+05:30` or `2026-11-22T08:00:00Z`. Require a date, hours, minutes, seconds, and an explicit offset or `Z`. Accept up to three fractional-second digits. Reject nonexistent dates, invalid times, and timestamps without an offset.
- Store the instant as PostgreSQL `timestamptz` at millisecond precision and return it in UTC, such as `2026-11-22T08:00:00.000Z`. The client can display that instant in any timezone. The input offset describes the instant. The account's reporting timezone determines its calendar day.
- Add a `timeZone` field to the user. Sign-up accepts an optional IANA timezone such as `Asia/Kolkata`, with `UTC` as the default for new accounts and the backfill for existing accounts. Reject invalid names and numeric offsets. Add `timeZone` to the public user object returned by sign-up, login, and `/api/auth/me`. It stays fixed for the account in this assignment so a change in device timezone leaves historical day and slot assignments intact.
- Derive `date` as `YYYY-MM-DD` in the reporting timezone using Bun's `Temporal` API. Store it as PostgreSQL `DATE` alongside `recordedAt` and recalculate it when the timestamp changes. Compare it with today in the same timezone. For example, `2026-11-22T00:15:00+05:30` is November 22 in `Asia/Kolkata` and November 21 in `UTC`. The future-date rule checks the calendar day. A timestamp later on the current calendar day is allowed.

## Data and validation

- Add a `Reading` with a UUID `id`, `userId` foreign key, `recordedAt`, `date`, a slot enum, and integer `value` in mg/dl. Add a unique constraint on `(userId, date, slot)` and a PostgreSQL check constraint for the inclusive range 40–600.
- Accept the slots `MORNING_FASTING`, `AFTER_BREAKFAST`, `AFTER_LUNCH`, and `AFTER_DINNER`. Their display labels are Morning (fasting), After breakfast, After lunch, and After dinner, in that order.
- Return `400` with “Please enter a glucose value.” for a missing or null value on create, or an explicit null value on edit. Return `400` with “Value must be between 40 and 600 mg/dl.” for a noninteger, nonnumeric, or out-of-range value. Also return a clear `400` error for invalid slots or timestamps, and “Date cannot be in the future.” for a future calendar day.
- Translate a unique-constraint conflict to `409` with the slot's label, for example “You already have an After lunch reading for this date.” Once all four slots are occupied, the future UI will show “You can add only 4 readings per day.” and remove the add action for that day. Any valid fifth API request repeats an occupied slot and receives the same slot-specific `409`.
- Scope all queries and mutations using `req.userId`. Return the same `404` for a missing reading or a reading owned by another user. Return `404` for a malformed reading ID. A rejected edit leaves the original reading intact.

## HTTP contract

All routes require `Authorization: Bearer <token>`. A reading response has `id`, `recordedAt`, `date`, `slot`, and `value`. Errors use `{ "error": "message" }`.

| Endpoint | Input | Success |
| --- | --- | --- |
| `GET /api/readings?date=YYYY-MM-DD` | A valid calendar date in the reporting timezone | `200` with `{ "readings": [...] }` in slot order, or an empty array |
| `POST /api/readings` | JSON with `recordedAt`, `slot`, and `value` | `201` with `{ "reading": {...} }` |
| `PATCH /api/readings/:id` | JSON with one or more of `recordedAt`, `slot`, and `value` | `200` with `{ "reading": {...} }` |
| `DELETE /api/readings/:id` | Reading ID | `204` |

An edit preserves omitted fields. Write `recordedAt` and `date` together whenever the timestamp changes. The API derives ownership and the calendar day even if the request includes fields named `userId` or `date`. An empty edit returns `400`. A list request for a valid future date returns an empty array.

## Verification

1. Apply the migration to the dedicated PostgreSQL test database. Cover CRUD, slot order, empty days, 40 and 600, missing and decimal values, invalid slots, and strict date and timestamp parsing.
2. Exercise an offset crossing midnight, equivalent instants with different offsets, a UTC account, and a timezone with daylight saving time. Check the future-date comparison at midnight in the reporting timezone with a fixed clock. Use a reproducible set of generated offset cases.
3. Use two signed-in users to test list isolation, unauthorized edits and deletes, and successful use of the same slot by different users. Send simultaneous creates for one slot and check for one `201`, one `409`, and one stored row. Fill all four slots and verify a fifth write fails. Move a reading into an occupied slot and verify the original row is intact.
4. Use Alloy 6 to check a bounded state model with two users, two calendar days, all four slots, and traces up to eight transitions. Include create, edit, delete, and list. Check slot uniqueness, the daily cap, ownership of returned and modified rows, and preservation of the original after a rejected edit. Include witness traces for a full day and a rejected move so those cases are reachable. Commit the model, checker command, and results. API and database tests exercise the corresponding behavior in the implementation. [Alloy 6 bounded model checking](https://alloytools.org/alloy6.html)
5. Run the auth and health suites, lint, type checks, and the Vite build. Report the verification results with the implementation commit.
