import { once } from "node:events";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, expect, test } from "bun:test";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app";
import { createAuthRouter } from "../../src/auth/router";
import {
  PrismaClient,
  type ReadingSlot,
} from "../../src/generated/prisma/client";
import { createReadingsRouter } from "../../src/readings/router";
import { createReportsRouter } from "../../src/reports/router";

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
const app = createApp(
  () => prisma.$queryRaw`SELECT 1`,
  createAuthRouter(prisma, secret),
  createReadingsRouter(prisma, secret),
  createReportsRouter(prisma, secret),
);

let server: ReturnType<typeof app.listen> | undefined;
let baseUrl: string;
let patient: { id: string; token: string };
let other: { id: string; token: string };
type ReportPeriod = { startDate: string; endDate: string; summary: object };

async function createPatient(
  name: string,
  timeZone: string,
  passwordHash: string,
) {
  const { id } = await prisma.user.create({
    data: {
      name,
      email: `${emailPrefix}${name}@example.com`,
      timeZone,
      passwordHash,
    },
  });
  const token = jwt.sign({}, secret, {
    algorithm: "HS256",
    subject: id,
    expiresIn: "1h",
  });
  return { id, token };
}

beforeAll(async () => {
  const passwordHash = await Bun.password.hash("test passphrase", {
    algorithm: "bcrypt",
    cost: 4,
  });
  patient = await createPatient("patient", "Asia/Kolkata", passwordHash);
  other = await createPatient("other", "UTC", passwordHash);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected a TCP address");
  baseUrl = `http://127.0.0.1:${address.port}/api`;
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

function request(path: string, token?: string, method = "GET", body?: object) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body) headers.set("Content-Type", "application/json");
  return fetch(`${baseUrl}/${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

async function report(date: string, token = patient.token) {
  const response = await request(`reports?date=${date}`, token);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return (await response.json()) as {
    selectedDate: string;
    daily: ReportPeriod & { readings: object[] };
    monthToDate: ReportPeriod;
    monthly: ReportPeriod;
  };
}

function seedReading(
  userId: string,
  date: string,
  value: number,
  slot: ReadingSlot = "AFTER_LUNCH",
) {
  return {
    userId,
    date: new Date(date),
    recordedAt: new Date(`${date}T12:00:00Z`),
    value,
    slot,
  };
}

test("uses inclusive calendar boundaries, daily slot order, and only the caller's rows", async () => {
  const lunch = await prisma.reading.create({
    data: seedReading(patient.id, "2024-10-15", 104),
  });
  await prisma.reading.createMany({
    data: [
      seedReading(patient.id, "2024-08-31", 599),
      seedReading(patient.id, "2024-09-01", 80),
      seedReading(patient.id, "2024-09-30", 120),
      seedReading(patient.id, "2024-10-01", 96),
      seedReading(patient.id, "2024-10-10", 101),
      seedReading(patient.id, "2024-10-16", 600),
      seedReading(other.id, "2024-09-01", 41),
      seedReading(other.id, "2024-10-15", 40),
    ],
  });

  const createFasting = await request("readings", patient.token, "POST", {
    recordedAt: "2024-10-15T00:15:00+05:30",
    slot: "MORNING_FASTING",
    value: 100,
  });
  expect(createFasting.status).toBe(201);
  const { reading: fasting } = (await createFasting.json()) as {
    reading: { id: string };
  };

  expect(await report("2024-10-15")).toEqual({
    selectedDate: "2024-10-15",
    daily: {
      startDate: "2024-10-15",
      endDate: "2024-10-15",
      summary: { highest: 104, lowest: 100, average: 102, count: 2 },
      readings: [
        {
          id: fasting.id,
          recordedAt: "2024-10-14T18:45:00.000Z",
          date: "2024-10-15",
          slot: "MORNING_FASTING",
          value: 100,
        },
        {
          id: lunch.id,
          recordedAt: "2024-10-15T12:00:00.000Z",
          date: "2024-10-15",
          slot: "AFTER_LUNCH",
          value: 104,
        },
      ],
    },
    monthToDate: {
      startDate: "2024-10-01",
      endDate: "2024-10-15",
      summary: { highest: 104, lowest: 96, average: 100.3, count: 4 },
    },
    monthly: {
      startDate: "2024-09-01",
      endDate: "2024-09-30",
      summary: { highest: 120, lowest: 80, average: 100, count: 2 },
    },
  });
  expect((await report("2024-10-15", other.token)).daily.summary).toEqual({
    highest: 40,
    lowest: 40,
    average: 40,
    count: 1,
  });
});

test("edits and deletes are reflected in every applicable report", async () => {
  const row = await prisma.reading.create({
    data: seedReading(patient.id, "2024-12-31", 90),
  });
  expect(
    (
      await request(`readings/${row.id}`, patient.token, "PATCH", {
        value: 112,
      })
    ).status,
  ).toBe(200);

  const current = await report("2024-12-31");
  const edited = { highest: 112, lowest: 112, average: 112, count: 1 };
  expect(current.daily.summary).toEqual(edited);
  expect(current.monthToDate.summary).toEqual(edited);
  expect((await report("2025-01-01")).monthly.summary).toEqual(edited);

  expect(
    (await request(`readings/${row.id}`, patient.token, "DELETE")).status,
  ).toBe(204);
  const empty = { highest: null, lowest: null, average: null, count: 0 };
  const updated = await report("2024-12-31");
  expect(updated.daily.readings).toEqual([]);
  expect(updated.daily.summary).toEqual(empty);
  expect(updated.monthToDate.summary).toEqual(empty);
  expect((await report("2025-01-01")).monthly.summary).toEqual(empty);
});

test("rejects missing credentials and bad calendar dates, and allows future selections", async () => {
  expect((await request("reports?date=2024-10-15")).status).toBe(401);
  for (const query of [
    "",
    "?date=2025-02-29",
    "?date=2024-1-01",
    "?date=0001-01-31",
    "?date=2024-10-15&date=2024-10-16",
  ]) {
    const response = await request(`reports${query}`, patient.token);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  }

  const future = await report("2099-01-01");
  const empty = { highest: null, lowest: null, average: null, count: 0 };
  expect(future.daily.summary).toEqual(empty);
  expect(future.monthToDate.summary).toEqual(empty);
  expect(future.monthly.summary).toEqual(empty);
});
