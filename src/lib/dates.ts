import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function dateKey(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function dayRange(date: Date, timezone: string) {
  const key = dateKey(date, timezone);
  return {
    key,
    start: fromZonedTime(`${key}T00:00:00.000`, timezone),
    end: fromZonedTime(`${key}T23:59:59.999`, timezone),
  };
}
