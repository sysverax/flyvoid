import { describe, expect, it } from "@jest/globals";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { GetCancelledFlightsSummaryQueryDto } from "../../../src/cancelled-flights/dto/get-cancelled-flights-summary-query.dto";
import { GetAirlineTrendQueryDto } from "../../../src/dashboard/dto/get-airline-trend-query.dto";
import { TimeFrameQueryDto } from "../../../src/common/dto/time-frame-query.dto";

// Mirrors the global ValidationPipe options in main.ts.
async function errorsFor<T extends object>(
  cls: new () => T,
  query: Record<string, unknown>,
): Promise<Record<string, string[]>> {
  const instance = plainToInstance(cls, query);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });
  return Object.fromEntries(
    errors.map((error) => [
      error.property,
      Object.values(error.constraints ?? {}),
    ]),
  );
}

describe("TimeFrameQueryDto", () => {
  it.each([TimeFrameQueryDto, GetAirlineTrendQueryDto])(
    "%p accepts a time frame with an IANA timezone",
    async (cls) => {
      expect(
        await errorsFor(cls, { timeFrame: "WEEK ", timezone: " Asia/Colombo " }),
      ).toEqual({});
    },
  );

  it("trims the timezone and lowercases the time frame", () => {
    const query = plainToInstance(TimeFrameQueryDto, {
      timeFrame: " Month",
      timezone: " America/New_York ",
    });
    expect(query).toMatchObject({
      timeFrame: "month",
      timezone: "America/New_York",
    });
  });

  it("requires timezone", async () => {
    expect(await errorsFor(TimeFrameQueryDto, { timeFrame: "week" })).toEqual({
      timezone: ["timezone is required"],
    });
  });

  it.each(["", "   ", "+05:30", "UTC+5:30", "Invalid/Zone"])(
    "rejects timezone %j",
    async (timezone) => {
      const errors = await errorsFor(TimeFrameQueryDto, {
        timeFrame: "week",
        timezone,
      });
      expect(errors.timezone?.[0]).toMatch(/valid IANA timezone/);
    },
  );

  it("requires a valid timeFrame", async () => {
    expect(
      Object.keys(await errorsFor(TimeFrameQueryDto, { timezone: "UTC" })),
    ).toEqual(["timeFrame"]);
    expect(
      Object.keys(
        await errorsFor(TimeFrameQueryDto, {
          timeFrame: "decade",
          timezone: "UTC",
        }),
      ),
    ).toEqual(["timeFrame"]);
  });
});

describe("GetCancelledFlightsSummaryQueryDto timezone rule", () => {
  it("allows a missing timezone when timeFrame is not sent", async () => {
    expect(await errorsFor(GetCancelledFlightsSummaryQueryDto, {})).toEqual({});
  });

  it("ignores (does not validate) timezone when timeFrame is not sent", async () => {
    expect(
      await errorsFor(GetCancelledFlightsSummaryQueryDto, { timezone: "+05:30" }),
    ).toEqual({});
  });

  it("requires timezone when timeFrame is sent", async () => {
    expect(
      await errorsFor(GetCancelledFlightsSummaryQueryDto, { timeFrame: "week" }),
    ).toEqual({ timezone: ["timezone is required"] });
  });

  it.each(["", "+05:30", "UTC+5:30", "Invalid/Zone"])(
    "rejects timezone %j when timeFrame is sent",
    async (timezone) => {
      const errors = await errorsFor(GetCancelledFlightsSummaryQueryDto, {
        timeFrame: "week",
        timezone,
      });
      expect(errors.timezone?.[0]).toMatch(/valid IANA timezone/);
    },
  );

  it("accepts timeFrame with a valid timezone", async () => {
    expect(
      await errorsFor(GetCancelledFlightsSummaryQueryDto, {
        timeFrame: "today",
        timezone: "Asia/Kathmandu",
      }),
    ).toEqual({});
  });
});
