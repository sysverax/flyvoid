// Pure parsing helpers for startDate/endDate filters. See
// docs/guidelines/time-frame-apis.md ("Custom date range filters"):
// - timestamp columns take an ISO 8601 timestamp WITH timezone info;
// - DATE columns take a plain YYYY-MM-DD calendar date.

// 2026-09-30T18:30:00Z, 2026-09-30T18:30:00.000Z, 2026-10-01T00:00:00+05:30.
// Seconds and the zone are required; new Date() alone would also accept
// date-only and zone-less strings and interpret them inconsistently.
const TIMESTAMP_WITH_TIMEZONE_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/;

const CALENDAR_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Parses an ISO 8601 timestamp that carries timezone info ("Z" or a
 * ±HH:MM offset) into the UTC instant it denotes. Returns null for anything
 * else: date-only, no zone, impossible dates or times, garbage.
 */
export function parseTimestampWithTimezone(value: string): Date | null {
  const match = TIMESTAMP_WITH_TIMEZONE_RE.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] =
    match;

  if (
    !isRealCalendarDate(Number(year), Number(month), Number(day)) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    (offsetHour !== undefined &&
      (Number(offsetHour) > 23 || Number(offsetMinute) > 59))
  ) {
    return null;
  }

  // The format is now unambiguous, so Date converts the offset to UTC.
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True for a real calendar date in strict YYYY-MM-DD form (not 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE_RE.exec(value);
  return (
    match !== null &&
    isRealCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
  );
}

/**
 * Whether `end` is a valid range end for `start`: strictly after for
 * timestamps (exclusive end), on or after when `allowEqual` (calendar dates,
 * both inclusive). Works on transformed values: two Dates, or two
 * YYYY-MM-DD strings (which sort lexicographically). Missing bounds are
 * open-ended, and values of another type are left to their own validators.
 */
export function isValidRangeEnd(
  start: unknown,
  end: unknown,
  allowEqual: boolean,
): boolean {
  let startKey: number | string;
  let endKey: number | string;

  if (start instanceof Date && end instanceof Date) {
    startKey = start.getTime();
    endKey = end.getTime();
  } else if (typeof start === "string" && typeof end === "string") {
    startKey = start;
    endKey = end;
  } else {
    return true;
  }

  return allowEqual ? endKey >= startKey : endKey > startKey;
}

/**
 * "2026-10-21 18:30:00.000" - a UTC instant as a parameter for a
 * `timestamp without time zone` column holding UTC.
 */
export const toUtcTimestampParam = (instant: Date): string =>
  instant.toISOString().replace("T", " ").replace("Z", "");
