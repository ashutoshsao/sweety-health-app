import express from "express";
import { authenticationRequired, requireAuth } from "../auth/require-auth";
import { parseCalendarDate, parseReadingTime } from "../dates";
import {
  Prisma,
  ReadingSlot,
  type PrismaClient,
} from "../generated/prisma/client";
import { isUuid, noStore, parseJson, RequestError } from "../http";
import { serializeReading } from "./serialize-reading";

const slotLabels: Record<ReadingSlot, string> = {
  MORNING_FASTING: "Morning (fasting)",
  AFTER_BREAKFAST: "After breakfast",
  AFTER_LUNCH: "After lunch",
  AFTER_DINNER: "After dinner",
};

function parseSlot(value: unknown): ReadingSlot {
  if (typeof value === "string" && Object.hasOwn(slotLabels, value)) {
    return value as ReadingSlot;
  }
  throw new RequestError(400, "Choose a valid time slot.");
}

function parseValue(value: unknown): number {
  if (value == null)
    throw new RequestError(400, "Please enter a glucose value.");
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 40 ||
    value > 600
  ) {
    throw new RequestError(400, "Value must be between 40 and 600 mg/dl.");
  }
  return value;
}

function isPrismaError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

function readingNotFound() {
  return new RequestError(404, "Reading not found.");
}

function slotConflict(slot: ReadingSlot | undefined) {
  const article = slot === ReadingSlot.MORNING_FASTING ? "a" : "an";
  return new RequestError(
    409,
    slot
      ? `You already have ${article} ${slotLabels[slot]} reading for this date.`
      : "You already have a reading in this slot for this date.",
  );
}

async function readingTime(
  prisma: PrismaClient,
  userId: string,
  value: unknown,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timeZone: true },
  });
  if (!user) throw new RequestError(401, authenticationRequired.error);

  const time = parseReadingTime(value, user.timeZone);
  if ("error" in time) throw new RequestError(400, time.error);
  return time;
}

export function createReadingsRouter(prisma: PrismaClient, secret: string) {
  const router = express.Router();
  router.use(noStore, requireAuth(secret));

  router.get("/", async (request, response) => {
    const date = parseCalendarDate(request.query.date);
    if (!date)
      throw new RequestError(400, "Enter a valid date in YYYY-MM-DD format.");

    const readings = await prisma.reading.findMany({
      where: { userId: request.userId!, date },
      orderBy: { slot: "asc" },
    });
    response.json({ readings: readings.map(serializeReading) });
  });

  router.post("/", parseJson, async (request, response) => {
    const userId = request.userId!;
    const body = request.body ?? {};
    const value = parseValue(body.value);
    const slot = parseSlot(body.slot);
    const time = await readingTime(prisma, userId, body.recordedAt);

    try {
      const reading = await prisma.reading.create({
        data: { userId, value, slot, ...time },
      });
      response.status(201).json({ reading: serializeReading(reading) });
    } catch (error) {
      if (isPrismaError(error, "P2002")) throw slotConflict(slot);
      throw error;
    }
  });

  router.patch("/:id", parseJson, async (request, response) => {
    const userId = request.userId!;
    const { id } = request.params;
    if (!isUuid(id)) throw readingNotFound();

    const body = request.body ?? {};
    const value = body.value === undefined ? undefined : parseValue(body.value);
    const slot = body.slot === undefined ? undefined : parseSlot(body.slot);
    const time =
      body.recordedAt === undefined
        ? undefined
        : await readingTime(prisma, userId, body.recordedAt);
    if (value === undefined && slot === undefined && time === undefined) {
      throw new RequestError(
        400,
        "Enter at least one reading field to update.",
      );
    }

    const where = { id, userId };
    try {
      const reading = await prisma.reading.update({
        where,
        data: { value, slot, ...time },
      });
      response.json({ reading: serializeReading(reading) });
    } catch (error) {
      if (isPrismaError(error, "P2025")) throw readingNotFound();
      if (isPrismaError(error, "P2002")) {
        const currentSlot =
          slot ??
          (await prisma.reading.findUnique({ where, select: { slot: true } }))
            ?.slot;
        throw slotConflict(currentSlot);
      }
      throw error;
    }
  });

  router.delete("/:id", async (request, response) => {
    const { id } = request.params;
    if (!isUuid(id)) throw readingNotFound();

    const result = await prisma.reading.deleteMany({
      where: { id, userId: request.userId! },
    });
    if (result.count === 0) throw readingNotFound();
    response.status(204).end();
  });

  return router;
}
