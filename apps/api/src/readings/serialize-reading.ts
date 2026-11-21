import { formatCalendarDate } from "../dates";
import type { Reading } from "../generated/prisma/client";

export function serializeReading({
  id,
  date,
  recordedAt,
  slot,
  value,
}: Reading) {
  return {
    id,
    recordedAt: recordedAt.toISOString(),
    date: formatCalendarDate(date),
    slot,
    value,
  };
}
