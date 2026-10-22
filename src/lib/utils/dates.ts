import { CLINIC_TIME_ZONE } from "@/lib/clinic/default-clinic";

export const clinicTimeZone = CLINIC_TIME_ZONE;

export function calendarDateInTimeZone(date: Date, timeZone = clinicTimeZone): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function isTodayOrFuture(value: string, now = new Date(), timeZone = clinicTimeZone): boolean {
  return isRealCalendarDate(value) && value >= calendarDateInTimeZone(now, timeZone);
}
