import { Temporal } from "@js-temporal/polyfill";

export const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function reportingToday(timeZone: string, now = Temporal.Now.instant()) {
  return now.toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

export function shiftDay(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

export function dayLabel(
  date: string,
  dateStyle: Intl.DateTimeFormatOptions["dateStyle"] = "medium",
) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle,
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function readingTimeLabel(
  recordedAt: string,
  reportingDate: string,
  timeZone = deviceTimeZone,
) {
  const local = Temporal.Instant.from(recordedAt).toZonedDateTimeISO(timeZone);
  const dateStyle =
    local.toPlainDate().toString() === reportingDate ? undefined : "medium";
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle,
    timeStyle: "short",
  }).format(new Date(recordedAt));
}

function timestamp(zoned: Temporal.ZonedDateTime) {
  if (zoned.offset.length > 6) {
    return zoned
      .toInstant()
      .toString({ smallestUnit: "second" })
      .replace(/Z$/, "+00:00");
  }
  return zoned.toString({
    timeZoneName: "never",
    calendarName: "never",
    smallestUnit: "second",
  });
}

export function initialReadingTime(
  reportingDate: string,
  reportingTimeZone: string,
  timeZone = deviceTimeZone,
  now = Temporal.Now.instant(),
) {
  const instant =
    reportingDate === reportingToday(reportingTimeZone, now)
      ? now
      : Temporal.PlainDate.from(reportingDate)
          .toZonedDateTime({ timeZone: reportingTimeZone, plainTime: "12:00" })
          .toInstant();
  const local = instant
    .toZonedDateTimeISO(timeZone)
    .round({ smallestUnit: "minute", roundingMode: "trunc" });
  return {
    local: local.toPlainDateTime().toString({ smallestUnit: "minute" }),
    recordedAt: timestamp(local),
  };
}

export function readingTimeInput(
  recordedAt: string,
  timeZone = deviceTimeZone,
) {
  return Temporal.Instant.from(recordedAt)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}

export function interpretLocalTime(
  value: string,
  reportingTimeZone: string,
  timeZone = deviceTimeZone,
) {
  if (!value) throw new Error("Choose a date and time.");
  const local = Temporal.PlainDateTime.from(value);
  const zoned = local.toZonedDateTime(timeZone);
  if (!zoned.toPlainDateTime().equals(local)) {
    throw new Error(
      "This local time was skipped when the clocks changed. Choose another time.",
    );
  }
  return {
    recordedAt: timestamp(zoned),
    reportingDate: zoned
      .withTimeZone(reportingTimeZone)
      .toPlainDate()
      .toString(),
  };
}

export function reportingDayForInstant(
  recordedAt: string,
  reportingTimeZone: string,
) {
  return Temporal.Instant.from(recordedAt)
    .toZonedDateTimeISO(reportingTimeZone)
    .toPlainDate()
    .toString();
}
