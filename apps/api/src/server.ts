import { PrismaPg } from "@prisma/adapter-pg";
import { createApp } from "./app";
import { createAuthRouter } from "./auth/router";
import { isReportingTimeZone } from "./dates";
import { PrismaClient } from "./generated/prisma/client";
import { createReadingsRouter } from "./readings/router";
import { createReportsRouter } from "./reports/router";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || Buffer.byteLength(jwtSecret, "utf8") < 32) {
  throw new Error("JWT_SECRET must be at least 32 bytes.");
}

const reportingTimeZone =
  process.env.REPORTING_TIME_ZONE ||
  Intl.DateTimeFormat().resolvedOptions().timeZone;
if (!isReportingTimeZone(reportingTimeZone)) {
  throw new Error("REPORTING_TIME_ZONE must be an IANA timezone.");
}

const adapter = new PrismaPg({
  connectionString,
  connectionTimeoutMillis: 2_000,
});
const prisma = new PrismaClient({ adapter });
const app = createApp(
  () => prisma.$queryRaw`SELECT 1`,
  createAuthRouter(prisma, jwtSecret, reportingTimeZone),
  createReadingsRouter(prisma, jwtSecret),
  createReportsRouter(prisma, jwtSecret),
);

app.listen(3001, "0.0.0.0", () =>
  console.log("Sweety API listening on port 3001"),
);
