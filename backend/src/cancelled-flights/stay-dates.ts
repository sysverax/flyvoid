import { toLocalDateTime } from "../common/utils/time-frame.util";

/**
 * Hotel stay dates of a cancelled flight. All dates are calendar dates
 * (YYYY-MM-DD) at the departure airport, never converted between timezones;
 * check-out is exclusive (the night before it is the last night).
 */
export interface StayDates {
  cancellationDate: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface StayDateLimits {
  /** Today at the departure airport (YYYY-MM-DD), from todayIn(). */
  today: string;
  /** Shown in messages, e.g. "DXB". */
  airportCode: string;
  maxNights: number;
  maxCheckInDaysAhead: number;
}

const toUtcMidnight = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/** `date` + `days` calendar days. */
export function addDays(date: string, days: number): string {
  return new Date(toUtcMidnight(date) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Whole days from `from` to `to` (nights of a stay). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / 86_400_000);
}

/** Today's calendar date in an IANA timezone, e.g. todayIn("Asia/Dubai"). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const { year, month, day } = toLocalDateTime(now, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The first broken stay rule as a user-facing message, or null when the stay
 * is valid. YYYY-MM-DD strings compare correctly as text.
 */
export function stayDatesError(
  stay: StayDates,
  limits: StayDateLimits,
): string | null {
  const { cancellationDate, checkInDate, checkOutDate } = stay;

  if (checkInDate < limits.today) {
    return `Check-in date must be today or later (today at ${limits.airportCode} is ${limits.today})`;
  }
  if (checkInDate < cancellationDate) {
    return `Check-in date cannot be before the cancellation date (${cancellationDate})`;
  }
  if (checkOutDate <= checkInDate) {
    return "Check-out date must be after the check-in date";
  }
  const nights = daysBetween(checkInDate, checkOutDate);
  if (nights > limits.maxNights) {
    return `The stay cannot be longer than ${limits.maxNights} nights (${nights} requested)`;
  }
  const latestCheckIn = addDays(limits.today, limits.maxCheckInDaysAhead);
  if (checkInDate > latestCheckIn) {
    return `Check-in date cannot be more than ${limits.maxCheckInDaysAhead} days ahead (latest ${latestCheckIn})`;
  }
  return null;
}
