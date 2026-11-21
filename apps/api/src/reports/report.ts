import { formatCalendarDate } from "../dates";

export function reportRanges(date: Date) {
  const selectedDate = formatCalendarDate(date);
  const selected = Temporal.PlainDate.from(selectedDate);
  const firstOfMonth = selected.with({ day: 1 });
  const firstOfPreviousMonth = firstOfMonth.subtract({ months: 1 });
  if (firstOfPreviousMonth.year < 1) return;

  return {
    daily: { startDate: selectedDate, endDate: selectedDate },
    monthToDate: { startDate: firstOfMonth.toString(), endDate: selectedDate },
    monthly: {
      startDate: firstOfPreviousMonth.toString(),
      endDate: firstOfMonth.subtract({ days: 1 }).toString(),
    },
  };
}

export function summarize(readings: readonly { value: number }[]) {
  const count = readings.length;
  if (count === 0) return { highest: null, lowest: null, average: null, count };

  let highest = readings[0].value;
  let lowest = highest;
  let sum = 0;

  for (const { value } of readings) {
    highest = Math.max(highest, value);
    lowest = Math.min(lowest, value);
    sum += value;
  }

  return {
    highest,
    lowest,
    average: Math.round((sum * 10) / count) / 10,
    count,
  };
}
