import { isReportingTimeZone } from "./dates";

export function getReportingTimeZone() {
  const timeZone =
    process.env.REPORTING_TIME_ZONE ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!isReportingTimeZone(timeZone)) {
    throw new Error("REPORTING_TIME_ZONE must be an IANA timezone.");
  }
  return timeZone;
}
