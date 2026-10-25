import { describe, expect, it, jest } from "@jest/globals";
import {
  ArgumentsHost,
  BadRequestException,
  HttpServer,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { QueryFailedError } from "typeorm";
import { DatabaseExceptionFilter } from "../../../src/common/filters/database-exception.filter";
import { toUnsupportedTimeZoneException } from "../../../src/common/utils/time-zone-error.util";

function queryFailed(code: string, message: string): QueryFailedError {
  const driverError = Object.assign(new Error(message), { code });
  return new QueryFailedError("SELECT 1", [], driverError);
}

const UNKNOWN_TIME_ZONE = queryFailed(
  "22023",
  'time zone "Mars/Olympus_Mons" not recognized',
);
// Same SQLSTATE, unrelated cause: must keep the normal (500) handling.
const OTHER_INVALID_PARAMETER = queryFailed(
  "22023",
  'invalid value for parameter "lock_timeout": "abc"',
);

describe("toUnsupportedTimeZoneException", () => {
  it("maps a Postgres unknown-timezone error to 400 Unsupported timezone", () => {
    const mapped = toUnsupportedTimeZoneException(UNKNOWN_TIME_ZONE);
    expect(mapped).toBeInstanceOf(BadRequestException);
    expect(mapped?.getResponse()).toMatchObject({
      message: "Unsupported timezone",
      code: "UNSUPPORTED_TIMEZONE",
    });
  });

  it("leaves other 22023 errors alone", () => {
    expect(toUnsupportedTimeZoneException(OTHER_INVALID_PARAMETER)).toBeNull();
  });

  it("leaves 'time zone' messages with another SQLSTATE alone", () => {
    expect(
      toUnsupportedTimeZoneException(
        queryFailed("42883", "function time zone(unknown) does not exist"),
      ),
    ).toBeNull();
  });

  it("ignores non-database errors", () => {
    expect(
      toUnsupportedTimeZoneException(new Error('time zone "X" not recognized')),
    ).toBeNull();
  });
});

describe("DatabaseExceptionFilter with 22023 errors", () => {
  function run(exception: QueryFailedError): { status: number; body: unknown } {
    const result = { status: 0, body: undefined as unknown };
    const response = {};
    const httpAdapter = {
      isHeadersSent: () => false,
      reply: (_res: unknown, body: unknown, status: number) => {
        result.status = status;
        result.body = body;
      },
      end: jest.fn(),
    } as unknown as HttpServer;
    const host = {
      getArgByIndex: (index: number) => (index === 1 ? response : {}),
      getArgs: () => [{}, response],
      getType: () => "http",
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    new DatabaseExceptionFilter(httpAdapter).catch(exception, host);
    return result;
  }

  it("responds 400 Unsupported timezone for an unknown timezone", () => {
    const { status, body } = run(UNKNOWN_TIME_ZONE);
    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body).toMatchObject({ message: "Unsupported timezone" });
  });

  it("keeps Nest's default 500 for any other 22023 error", () => {
    // The default handler logs unknown errors; keep the test output clean.
    const logError = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const staticLogError = jest
      .spyOn(Logger, "error")
      .mockImplementation(() => undefined);

    const { status, body } = run(OTHER_INVALID_PARAMETER);
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body).toEqual({
      statusCode: 500,
      message: "Internal server error",
    });

    logError.mockRestore();
    staticLogError.mockRestore();
  });
});
