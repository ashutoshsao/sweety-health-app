import { once } from "node:events";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { createAuthRouter } from "../../src/auth/router";
import { PrismaClient, ReadingSlot } from "../../src/generated/prisma/client";
import { createReadingsRouter } from "../../src/readings/router";

const connectionString = process.env.TEST_DATABASE_URL;
if (
  !connectionString ||
  new URL(connectionString).pathname !== "/sweety_test"
) {
  throw new Error(
    "Set TEST_DATABASE_URL to the dedicated sweety_test database.",
  );
}

type Patient = { id: string; timeZone: string };
type Reading = {
  id: string;
  recordedAt: string;
  date: string;
  slot: ReadingSlot;
  value: number;
};

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const secret = crypto.randomUUID();
const emailPrefix = `${crypto.randomUUID()}-`;
const app = createApp(
  () => prisma.$queryRaw`SELECT 1`,
  createAuthRouter(prisma, secret, "Asia/Kolkata"),
  createReadingsRouter(prisma, secret),
);
let server: ReturnType<typeof app.listen> | undefined;
let baseUrl: string;
let patient: { token: string; user: Patient };
let other: { token: string; user: Patient };

function call(path: string, method = "GET", token?: string, body?: object) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}/${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

async function register(name: string) {
  const email = `${emailPrefix}${name}@example.com`;
  const password = "test passphrase";
  const signup = await call("auth/signup", "POST", undefined, {
    name,
    email,
    password,
  });
  expect(signup.status).toBe(201);
  const login = await call("auth/login", "POST", undefined, {
    email,
    password,
  });
  expect(login.status).toBe(200);
  return (await login.json()) as { token: string; user: Patient };
}

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected a TCP address");
  baseUrl = `http://127.0.0.1:${address.port}/api`;
  [patient, other] = await Promise.all([
    register("patient"),
    register("other"),
  ]);
  await prisma.user.update({
    where: { id: other.user.id },
    data: { timeZone: "UTC" },
  });
  const profile = await call("auth/me", "GET", other.token);
  other.user = ((await profile.json()) as { user: Patient }).user;
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

async function add(date: string, slot: ReadingSlot, value: number) {
  const response = await call("readings", "POST", patient.token, {
    recordedAt: `${date}T12:00:00Z`,
    slot,
    value,
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { reading: Reading }).reading;
}

test("creates, orders, edits, moves, and deletes readings on selected days", async () => {
  const lunch = await add("2024-04-04", "AFTER_LUNCH", 600);
  const fasting = await add("2024-04-04", "MORNING_FASTING", 40);
  const list = await call("readings?date=2024-04-04", "GET", patient.token);
  expect(list.status).toBe(200);
  expect(list.headers.get("cache-control")).toBe("no-store");
  expect(await list.json()).toEqual({ readings: [fasting, lunch] });

  const patch = await call(`readings/${lunch.id}`, "PATCH", patient.token, {
    value: 120,
  });
  expect(patch.status).toBe(200);
  expect(await patch.json()).toEqual({ reading: { ...lunch, value: 120 } });

  const move = await call(`readings/${lunch.id}`, "PATCH", patient.token, {
    recordedAt: "2024-04-05T00:15:00+05:30",
    slot: "AFTER_DINNER",
  });
  expect(move.status).toBe(200);
  expect(await move.json()).toEqual({
    reading: {
      ...lunch,
      value: 120,
      date: "2024-04-05",
      recordedAt: "2024-04-04T18:45:00.000Z",
      slot: "AFTER_DINNER",
    },
  });
  expect(
    await (await call("readings?date=2024-04-04", "GET", patient.token)).json(),
  ).toEqual({ readings: [fasting] });

  const deleted = await call(`readings/${lunch.id}`, "DELETE", patient.token);
  expect(deleted.status).toBe(204);
  expect(await deleted.text()).toBe("");
  expect(
    await (await call("readings?date=2024-04-05", "GET", patient.token)).json(),
  ).toEqual({ readings: [] });
});

test("uses the account timezone for ownership, the calendar day, and duplicate detection", async () => {
  expect(patient.user.timeZone).toBe("Asia/Kolkata");
  expect(other.user.timeZone).toBe("UTC");
  const body = {
    recordedAt: "2024-05-02T00:15:00+05:30",
    slot: "AFTER_LUNCH",
    value: 110,
    userId: other.user.id,
    date: "2024-05-01",
  };
  const created = await call("readings", "POST", patient.token, body);
  expect(created.status).toBe(201);
  const { reading } = (await created.json()) as { reading: Reading };
  expect(reading).toEqual({
    id: expect.any(String),
    recordedAt: "2024-05-01T18:45:00.000Z",
    date: "2024-05-02",
    slot: "AFTER_LUNCH",
    value: 110,
  });

  const duplicate = await call("readings", "POST", patient.token, {
    ...body,
    recordedAt: "2024-05-01T18:45:00Z",
  });
  expect(duplicate.status).toBe(409);
  expect(await duplicate.json()).toEqual({
    error: "You already have an After lunch reading for this date.",
  });

  const ownSlot = await call("readings", "POST", other.token, body);
  expect(ownSlot.status).toBe(201);
  const { reading: otherReading } = (await ownSlot.json()) as {
    reading: Reading;
  };
  expect(otherReading.date).toBe("2024-05-01");
  expect((await call("readings?date=2024-05-02")).status).toBe(401);
  expect(
    await (await call("readings?date=2024-05-02", "GET", other.token)).json(),
  ).toEqual({ readings: [] });
  expect(
    await (await call("readings?date=2024-05-01", "GET", other.token)).json(),
  ).toEqual({ readings: [otherReading] });

  const rejectedEdit = await call(
    `readings/${reading.id}`,
    "PATCH",
    other.token,
    { value: 130, userId: patient.user.id },
  );
  const rejectedDelete = await call(
    `readings/${reading.id}`,
    "DELETE",
    other.token,
  );
  expect(rejectedEdit.status).toBe(404);
  expect(rejectedDelete.status).toBe(404);
  expect(await rejectedEdit.json()).toEqual(await rejectedDelete.json());
  expect(
    await (await call("readings?date=2024-05-02", "GET", patient.token)).json(),
  ).toEqual({ readings: [reading] });
});

test("concurrent creates and rejected moves preserve the four-slot invariant", async () => {
  const day = "2024-06-15";
  const body = {
    recordedAt: `${day}T12:00:00Z`,
    slot: "AFTER_LUNCH",
    value: 100,
  };
  const attempts = await Promise.all([
    call("readings", "POST", patient.token, body),
    call("readings", "POST", patient.token, body),
  ]);
  expect(attempts.map((response) => response.status).sort()).toEqual([
    201, 409,
  ]);
  expect(
    await prisma.reading.count({
      where: { userId: patient.user.id, date: new Date(day) },
    }),
  ).toBe(1);

  for (const slot of [
    ReadingSlot.MORNING_FASTING,
    ReadingSlot.AFTER_BREAKFAST,
    ReadingSlot.AFTER_DINNER,
  ]) {
    await add(day, slot, 100);
  }
  expect((await call("readings", "POST", patient.token, body)).status).toBe(
    409,
  );
  expect(
    await prisma.reading.count({
      where: { userId: patient.user.id, date: new Date(day) },
    }),
  ).toBe(4);

  const original = await add("2024-06-16", "AFTER_LUNCH", 115);
  const rejected = await call(
    `readings/${original.id}`,
    "PATCH",
    patient.token,
    { recordedAt: body.recordedAt, value: 150 },
  );
  expect(rejected.status).toBe(409);
  expect(await rejected.json()).toEqual({
    error: "You already have an After lunch reading for this date.",
  });
  expect(
    await (await call("readings?date=2024-06-16", "GET", patient.token)).json(),
  ).toEqual({ readings: [original] });
});

test("rejects invalid reading inputs and protects the glucose range in PostgreSQL", async () => {
  const valid = {
    recordedAt: "2024-07-07T12:00:00Z",
    slot: "AFTER_LUNCH",
    value: 100,
  };
  const invalidCases = [
    [{ value: undefined }, "Please enter a glucose value."],
    [{ value: null }, "Please enter a glucose value."],
    ...[39, 601, 100.5, "100"].map(
      (value) =>
        [{ value }, "Value must be between 40 and 600 mg/dl."] as const,
    ),
    [{ slot: "Afternoon" }, "Choose a valid time slot."],
    [{ recordedAt: "2099-01-01T00:00:00Z" }, "Date cannot be in the future."],
    ...[
      "2024-02-30T12:00:00Z",
      "2024-03-01T12:00:60Z",
      "2024-07-07T12:00:00",
      "2024-07-07T12:00:00+24:00",
    ].map(
      (recordedAt) =>
        [
          { recordedAt },
          "Enter a valid ISO 8601 timestamp with a timezone offset.",
        ] as const,
    ),
  ] as const;
  for (const [changes, error] of invalidCases) {
    const response = await call("readings", "POST", patient.token, {
      ...valid,
      ...changes,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
  }
  expect(
    (await call("readings?date=2024-02-30", "GET", patient.token)).status,
  ).toBe(400);
  expect(
    await (await call("readings?date=2099-01-01", "GET", patient.token)).json(),
  ).toEqual({ readings: [] });
  expect((await call("readings/invalid", "DELETE", patient.token)).status).toBe(
    404,
  );
  const original = await add("2024-07-08", "AFTER_LUNCH", 115);
  expect(
    (await call(`readings/${original.id}`, "PATCH", patient.token, {})).status,
  ).toBe(400);
  const nullValue = await call(
    `readings/${original.id}`,
    "PATCH",
    patient.token,
    { value: null },
  );
  expect(nullValue.status).toBe(400);
  expect(await nullValue.json()).toEqual({
    error: "Please enter a glucose value.",
  });
  await expect(
    Promise.resolve(
      prisma.reading.update({
        where: { id: original.id },
        data: { value: 601 },
      }),
    ),
  ).rejects.toThrow("Reading_value_check");
});
