import { PrismaPg } from "@prisma/adapter-pg";
import { createApp } from "./app";
import { PrismaClient } from "./generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const adapter = new PrismaPg({
  connectionString,
  connectionTimeoutMillis: 2_000,
});
const prisma = new PrismaClient({ adapter });
const app = createApp(() => prisma.$queryRaw`SELECT 1`);

app.listen(3001, "0.0.0.0", () =>
  console.log("Sweety API listening on port 3001"),
);
