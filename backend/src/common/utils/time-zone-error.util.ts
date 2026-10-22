import { BadRequestException } from "@nestjs/common";
import { QueryFailedError } from "typeorm";

// Postgres SQLSTATE 22023 is the generic "invalid parameter value"; only its
// unknown-timezone flavour (`time zone "X" not recognized`) is mapped.
const INVALID_PARAMETER_VALUE = "22023";

/**
 * Node's Intl validates request timezones, but Postgres applies them in
 * AT TIME ZONE and may not know every name. Turns that query failure into a
 * 400 "Unsupported timezone"; returns null for every other error so it keeps
 * its normal handling. Applied to every repository by the global
 * DatabaseExceptionFilter (common/filters/database-exception.filter.ts).
 */
export function toUnsupportedTimeZoneException(
  exception: unknown,
): BadRequestException | null {
  if (!(exception instanceof QueryFailedError)) {
    return null;
  }

  const driverError = exception.driverError as
    | { code?: unknown; message?: unknown }
    | undefined;
  const code = driverError?.code ?? (exception as { code?: unknown }).code;
  const message =
    typeof driverError?.message === "string"
      ? driverError.message
      : exception.message;

  if (code !== INVALID_PARAMETER_VALUE || !/time zone/i.test(message)) {
    return null;
  }

  return new BadRequestException({
    message: "Unsupported timezone",
    detail: "The database does not recognise the timezone sent in the request.",
    solution: 'Send a standard IANA timezone name, e.g. "Asia/Colombo" or "UTC".',
    code: "UNSUPPORTED_TIMEZONE",
  });
}
