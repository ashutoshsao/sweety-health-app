import { Temporal } from "@js-temporal/polyfill";
import { expect, test } from "bun:test";
import {
  initialReadingTime,
  interpretLocalTime,
  readingTimeInput,
  reportingToday,
} from "../src/time";

test("device-local and reporting calendar days can differ for the same instant", () => {
  const entered = interpretLocalTime(
    "2024-10-14T23:30",
    "UTC",
    "America/New_York",
  );
  expect(entered).toEqual({
    recordedAt: "2024-10-14T23:30:00-04:00",
    reportingDate: "2024-10-15",
  });
  expect(readingTimeInput("2024-10-15T03:30:00Z", "America/New_York")).toBe(
    "2024-10-14T23:30",
  );
  expect(reportingToday("UTC", Temporal.Instant.from(entered.recordedAt))).toBe(
    "2024-10-15",
  );
});

test("a past-day default stays in the selected reporting day across timezones", () => {
  const now = Temporal.Instant.from("2024-10-20T12:00:00Z");
  const entry = initialReadingTime(
    "2024-10-14",
    "Pacific/Kiritimati",
    "Pacific/Honolulu",
    now,
  );
  expect(entry.local).toBe("2024-10-13T12:00");
  expect(
    interpretLocalTime(entry.local, "Pacific/Kiritimati", "Pacific/Honolulu")
      .reportingDate,
  ).toBe("2024-10-14");
});

test("skipped local times are rejected and repeated times choose the first occurrence", () => {
  expect(() =>
    interpretLocalTime("2024-03-10T02:30", "UTC", "America/New_York"),
  ).toThrow("This local time was skipped");
  expect(
    interpretLocalTime("2024-11-03T01:30", "UTC", "America/New_York")
      .recordedAt,
  ).toBe("2024-11-03T01:30:00-04:00");
});
