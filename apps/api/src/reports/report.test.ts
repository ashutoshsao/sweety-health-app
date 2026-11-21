import { expect, test } from "bun:test";
import { reportRanges, summarize } from "./report";

test("ranges include the first and last days of the selected and previous months", () => {
  expect(reportRanges(new Date("2024-10-01"))).toEqual({
    daily: { startDate: "2024-10-01", endDate: "2024-10-01" },
    monthToDate: { startDate: "2024-10-01", endDate: "2024-10-01" },
    monthly: { startDate: "2024-09-01", endDate: "2024-09-30" },
  });
  expect(reportRanges(new Date("2024-10-31"))?.monthToDate).toEqual({
    startDate: "2024-10-01",
    endDate: "2024-10-31",
  });
});

test("the previous month rolls over years and respects February's length", () => {
  for (const [date, startDate, endDate] of [
    ["2025-01-01", "2024-12-01", "2024-12-31"],
    ["2024-03-15", "2024-02-01", "2024-02-29"],
    ["2025-03-15", "2025-02-01", "2025-02-28"],
    ["0001-02-01", "0001-01-01", "0001-01-31"],
  ]) {
    expect(reportRanges(new Date(date))?.monthly).toEqual({
      startDate,
      endDate,
    });
  }
  expect(reportRanges(new Date("0001-01-01"))).toBeUndefined();
});

test("summaries represent empty data, round ties up, and weight every reading equally", () => {
  expect(summarize([])).toEqual({
    highest: null,
    lowest: null,
    average: null,
    count: 0,
  });
  expect(summarize([96, 101, 100, 104].map((value) => ({ value })))).toEqual({
    highest: 104,
    lowest: 96,
    average: 100.3,
    count: 4,
  });

  for (let seed = 0; seed < 64; seed += 1) {
    const readings: { value: number }[] = [];
    for (let day = 1; day <= 31; day += 1) {
      const slots = (seed + day * 3) % 5;
      for (let slot = 0; slot < slots; slot += 1) {
        readings.push({
          value: 40 + ((seed * 17 + day * 13 + slot * 29) % 561),
        });
      }
    }

    const values = readings.map(({ value }) => value).sort((a, b) => a - b);
    const scaledSum = values.reduce((total, value) => total + value * 10, 0);
    const quotient = Math.floor(scaledSum / values.length);
    const remainder = scaledSum % values.length;
    const average = (quotient + Number(remainder * 2 >= values.length)) / 10;
    expect(summarize(readings)).toEqual({
      highest: values[values.length - 1],
      lowest: values[0],
      average,
      count: values.length,
    });
  }
});
