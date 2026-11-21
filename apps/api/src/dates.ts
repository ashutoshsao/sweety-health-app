const datePattern = /^(?!0000)\d{4}-\d{2}-\d{2}$/;
const timestampPattern =
  /^(?!0000)\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export function isReportingTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function parseCalendarDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !datePattern.test(value)) return;
  try {
    Temporal.PlainDate.from(value);
    return new Date(`${value}T00:00:00Z`);
  } catch {
    return;
  }
}

export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseReadingTime(
  value: unknown,
  timeZone: string,
  now = Temporal.Now.instant(),
) {
  const invalid = {
    error: "Enter a valid ISO 8601 timestamp with a timezone offset.",
  };
  if (typeof value !== "string" || !timestampPattern.test(value))
    return invalid;

  try {
    const instant = Temporal.Instant.from(value);
    const recordedAt = new Date(instant.epochMilliseconds);
    const calendarDay = instant.toZonedDateTimeISO(timeZone).toPlainDate();
    if (
      recordedAt.getUTCFullYear() < 1 ||
      recordedAt.getUTCFullYear() > 9999 ||
      calendarDay.year < 1 ||
      calendarDay.year > 9999
    ) {
      return invalid;
    }
    const today = now.toZonedDateTimeISO(timeZone).toPlainDate();
    if (Temporal.PlainDate.compare(calendarDay, today) > 0) {
      return { error: "Date cannot be in the future." };
    }
    return {
      recordedAt,
      date: new Date(`${calendarDay}T00:00:00Z`),
    };
  } catch {
    return invalid;
  }
}
