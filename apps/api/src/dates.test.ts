import { expect, test } from "bun:test";
import { parseCalendarDate, parseReadingTime } from "./dates";

test("calendar dates reject impossible dates and non-date input", () => {
  expect(parseCalendarDate("2024-02-29")?.toISOString()).toBe(
    "2024-02-29T00:00:00.000Z",
  );
  for (const invalid of [
    "2023-02-29",
    "2024-04-31",
    "2024-1-1",
    "2024-01-01Z",
    "0000-01-01",
    undefined,
  ]) {
    expect(parseCalendarDate(invalid)).toBeUndefined();
  }
});

test("stored timestamps stay in the supported four-digit UTC year range", () => {
  expect(parseReadingTime("0001-01-01T00:00:00+01:00", "Europe/Paris")).toEqual(
    {
      error: "Enter a valid ISO 8601 timestamp with a timezone offset.",
    },
  );
});

test("equivalent timestamp offsets produce the same instant and reporting day", () => {
  const now = Temporal.Instant.from("2024-03-02T00:00:00Z");
  const instant = Date.UTC(2024, 1, 29, 18, 29, 59, 123);
  for (let minutes = -12 * 60; minutes <= 14 * 60; minutes += 33) {
    const absolute = Math.abs(minutes);
    const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
    const remainder = String(absolute % 60).padStart(2, "0");
    const offset = `${minutes < 0 ? "-" : "+"}${hours}:${remainder}`;
    const wallTime = new Date(instant + minutes * 60_000)
      .toISOString()
      .slice(0, -1);
    expect(
      parseReadingTime(`${wallTime}${offset}`, "Asia/Kolkata", now),
    ).toEqual({
      recordedAt: new Date(instant),
      date: new Date("2024-02-29T00:00:00Z"),
    });
  }
});

test("the future-date rule changes at midnight in the reporting timezone", () => {
  const recordedAt = "2024-03-01T18:30:00Z";
  const beforeMidnight = Temporal.Instant.from("2024-03-01T18:29:59.999Z");
  const midnight = Temporal.Instant.from(recordedAt);

  expect(parseReadingTime(recordedAt, "Asia/Kolkata", beforeMidnight)).toEqual({
    error: "Date cannot be in the future.",
  });
  expect(parseReadingTime(recordedAt, "Asia/Kolkata", midnight)).toEqual({
    recordedAt: new Date(recordedAt),
    date: new Date("2024-03-02T00:00:00Z"),
  });
  expect(parseReadingTime(recordedAt, "UTC", beforeMidnight)).toEqual({
    recordedAt: new Date(recordedAt),
    date: new Date("2024-03-01T00:00:00Z"),
  });
});

test("a DST repeated hour has two distinct instants on the same reporting day", () => {
  const now = Temporal.Instant.from("2024-11-04T00:00:00Z");
  const date = new Date("2024-11-03T00:00:00Z");
  expect(
    parseReadingTime("2024-11-03T01:30:00-04:00", "America/New_York", now),
  ).toEqual({ recordedAt: new Date("2024-11-03T05:30:00Z"), date });
  expect(
    parseReadingTime("2024-11-03T01:30:00-05:00", "America/New_York", now),
  ).toEqual({ recordedAt: new Date("2024-11-03T06:30:00Z"), date });
});
