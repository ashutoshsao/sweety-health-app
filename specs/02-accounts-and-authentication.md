# 02. Accounts and authentication

## Outcome

A patient can register with a name, email, and password, then log in and use a token to access a protected endpoint. This spec delivers the API and database migration. The React sign-up and login screens belong to the React experience spec.

## Account data

- Add a Prisma `User` model with `id String @id @default(uuid())`, `name`, `email`, and `passwordHash`. Make `email` unique in PostgreSQL.
- Trim the name and email and lowercase the email before validation and storage. Accept names from 1 to 100 characters and valid email addresses up to 254 characters. Apply the same email normalization at login. Handle PostgreSQL's unique constraint so concurrent registrations for the same normalized email result in one account.
- Require passwords of at least eight characters and at most 72 UTF-8 bytes. Preserve the password exactly as entered. Use Bun's asynchronous password API with `algorithm: "bcrypt"` and cost 10. The byte cap keeps hashes compatible with standard bcrypt verification. Store only the salted hash. [Bun password API](https://bun.com/docs/runtime/hashing)

## HTTP contract

| Endpoint | Input | Success |
| --- | --- | --- |
| `POST /api/auth/signup` | JSON with `name`, `email`, and `password` | `201` with `{ "user": { "id", "name", "email" } }` |
| `POST /api/auth/login` | JSON with `email` and `password` | `200` with `{ "token", "user": { "id", "name", "email" } }` |
| `GET /api/auth/me` | `Authorization: Bearer <token>` | `200` with `{ "user": { "id", "name", "email" } }` |

Use `{ "error": "message" }` for errors. Return `400` for missing or invalid fields and malformed JSON, `413` for oversized request bodies, and `409` when an email is already registered. Return the same `401` message for an unknown email or wrong password. Protected routes return `401` for missing or invalid credentials. The profile endpoint also returns `401` if the token's account no longer exists. Unexpected failures receive a generic `500` response. Auth responses use `Cache-Control: no-store`. Credentials, hashes, tokens, and raw request bodies stay out of logs.

## Token and request identity

- Use `jsonwebtoken` to issue an HS256 token that expires in one hour. Store the user's UUID in `sub`. Require a server-only `JWT_SECRET` of at least 32 bytes at startup. Add an empty `JWT_SECRET` entry to `.env.example` and document generating a random value for local use.
- The middleware verifies the signature, allowed algorithm, expiry, and UUID subject before setting `req.userId`. Declare `userId` on the global `Express.Request` namespace in `express.d.ts`. Later protected handlers use this value for ownership and ignore identity fields supplied by clients.
- Keep sign-up, login, and `/api/health` public. Put `/api/auth/me` behind the same middleware the readings and reports routes will use. When a token expires, the client will ask the user to sign in again.

## Migration and verification

1. Commit the first Prisma migration. Have Compose apply pending migrations after PostgreSQL is ready and before Express starts. Verify a fresh start and a restart against the same database volume. Confirm the public health route still works.
2. Run Bun integration tests against a dedicated PostgreSQL test database. Verify registration, normalization, case-insensitive duplicates including concurrent requests, validation, and login. Inspect the stored row for a bcrypt hash and verify that responses expose only the intended fields.
3. Check the HTTP contract for missing, malformed, oversized, and invalid payloads, including a multibyte password over the byte cap. Verify expired tokens, invalid signatures, unexpected algorithms, missing credentials, and a valid token that resolves to the correct user.
4. Run the existing health test, lint, type checks, and Vite build. Record the commands and outcomes in the implementation handoff.
