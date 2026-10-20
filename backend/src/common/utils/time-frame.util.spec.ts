import { describe, expect, it } from "@jest/globals";
import {
  TIME_FRAME,
  TREND_GRANULARITY,
} from "../constants/time-frame.constants";
import {
  buildTrendWindow,
  fillTrendBuckets,
  formatInTimeZone,
  getTimeZoneOffsetMinutes,
  localDateTimeToUtc,
  resolveTimeFrameRange,
  resolveTimeZone,
  toBucketLabel,
  toLocalDateTime,
} from "./time-frame.util";

const COLOMBO = "Asia/Colombo"; // UTC+05:30, no DST
const NEW_YORK = "America/New_York"; // UTC-05:00 / -04:00 with DST

describe("time-frame.util", () => {
  describe("resolveTimeZone", () => {
    it("keeps a valid IANA timezone", () => {
      expect(resolveTimeZone(COLOMBO)).toBe(COLOMBO);
    });

    it("falls back to UTC for empty, missing or unknown timezones", () => {
      expect(resolveTimeZone("")).toBe("UTC");
      expect(resolveTimeZone("   ")).toBe("UTC");
      expect(resolveTimeZone(null)).toBe("UTC");
      expect(resolveTimeZone(undefined)).toBe("UTC");
      expect(resolveTimeZone("Mars/Olympus_Mons")).toBe("UTC");
    });
  });

  describe("timezone conversion", () => {
    it("reads wall-clock fields on the next local day when UTC is still on the previous day", () => {
      const instant = new Date("2026-10-21T20:00:00Z");
      expect(toLocalDateTime(instant, COLOMBO)).toEqual({
        year: 2026,
        month: 10,
        day: 22,
        hour: 1,
        minute: 30,
        second: 0,
      });
    });

    it("computes offsets, including DST", () => {
      expect(
        getTimeZoneOffsetMinutes(new Date("2026-10-21T00:00:00Z"), COLOMBO),
      ).toBe(330);
      expect(
        getTimeZoneOffsetMinutes(new Date("2026-07-01T12:00:00Z"), NEW_YORK),
      ).toBe(-240);
      expect(
        getTimeZoneOffsetMinutes(new Date("2026-01-01T12:00:00Z"), NEW_YORK),
      ).toBe(-300);
    });

    it("converts local midnight to the UTC instant on the previous UTC day", () => {
      const utc = localDateTimeToUtc(
        { year: 2026, month: 10, day: 22, hour: 0, minute: 0, second: 0 },
        COLOMBO,
      );
      expect(utc.toISOString()).toBe("2026-10-21T18:30:00.000Z");
    });

    it("formats an instant with its local offset", () => {
      const instant = new Date("2026-10-21T18:29:59Z");
      expect(formatInTimeZone(instant, COLOMBO)).toBe(
        "2026-10-21T23:59:59+05:30",
      );
      expect(formatInTimeZone(instant, NEW_YORK)).toBe(
        "2026-10-21T14:29:59-04:00",
      );
      expect(formatInTimeZone(instant, "UTC")).toBe(
        "2026-10-21T18:29:59+00:00",
      );
    });
  });

  describe("buildTrendWindow", () => {
    it("today: hourly buckets up to the current local hour, on the local date", () => {
      // 20:00 UTC on the 21st is 01:30 on the 22nd in Colombo.
      const window = buildTrendWindow(
        TIME_FRAME.TODAY,
        COLOMBO,
        new Date("2026-10-21T20:00:00Z"),
      );

      expect(window.granularity).toBe(TREND_GRANULARITY.HOUR);
      expect(window.timeZone).toBe(COLOMBO);
      expect(window.buckets).toEqual(["2026-10-22T00:00", "2026-10-22T01:00"]);
      expect(window.startUtc.toISOString()).toBe("2026-10-21T18:30:00.000Z");
      expect(window.endUtc.toISOString()).toBe("2026-10-22T18:30:00.000Z");
    });

    it("today: west of UTC the local date is behind the UTC date", () => {
      // 03:00 UTC on the 22nd is 23:00 on the 21st in New York (EDT).
      const window = buildTrendWindow(
        TIME_FRAME.TODAY,
        NEW_YORK,
        new Date("2026-10-22T03:00:00Z"),
      );

      expect(window.buckets).toHaveLength(24);
      expect(window.buckets[0]).toBe("2026-10-21T00:00");
      expect(window.buckets[23]).toBe("2026-10-21T23:00");
      expect(window.startUtc.toISOString()).toBe("2026-10-21T04:00:00.000Z");
    });

    it("today: just after local midnight has a single bucket", () => {
      const window = buildTrendWindow(
        TIME_FRAME.TODAY,
        COLOMBO,
        new Date("2026-10-21T18:45:00Z"),
      );
      expect(window.buckets).toEqual(["2026-10-22T00:00"]);
    });

    it("yesterday: all 24 hours of the previous local day", () => {
      const window = buildTrendWindow(
        TIME_FRAME.YESTERDAY,
        COLOMBO,
        new Date("2026-10-21T20:00:00Z"),
      );

      expect(window.granularity).toBe(TREND_GRANULARITY.HOUR);
      expect(window.buckets).toHaveLength(24);
      expect(window.buckets[0]).toBe("2026-10-21T00:00");
      expect(window.buckets[23]).toBe("2026-10-21T23:00");
      expect(window.startUtc.toISOString()).toBe("2026-10-20T18:30:00.000Z");
      expect(window.endUtc.toISOString()).toBe("2026-10-21T18:30:00.000Z");
    });

    it("yesterday: a DST fall-back day still has 24 labels but spans 25 hours", () => {
      // New York leaves DST on 2026-11-01.
      const window = buildTrendWindow(
        TIME_FRAME.YESTERDAY,
        NEW_YORK,
        new Date("2026-11-02T15:00:00Z"),
      );

      expect(window.buckets).toHaveLength(24);
      expect(window.buckets[0]).toBe("2026-11-01T00:00");
      expect(window.startUtc.toISOString()).toBe("2026-11-01T04:00:00.000Z");
      expect(window.endUtc.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    });

    it("week: the last 7 local days including today, across a month boundary", () => {
      const window = buildTrendWindow(
        TIME_FRAME.WEEK,
        COLOMBO,
        new Date("2026-10-02T20:00:00Z"), // 3 Oct, 01:30 local
      );

      expect(window.granularity).toBe(TREND_GRANULARITY.DAY);
      expect(window.buckets).toEqual([
        "2026-09-27",
        "2026-09-28",
        "2026-09-29",
        "2026-09-30",
        "2026-10-01",
        "2026-10-02",
        "2026-10-03",
      ]);
      expect(window.startUtc.toISOString()).toBe("2026-09-26T18:30:00.000Z");
      expect(window.endUtc.toISOString()).toBe("2026-10-03T18:30:00.000Z");
    });

    it("month: the last 12 calendar months including the current one, across a year boundary", () => {
      const window = buildTrendWindow(
        TIME_FRAME.MONTH,
        COLOMBO,
        new Date("2026-02-10T10:00:00Z"),
      );

      expect(window.granularity).toBe(TREND_GRANULARITY.MONTH);
      expect(window.buckets).toHaveLength(12);
      expect(window.buckets[0]).toBe("2025-03");
      expect(window.buckets[11]).toBe("2026-02");
      expect(window.startUtc.toISOString()).toBe("2025-02-28T18:30:00.000Z");
      expect(window.endUtc.toISOString()).toBe("2026-02-28T18:30:00.000Z");
    });

    it("month: uses the local month when UTC is still in the previous month", () => {
      // 31 Oct 20:00 UTC is already 1 Nov in Colombo.
      const window = buildTrendWindow(
        TIME_FRAME.MONTH,
        COLOMBO,
        new Date("2026-10-31T20:00:00Z"),
      );
      expect(window.buckets[11]).toBe("2026-11");
      expect(window.buckets[0]).toBe("2025-12");
    });

    it("year: the last 6 years including the current one", () => {
      const window = buildTrendWindow(
        TIME_FRAME.YEAR,
        COLOMBO,
        new Date("2026-10-21T10:00:00Z"),
      );

      expect(window.granularity).toBe(TREND_GRANULARITY.YEAR);
      expect(window.buckets).toEqual([
        "2021",
        "2022",
        "2023",
        "2024",
        "2025",
        "2026",
      ]);
      expect(window.startUtc.toISOString()).toBe("2020-12-31T18:30:00.000Z");
      expect(window.endUtc.toISOString()).toBe("2026-12-31T18:30:00.000Z");
    });

    it("falls back to UTC for an unknown timezone", () => {
      const window = buildTrendWindow(
        TIME_FRAME.TODAY,
        "Not/AZone",
        new Date("2026-10-21T05:10:00Z"),
      );

      expect(window.timeZone).toBe("UTC");
      expect(window.buckets).toHaveLength(6);
      expect(window.startUtc.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    });
  });

  describe("resolveTimeFrameRange", () => {
    const now = new Date("2026-10-21T20:00:00Z"); // 22 Oct, 01:30 in Colombo

    it.each([
      [TIME_FRAME.TODAY, "2026-10-21T18:30:00.000Z", "2026-10-22T18:30:00.000Z"],
      [TIME_FRAME.YESTERDAY, "2026-10-20T18:30:00.000Z", "2026-10-21T18:30:00.000Z"],
      [TIME_FRAME.WEEK, "2026-10-15T18:30:00.000Z", "2026-10-22T18:30:00.000Z"],
      [TIME_FRAME.MONTH, "2025-10-31T18:30:00.000Z", "2026-10-31T18:30:00.000Z"],
      [TIME_FRAME.YEAR, "2020-12-31T18:30:00.000Z", "2026-12-31T18:30:00.000Z"],
    ])("%s uses the airline's local calendar", (timeFrame, start, end) => {
      const range = resolveTimeFrameRange(timeFrame, COLOMBO, now);
      expect(range.timeZone).toBe(COLOMBO);
      expect(range.startUtc.toISOString()).toBe(start);
      expect(range.endUtc.toISOString()).toBe(end);
    });

    it("uses UTC when no timezone is given (platform users)", () => {
      const range = resolveTimeFrameRange(TIME_FRAME.TODAY, undefined, now);
      expect(range.timeZone).toBe("UTC");
      expect(range.startUtc.toISOString()).toBe("2026-10-21T00:00:00.000Z");
      expect(range.endUtc.toISOString()).toBe("2026-10-22T00:00:00.000Z");
    });

    it("matches the trend window for every time frame", () => {
      for (const timeFrame of Object.values(TIME_FRAME)) {
        const range = resolveTimeFrameRange(timeFrame, COLOMBO, now);
        const window = buildTrendWindow(timeFrame, COLOMBO, now);
        expect(window.startUtc).toEqual(range.startUtc);
        expect(window.endUtc).toEqual(range.endUtc);
      }
    });
  });

  describe("toBucketLabel", () => {
    it("labels day buckets with the weekday name", () => {
      expect(toBucketLabel("2026-10-19", TREND_GRANULARITY.DAY)).toBe("Monday");
      expect(toBucketLabel("2026-10-21", TREND_GRANULARITY.DAY)).toBe(
        "Wednesday",
      );
      expect(toBucketLabel("2026-10-25", TREND_GRANULARITY.DAY)).toBe("Sunday");
    });

    it("labels month buckets with the month name", () => {
      expect(toBucketLabel("2026-01", TREND_GRANULARITY.MONTH)).toBe("January");
      expect(toBucketLabel("2025-12", TREND_GRANULARITY.MONTH)).toBe(
        "December",
      );
    });

    it("labels hour and year buckets", () => {
      expect(toBucketLabel("2026-10-21T14:00", TREND_GRANULARITY.HOUR)).toBe(
        "14:00",
      );
      expect(toBucketLabel("2026", TREND_GRANULARITY.YEAR)).toBe("2026");
    });

    it("labels a week window with seven consecutive weekday names ending today", () => {
      // 21 Oct 2026 is a Wednesday in Colombo.
      const window = buildTrendWindow(
        TIME_FRAME.WEEK,
        COLOMBO,
        new Date("2026-10-21T10:00:00Z"),
      );
      expect(
        window.buckets.map((bucket) =>
          toBucketLabel(bucket, window.granularity),
        ),
      ).toEqual([
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
      ]);
    });

    it("labels a month window with twelve month names ending this month", () => {
      const window = buildTrendWindow(
        TIME_FRAME.MONTH,
        COLOMBO,
        new Date("2026-10-21T10:00:00Z"),
      );
      const labels = window.buckets.map((bucket) =>
        toBucketLabel(bucket, window.granularity),
      );
      expect(labels[0]).toBe("November");
      expect(labels[11]).toBe("October");
      expect(new Set(labels).size).toBe(12);
    });
  });

  describe("fillTrendBuckets", () => {
    it("keeps bucket order, adds labels and fills missing buckets with 0", () => {
      expect(
        fillTrendBuckets(
          ["2026-10-19", "2026-10-20", "2026-10-21"],
          new Map([["2026-10-20", 12.5]]),
          TREND_GRANULARITY.DAY,
        ),
      ).toEqual([
        { bucket: "2026-10-19", label: "Monday", value: 0 },
        { bucket: "2026-10-20", label: "Tuesday", value: 12.5 },
        { bucket: "2026-10-21", label: "Wednesday", value: 0 },
      ]);
    });

    it("ignores values outside the bucket list", () => {
      expect(
        fillTrendBuckets(
          ["2026"],
          new Map([["2019", 4]]),
          TREND_GRANULARITY.YEAR,
        ),
      ).toEqual([{ bucket: "2026", label: "2026", value: 0 }]);
    });
  });
});
