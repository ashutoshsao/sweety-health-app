import { once } from "node:events";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, expect, test } from "bun:test";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app";
import { createAuthRouter } from "../../src/auth/router";
import { PrismaClient } from "../../src/generated/prisma/client";

const connectionString = process.env.TEST_DATABASE_URL;
if (
  !connectionString ||
  new URL(connectionString).pathname !== "/sweety_test"
) {
  throw new Error(
    "Set TEST_DATABASE_URL to the dedicated sweety_test database.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const secret = crypto.randomUUID();
const emailPrefix = `${crypto.randomUUID()}-`;
const password = " demo passphrase ";
type UserResponse = {
  user: { id: string; name: string; email: string; timeZone: string };
};
const app = createApp(
  () => prisma.$queryRaw`SELECT 1`,
  createAuthRouter(prisma, secret),
);
let server: ReturnType<typeof app.listen> | undefined;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected a TCP address");
  baseUrl = `http://127.0.0.1:${address.port}/api/auth`;
});

afterAll(async () => {
  server?.close();
  try {
    await prisma.user.deleteMany({
      where: { email: { startsWith: emailPrefix } },
    });
  } finally {
    await prisma.$disconnect();
  }
});

function post(path: string, body: unknown) {
  return fetch(`${baseUrl}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function profile(token?: string) {
  return fetch(`${baseUrl}/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

test("registers, stores bcrypt, logs in, and returns only the signed-in user's profile", async () => {
  const email = `${emailPrefix}patient@example.com`;
  const signup = await post("signup", {
    name: "  Test Patient  ",
    email: ` ${email.toUpperCase()} `,
    password,
  });
  expect(signup.status).toBe(201);
  expect(signup.headers.get("cache-control")).toBe("no-store");
  const { user } = (await signup.json()) as UserResponse;
  expect(user).toEqual({
    id: expect.any(String),
    name: "Test Patient",
    email,
    timeZone: "UTC",
  });

  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
  });
  expect(account.passwordHash).toMatch(/^\$2b\$10\$/);
  expect(
    await Bun.password.verify(password, account.passwordHash, "bcrypt"),
  ).toBe(true);

  const login = await post("login", {
    email: ` ${email.toUpperCase()} `,
    password,
  });
  expect(login.status).toBe(200);
  expect(login.headers.get("cache-control")).toBe("no-store");
  const payload = (await login.json()) as UserResponse & { token: string };
  expect(payload).toEqual({ token: expect.any(String), user });
  const claims = jwt.verify(payload.token, secret, { algorithms: ["HS256"] });
  if (
    typeof claims === "string" ||
    typeof claims.exp !== "number" ||
    typeof claims.iat !== "number"
  ) {
    throw new Error("Expected JWT timestamps");
  }
  expect(claims.sub).toBe(user.id);
  expect(claims.exp - claims.iat).toBe(3600);

  const me = await profile(payload.token);
  expect(me.status).toBe(200);
  expect(me.headers.get("cache-control")).toBe("no-store");
  expect(await me.json()).toEqual({ user });
});

test("concurrent sign-ups for the same normalized email create one account", async () => {
  const email = `${emailPrefix}duplicate@example.com`;
  const attempts = await Promise.all([
    post("signup", { name: "First", email, password }),
    post("signup", {
      name: "Second",
      email: ` ${email.toUpperCase()} `,
      password,
    }),
  ]);
  expect(attempts.map((response) => response.status).sort()).toEqual([
    201, 409,
  ]);
  expect(await prisma.user.count({ where: { email } })).toBe(1);
});

test("validates JSON, fields, and the bcrypt byte limit", async () => {
  const email = `${emailPrefix}invalid@example.com`;
  const valid = { name: "Patient", email, password };
  for (const body of [
    {},
    { ...valid, email: "invalid" },
    { ...valid, email: "patient..record@example.com" },
    { ...valid, name: 123 },
    { ...valid, name: "Patient\0Record" },
    { ...valid, timeZone: "+05:30" },
    { ...valid, timeZone: "Mars/Settlement" },
    { ...valid, password: "short" },
    { ...valid, password: "😀".repeat(19) },
  ]) {
    const response = await post("signup", body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  }
  expect((await post("login", { email })).status).toBe(400);
  expect(
    (await post("signup", { ...valid, name: "a".repeat(9000) })).status,
  ).toBe(413);

  const malformed = await fetch(`${baseUrl}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  expect(malformed.status).toBe(400);
  expect(malformed.headers.get("cache-control")).toBe("no-store");
  expect(await prisma.user.count({ where: { email } })).toBe(0);

  const withinLimit = await post("signup", {
    ...valid,
    password: "😀".repeat(18),
  });
  expect(withinLimit.status).toBe(201);
});

test("unknown email and wrong password return the same login error", async () => {
  const email = `${emailPrefix}known@example.com`;
  expect(
    (await post("signup", { name: "Patient", email, password })).status,
  ).toBe(201);
  const wrong = await post("login", { email, password: password.trim() });
  const unknown = await post("login", {
    email: `${emailPrefix}unknown@example.com`,
    password,
  });
  expect(wrong.status).toBe(401);
  expect(unknown.status).toBe(401);
  expect(await wrong.json()).toEqual(await unknown.json());
});

test("rejects missing, expired, invalid, and deleted-account credentials", async () => {
  const email = `${emailPrefix}deleted@example.com`;
  const signup = await post("signup", { name: "Patient", email, password });
  expect(signup.status).toBe(201);
  const { user } = (await signup.json()) as UserResponse;
  const subject = user.id;
  const tokens = [
    undefined,
    "invalid-token",
    jwt.sign({}, secret, { subject, expiresIn: -1 }),
    jwt.sign({}, crypto.randomUUID(), { subject, expiresIn: "1h" }),
    jwt.sign({}, secret, { subject, algorithm: "HS384", expiresIn: "1h" }),
    jwt.sign({}, secret, { subject }),
    jwt.sign({}, secret, { subject: "invalid", expiresIn: "1h" }),
  ];
  for (const token of tokens) {
    const response = await profile(token);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Please sign in." });
  }

  await prisma.user.delete({ where: { id: subject } });
  const deleted = await profile(
    jwt.sign({}, secret, { subject, expiresIn: "1h" }),
  );
  expect(deleted.status).toBe(401);
});
