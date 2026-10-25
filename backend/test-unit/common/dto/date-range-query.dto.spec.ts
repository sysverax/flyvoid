import { describe, expect, it } from "@jest/globals";
import { IntersectionType } from "@nestjs/swagger";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PaginationQueryDto } from "../../../src/common/dto/pagination-query.dto";
import {
  CalendarDateRangeQueryDto,
  TimestampRangeQueryDto,
} from "../../../src/common/dto/date-range-query.dto";

// Mirrors the global ValidationPipe options in main.ts.
async function check<T extends object>(
  cls: new () => T,
  query: Record<string, unknown>,
): Promise<{ instance: T; errors: Record<string, string[]> }> {
  const instance = plainToInstance(cls, query);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });
  return {
    instance,
    errors: Object.fromEntries(
      errors.map((error) => [
        error.property,
        Object.values(error.constraints ?? {}),
      ]),
    ),
  };
}

const TIMESTAMP_MESSAGE =
  /must be an ISO 8601 timestamp with timezone, e\.g\. 2026-09-30T18:30:00\.000Z or 2026-10-01T00:00:00\+05:30/;

describe("TimestampRangeQueryDto (category A: timestamp columns)", () => {
  it.each([
    ["2026-09-30T18:30:00Z", "2026-09-30T18:30:00.000Z"],
    ["2026-09-30T18:30:00.000Z", "2026-09-30T18:30:00.000Z"],
    ["2026-10-01T00:00:00+05:30", "2026-09-30T18:30:00.000Z"],
    ["2026-10-01T00:00:00-04:00", "2026-10-01T04:00:00.000Z"],
    ["2026-10-01T00:00:00+05:45", "2026-09-30T18:15:00.000Z"],
    [" 2026-10-01T00:00:00+05:30 ", "2026-09-30T18:30:00.000Z"],
  ])("accepts %j as the UTC instant %s", async (value, utc) => {
    const { instance, errors } = await check(TimestampRangeQueryDto, {
      startDate: value,
    });
    expect(errors).toEqual({});
    expect(instance.startDate).toBeInstanceOf(Date);
    expect(instance.startDate?.toISOString()).toBe(utc);
  });

  it.each([
    "2026-10-01", // date only
    "2026-10-01T00:00:00", // no timezone
    "2026-10-01T00:00", // no seconds, no timezone
    "2026-13-01T00:00:00Z", // invalid month
    "2026-02-30T00:00:00Z", // invalid day
    "2026-10-01T24:00:00Z", // invalid hour
    "2026-10-01T00:00:00+25:00", // invalid offset
    "2026-10-01 00:00:00Z", // space instead of T
    "abc",
    "",
  ])("rejects %j", async (value) => {
    const { errors } = await check(TimestampRangeQueryDto, { endDate: value });
    expect(errors.endDate?.[0]).toMatch(TIMESTAMP_MESSAGE);
  });

  it("rejects endDate equal to startDate (end is exclusive)", async () => {
    const { errors } = await check(TimestampRangeQueryDto, {
      startDate: "2026-09-30T18:30:00.000Z",
      endDate: "2026-10-01T00:00:00+05:30", // the same instant
    });
    expect(errors).toEqual({ endDate: ["endDate must be after startDate"] });
  });

  it("rejects endDate before startDate", async () => {
    const { errors } = await check(TimestampRangeQueryDto, {
      startDate: "2026-10-02T00:00:00Z",
      endDate: "2026-10-01T00:00:00Z",
    });
    expect(errors).toEqual({ endDate: ["endDate must be after startDate"] });
  });

  it("compares the converted instants, not the strings", async () => {
    // As strings "…+05:30" > "…Z", but as instants the end is earlier.
    const { errors } = await check(TimestampRangeQueryDto, {
      startDate: "2026-10-01T00:00:00Z",
      endDate: "2026-10-01T03:00:00+05:30", // 2026-09-30T21:30:00Z
    });
    expect(errors).toEqual({ endDate: ["endDate must be after startDate"] });
  });

  it("accepts a valid range, only startDate, only endDate, or neither", async () => {
    for (const query of [
      { startDate: "2026-09-30T18:30:00Z", endDate: "2026-10-01T18:30:00Z" },
      { startDate: "2026-09-30T18:30:00Z" },
      { endDate: "2026-10-01T18:30:00Z" },
      {},
    ]) {
      expect((await check(TimestampRangeQueryDto, query)).errors).toEqual({});
    }
  });

  it("reports the format error, not a range error, when startDate is invalid", async () => {
    const { errors } = await check(TimestampRangeQueryDto, {
      startDate: "2026-10-01",
      endDate: "2026-10-02T00:00:00Z",
    });
    expect(Object.keys(errors)).toEqual(["startDate"]);
  });

  it("keeps the rules when composed with pagination", async () => {
    class Query extends IntersectionType(PaginationQueryDto, TimestampRangeQueryDto) {}
    expect(
      (await check(Query, { page: "2", startDate: "2026-10-01" })).errors.startDate?.[0],
    ).toMatch(TIMESTAMP_MESSAGE);
    const { instance, errors } = await check(Query, {
      page: "2",
      startDate: "2026-10-01T00:00:00+05:30",
    });
    expect(errors).toEqual({});
    expect(instance.startDate?.toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });
});

describe("CalendarDateRangeQueryDto (category B: DATE columns)", () => {
  it.each(["2026-09-01", "2024-02-29", " 2026-12-31 "])(
    "accepts %j and keeps it as a YYYY-MM-DD string",
    async (value) => {
      const { instance, errors } = await check(CalendarDateRangeQueryDto, {
        startDate: value,
      });
      expect(errors).toEqual({});
      expect(instance.startDate).toBe(value.trim());
    },
  );

  it.each([
    "2026-09-30T18:30:00.000Z", // timestamp
    "2026-10-01T00:00:00+05:30", // timestamp with offset
    "2026-13-01",
    "2026-02-30",
    "2025-02-29", // not a leap year
    "2026-9-1",
    "abc",
    "",
  ])("rejects %j", async (value) => {
    const { errors } = await check(CalendarDateRangeQueryDto, { startDate: value });
    expect(errors.startDate?.[0]).toBe(
      "startDate must be a calendar date in YYYY-MM-DD format, e.g. 2026-09-01",
    );
  });

  it("accepts equal start and end dates (both inclusive)", async () => {
    expect(
      (await check(CalendarDateRangeQueryDto, {
        startDate: "2026-10-01",
        endDate: "2026-10-01",
      })).errors,
    ).toEqual({});
  });

  it("rejects endDate before startDate", async () => {
    const { errors } = await check(CalendarDateRangeQueryDto, {
      startDate: "2026-10-02",
      endDate: "2026-10-01",
    });
    expect(errors).toEqual({ endDate: ["endDate must be on or after startDate"] });
  });

  it("accepts only startDate, only endDate, or neither", async () => {
    for (const query of [{ startDate: "2026-10-01" }, { endDate: "2026-10-01" }, {}]) {
      expect((await check(CalendarDateRangeQueryDto, query)).errors).toEqual({});
    }
  });
});
