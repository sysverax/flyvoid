/**
 * Timezone helper — black-box e2e only.
 *
 * Independent oracle for time-frame expectations, built on Intl so it works
 * for any IANA timezone (DST and non-whole-hour offsets included). Does NOT
 * import anything from src/.
 */

export type TimeFrame = "today" | "yesterday" | "week" | "month" | "year";
export type Granularity = "hour" | "day" | "month" | "year";

export interface WallClock {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  hour: number;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Offset of `zone` from UTC at `instant`, in milliseconds (east positive). */
export function offsetMs(zone: string, instant: Date | number): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(new Date(instant))
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === "-" ? -minutes : minutes) * 60_000;
}

/** Local wall-clock fields of `instant` in `zone`. */
export function wallClock(zone: string, instant: Date | number): WallClock {
  const local = new Date(new Date(instant).getTime() + offsetMs(zone, instant));
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
  };
}

/** UTC instant (ms) of a local wall-clock time in `zone`; overflow normalises like Date.UTC. */
export function zonedToUtc(
  zone: string,
  year: number,
  month: number,
  day = 1,
  hour = 0,
): number {
  const wall = Date.UTC(year, month - 1, day, hour);
  const first = wall - offsetMs(zone, wall);
  const second = wall - offsetMs(zone, first);
  return second;
}

/** [start, end) of a time frame in `zone`, as UTC milliseconds. */
export function rangeFor(
  timeFrame: TimeFrame,
  now: Date,
  zone: string,
): { start: number; end: number } {
  const { year: y, month: m, day: d } = wallClock(zone, now);
  switch (timeFrame) {
    case "today":
      return { start: zonedToUtc(zone, y, m, d), end: zonedToUtc(zone, y, m, d + 1) };
    case "yesterday":
      return { start: zonedToUtc(zone, y, m, d - 1), end: zonedToUtc(zone, y, m, d) };
    case "week":
      return { start: zonedToUtc(zone, y, m, d - 6), end: zonedToUtc(zone, y, m, d + 1) };
    case "month":
      return { start: zonedToUtc(zone, y, m - 11), end: zonedToUtc(zone, y, m + 1) };
    case "year":
      return { start: zonedToUtc(zone, y - 5, 1), end: zonedToUtc(zone, y + 1, 1) };
  }
}

/** Chart bucket key of `instant` in `zone`, matching the API's format. */
export function bucketKey(
  instant: Date | number,
  granularity: Granularity,
  zone: string,
): string {
  const { year, month, day, hour } = wallClock(zone, instant);
  const yearKey = String(year);
  const monthKey = `${yearKey}-${pad(month)}`;
  const dayKey = `${monthKey}-${pad(day)}`;
  switch (granularity) {
    case "hour":
      return `${dayKey}T${pad(hour)}:00`;
    case "day":
      return dayKey;
    case "month":
      return monthKey;
    case "year":
      return yearKey;
  }
}

/** "+05:30" style suffix of `zone` at `instant`, as used in startDate/endDate. */
export function offsetSuffix(zone: string, instant: Date | number): string {
  const minutes = offsetMs(zone, instant) / 60_000;
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
