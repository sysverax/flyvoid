import {
  TIME_FRAME,
  TimeFrame,
  TREND_GRANULARITY,
  TrendGranularity,
} from "../constants/time-frame.constants";

// Pure date helpers for time-frame reporting (dashboard trends and the
// cancelled flights summary): no Nest or database dependencies, so the
// timezone, range and bucketing rules are unit-testable.

export const DEFAULT_TIME_ZONE = "UTC";

const MS_PER_MINUTE = 60_000;

/** Wall-clock fields in some timezone. `month` is 1-12. */
export interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface TimeFrameRange {
  /** The timezone the range was computed in (UTC when none was usable). */
  timeZone: string;
  /** Inclusive lower bound, as a UTC instant. */
  startUtc: Date;
  /** Exclusive upper bound, as a UTC instant. */
  endUtc: Date;
}

export interface TrendWindow extends TimeFrameRange {
  timeFrame: TimeFrame;
  granularity: TrendGranularity;
  /** Every bucket key in the window, oldest first. */
  buckets: string[];
}

export interface TrendPoint {
  bucket: string;
  label: string;
  value: number;
}

// Fixed English names so labels don't depend on the server's ICU locale.
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

const pad = (value: number, length = 2): string =>
  String(value).padStart(length, "0");

/**
 * True for a named IANA timezone such as "Asia/Colombo" or "UTC" (aliases
 * included). Raw offsets like "+05:30" are rejected even though newer Node
 * versions accept them: Postgres AT TIME ZONE reads their sign the opposite
 * way, which would shift every range by twice the offset.
 */
export function isIanaTimeZone(value: string): boolean {
  if (!value || /^[+-]/.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a valid IANA timezone, falling back to UTC when the value is empty
 * or not a named IANA timezone (e.g. "UTC+5:30" saved on an older record).
 * Not for request input: time-frame APIs reject invalid timezones with 400.
 */
export function resolveTimeZone(timeZone?: string | null): string {
  const candidate = timeZone?.trim();
  if (!candidate || !isIanaTimeZone(candidate)) {
    return DEFAULT_TIME_ZONE;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: candidate,
  }).resolvedOptions().timeZone;
}

export function toLocalDateTime(
  instant: Date,
  timeZone: string,
): LocalDateTime {
  const parts = getFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (east positive). */
export function getTimeZoneOffsetMinutes(
  instant: Date,
  timeZone: string,
): number {
  const local = toLocalDateTime(instant, timeZone);
  const wallClockMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  const instantMs = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((wallClockMs - instantMs) / MS_PER_MINUTE);
}

/**
 * Converts a wall-clock time in `timeZone` to the UTC instant it denotes.
 * A wall-clock time skipped by a DST jump resolves to the instant after it.
 */
export function localDateTimeToUtc(
  local: LocalDateTime,
  timeZone: string,
): Date {
  const wallClockMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  const firstOffset = getTimeZoneOffsetMinutes(new Date(wallClockMs), timeZone);
  let utcMs = wallClockMs - firstOffset * MS_PER_MINUTE;
  const secondOffset = getTimeZoneOffsetMinutes(new Date(utcMs), timeZone);
  if (secondOffset !== firstOffset) {
    utcMs = wallClockMs - secondOffset * MS_PER_MINUTE;
  }
  return new Date(utcMs);
}

/** Formats `instant` as local time with its offset, e.g. "2026-10-21T23:59:59+05:30". */
export function formatInTimeZone(instant: Date, timeZone: string): string {
  const local = toLocalDateTime(instant, timeZone);
  const offset = getTimeZoneOffsetMinutes(instant, timeZone);
  const sign = offset < 0 ? "-" : "+";
  const absOffset = Math.abs(offset);

  return (
    `${pad(local.year, 4)}-${pad(local.month)}-${pad(local.day)}` +
    `T${pad(local.hour)}:${pad(local.minute)}:${pad(local.second)}` +
    `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`
  );
}

/**
 * Builds a wall-clock value, normalising overflow the same way Date.UTC does
 * (day 0 is the last day of the previous month, month 13 is next January).
 */
function wallClock(
  year: number,
  month: number,
  day = 1,
  hour = 0,
): LocalDateTime {
  const normalised = new Date(Date.UTC(year, month - 1, day, hour));
  return {
    year: normalised.getUTCFullYear(),
    month: normalised.getUTCMonth() + 1,
    day: normalised.getUTCDate(),
    hour: normalised.getUTCHours(),
    minute: 0,
    second: 0,
  };
}

function addSteps(
  local: LocalDateTime,
  granularity: TrendGranularity,
  steps: number,
): LocalDateTime {
  switch (granularity) {
    case TREND_GRANULARITY.HOUR:
      return wallClock(local.year, local.month, local.day, local.hour + steps);
    case TREND_GRANULARITY.DAY:
      return wallClock(local.year, local.month, local.day + steps);
    case TREND_GRANULARITY.MONTH:
      return wallClock(local.year, local.month + steps);
    case TREND_GRANULARITY.YEAR:
      return wallClock(local.year + steps, 1);
  }
}

/** Bucket key for a wall-clock bucket start: "2026-10-21T14:00", "2026-10-21", "2026-10" or "2026". */
export function toBucketKey(
  local: LocalDateTime,
  granularity: TrendGranularity,
): string {
  const yearKey = pad(local.year, 4);
  const monthKey = `${yearKey}-${pad(local.month)}`;
  const dayKey = `${monthKey}-${pad(local.day)}`;

  switch (granularity) {
    case TREND_GRANULARITY.HOUR:
      return `${dayKey}T${pad(local.hour)}:00`;
    case TREND_GRANULARITY.DAY:
      return dayKey;
    case TREND_GRANULARITY.MONTH:
      return monthKey;
    case TREND_GRANULARITY.YEAR:
      return yearKey;
  }
}

interface TimeFrameDefinition {
  granularity: TrendGranularity;
  /** Wall-clock start of the first bucket (inclusive). */
  start: LocalDateTime;
  /** Wall-clock end of the range (exclusive). */
  end: LocalDateTime;
  bucketCount: number;
}

/**
 * The single source of truth for what each time frame covers, in the
 * calendar of `zone`:
 * - today: 00:00 today up to the end of today, hourly up to the current hour
 * - yesterday: all 24 hours of yesterday
 * - week: the last 7 days including today
 * - month: the last 12 calendar months including the current one
 * - year: the last 6 years including the current one
 * Ranges end at the end of the current day, month or year; nothing is
 * recorded in the future, so that matches "up to now".
 */
function defineTimeFrame(
  timeFrame: TimeFrame,
  zone: string,
  now: Date,
): TimeFrameDefinition {
  const { year, month, day, hour } = toLocalDateTime(now, zone);

  let granularity: TrendGranularity;
  let start: LocalDateTime;
  let end: LocalDateTime;
  let bucketCount: number;

  switch (timeFrame) {
    case TIME_FRAME.TODAY:
      granularity = TREND_GRANULARITY.HOUR;
      start = wallClock(year, month, day);
      end = wallClock(year, month, day + 1);
      bucketCount = hour + 1;
      break;
    case TIME_FRAME.YESTERDAY:
      granularity = TREND_GRANULARITY.HOUR;
      start = wallClock(year, month, day - 1);
      end = wallClock(year, month, day);
      bucketCount = 24;
      break;
    case TIME_FRAME.WEEK:
      granularity = TREND_GRANULARITY.DAY;
      start = wallClock(year, month, day - 6);
      end = wallClock(year, month, day + 1);
      bucketCount = 7;
      break;
    case TIME_FRAME.MONTH:
      granularity = TREND_GRANULARITY.MONTH;
      start = wallClock(year, month - 11);
      end = wallClock(year, month + 1);
      bucketCount = 12;
      break;
    case TIME_FRAME.YEAR:
      granularity = TREND_GRANULARITY.YEAR;
      start = wallClock(year - 5, 1);
      end = wallClock(year + 1, 1);
      bucketCount = 6;
      break;
    default: {
      const unsupported: never = timeFrame;
      throw new Error(`Unsupported time frame: ${String(unsupported)}`);
    }
  }

  return { granularity, start, end, bucketCount };
}

/**
 * Guards the time-frame helpers: request timezones are validated by
 * TimezoneField, so an invalid value here is a programming error. These
 * helpers never fall back to UTC or the airline's timezone.
 */
function assertIanaTimeZone(timeZone: string): void {
  if (!isIanaTimeZone(timeZone)) {
    throw new RangeError(`Invalid IANA timezone: ${JSON.stringify(timeZone)}`);
  }
}

/**
 * Resolves a time frame to its UTC range in `timeZone`'s calendar. Shared
 * by every time-frame filter so totals and trends always cover exactly the
 * same rows. `timeZone` must be a validated IANA name; it is returned as is.
 */
export function resolveTimeFrameRange(
  timeFrame: TimeFrame,
  timeZone: string,
  now: Date = new Date(),
): TimeFrameRange {
  assertIanaTimeZone(timeZone);
  const { start, end } = defineTimeFrame(timeFrame, timeZone, now);
  return {
    timeZone,
    startUtc: localDateTimeToUtc(start, timeZone),
    endUtc: localDateTimeToUtc(end, timeZone),
  };
}

export interface TimeFrameRangeDescription {
  timeFrame: TimeFrame;
  timezone: string;
  /** Range start in `timezone`, with offset: "2026-10-16T00:00:00+05:30". */
  startDate: string;
  /** Last second inside the range (exclusive end minus 1 second), with offset. */
  endDate: string;
}

/** The response fields that tell the frontend exactly which range was used. */
export function describeTimeFrameRange(
  timeFrame: TimeFrame,
  range: TimeFrameRange,
): TimeFrameRangeDescription {
  return {
    timeFrame,
    timezone: range.timeZone,
    startDate: formatInTimeZone(range.startUtc, range.timeZone),
    endDate: formatInTimeZone(
      new Date(range.endUtc.getTime() - 1000),
      range.timeZone,
    ),
  };
}

/** The range of resolveTimeFrameRange() plus its full list of chart buckets. */
export function buildTrendWindow(
  timeFrame: TimeFrame,
  timeZone: string,
  now: Date = new Date(),
): TrendWindow {
  const range = resolveTimeFrameRange(timeFrame, timeZone, now);
  const { granularity, start, bucketCount } = defineTimeFrame(
    timeFrame,
    range.timeZone,
    now,
  );

  const buckets = Array.from({ length: bucketCount }, (_, index) =>
    toBucketKey(addSteps(start, granularity, index), granularity),
  );

  return { ...range, timeFrame, granularity, buckets };
}

/**
 * Display label for a bucket key: "14:00" (hour), "Monday" (day),
 * "October" (month) or "2026" (year).
 */
export function toBucketLabel(
  bucket: string,
  granularity: TrendGranularity,
): string {
  switch (granularity) {
    case TREND_GRANULARITY.HOUR:
      return bucket.slice(bucket.indexOf("T") + 1);
    case TREND_GRANULARITY.DAY: {
      const [year, month, day] = bucket.split("-").map(Number);
      return WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    }
    case TREND_GRANULARITY.MONTH:
      return MONTH_NAMES[Number(bucket.slice(5, 7)) - 1];
    case TREND_GRANULARITY.YEAR:
      return bucket;
  }
}

/** Merges aggregated values into the full bucket list, filling gaps with 0. */
export function fillTrendBuckets(
  buckets: string[],
  values: Map<string, number>,
  granularity: TrendGranularity,
): TrendPoint[] {
  return buckets.map((bucket) => ({
    bucket,
    label: toBucketLabel(bucket, granularity),
    value: values.get(bucket) ?? 0,
  }));
}
