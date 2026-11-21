import express from "express";
import { requireAuth } from "../auth/require-auth";
import { parseCalendarDate } from "../dates";
import type { PrismaClient } from "../generated/prisma/client";
import { noStore, RequestError } from "../http";
import { serializeReading } from "../readings/serialize-reading";
import { reportRanges, summarize } from "./report";

export function createReportsRouter(prisma: PrismaClient, secret: string) {
  const router = express.Router();
  router.use(noStore, requireAuth(secret));

  router.get("/", async (request, response) => {
    const date = parseCalendarDate(request.query.date);
    if (!date)
      throw new RequestError(400, "Enter a valid date in YYYY-MM-DD format.");
    const ranges = reportRanges(date);
    if (!ranges)
      throw new RequestError(
        400,
        "Choose a date with a supported previous month.",
      );

    const firstOfMonth = new Date(ranges.monthToDate.startDate);
    const readings = await prisma.reading.findMany({
      where: {
        userId: request.userId!,
        date: { gte: new Date(ranges.monthly.startDate), lte: date },
      },
      orderBy: [{ date: "asc" }, { slot: "asc" }],
    });
    const daily = readings.filter(
      (reading) => reading.date.getTime() === date.getTime(),
    );
    const monthToDate = readings.filter(
      (reading) => reading.date >= firstOfMonth,
    );
    const monthly = readings.filter((reading) => reading.date < firstOfMonth);

    response.json({
      selectedDate: ranges.daily.startDate,
      daily: {
        ...ranges.daily,
        summary: summarize(daily),
        readings: daily.map(serializeReading),
      },
      monthToDate: { ...ranges.monthToDate, summary: summarize(monthToDate) },
      monthly: { ...ranges.monthly, summary: summarize(monthly) },
    });
  });

  return router;
}
