import { createApp } from "./app";
import { createAuthRouter } from "./auth/router";
import { getReportingTimeZone } from "./config";
import { connectDatabase } from "./database";
import { createReadingsRouter } from "./readings/router";
import { createReportsRouter } from "./reports/router";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || Buffer.byteLength(jwtSecret, "utf8") < 32) {
  throw new Error("JWT_SECRET must be at least 32 bytes.");
}

const reportingTimeZone = getReportingTimeZone();
const prisma = connectDatabase();
const app = createApp(
  () => prisma.$queryRaw`SELECT 1`,
  createAuthRouter(prisma, jwtSecret, reportingTimeZone),
  createReadingsRouter(prisma, jwtSecret),
  createReportsRouter(prisma, jwtSecret),
);

app.listen(3001, "0.0.0.0", () =>
  console.log("Sweety API listening on port 3001"),
);
