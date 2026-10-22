import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDefined,
  IsOptional,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";
import {
  isCalendarDate,
  isValidRangeEnd,
  parseTimestampWithTimezone,
} from "../utils/date-range.util";

// Shared startDate/endDate input. The column type decides the format - see
// docs/guidelines/time-frame-apis.md ("Custom date range filters"):
// - timestamp columns: TimestampRangeQueryDto (end exclusive)
// - DATE columns: CalendarDateRangeQueryDto (both inclusive)

export const TIMESTAMP_START_DESCRIPTION =
  "Start of the range (inclusive). ISO 8601 timestamp with timezone, e.g. " +
  "2026-09-30T18:30:00.000Z or 2026-10-01T00:00:00+05:30. Values without " +
  "timezone (e.g. 2026-10-01) return 400.";

export const TIMESTAMP_END_DESCRIPTION =
  "End of the range (exclusive): the start of the day after the last " +
  "selected day, e.g. 2026-10-01T18:30:00.000Z. Must be after startDate.";

export const CALENDAR_DATE_DESCRIPTION =
  "Calendar date YYYY-MM-DD (inclusive). Not timezone-dependent.";

const TIMESTAMP_EXAMPLE = "2026-09-30T18:30:00.000Z";
const CALENDAR_DATE_EXAMPLE = "2026-09-01";

const trimString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

function presence(required: boolean): PropertyDecorator {
  return required ? IsDefined({ message: "$property is required" }) : IsOptional();
}

/**
 * An exact moment for a timestamp column. Accepts ISO 8601 with "Z" or a
 * ±HH:MM offset and transforms it to a UTC Date; anything without timezone
 * info is a 400.
 */
export function TimestampWithTimezoneField({
  required,
  description = TIMESTAMP_START_DESCRIPTION,
  example = TIMESTAMP_EXAMPLE,
}: {
  required: boolean;
  description?: string;
  example?: string;
}): PropertyDecorator {
  const docs = { type: String, format: "date-time", description, example };
  return applyDecorators(
    required ? ApiProperty(docs) : ApiPropertyOptional(docs),
    // Leave unparseable input as is, so the validator reports it.
    Transform(({ value }: { value: unknown }) => {
      const trimmed = trimString({ value });
      return typeof trimmed === "string"
        ? (parseTimestampWithTimezone(trimmed) ?? trimmed)
        : trimmed;
    }),
    presence(required),
    registerProperty("isTimestampWithTimezone", {
      validate: (value) => value instanceof Date,
      message: (args) =>
        `${args.property} must be an ISO 8601 timestamp with timezone, e.g. 2026-09-30T18:30:00.000Z or 2026-10-01T00:00:00+05:30`,
    }),
  );
}

/** A calendar date for a DATE column: strict YYYY-MM-DD, kept as a string. */
export function CalendarDateField({
  required,
  description = CALENDAR_DATE_DESCRIPTION,
}: {
  required: boolean;
  description?: string;
}): PropertyDecorator {
  const docs = {
    type: String,
    format: "date",
    description,
    example: CALENDAR_DATE_EXAMPLE,
  };
  return applyDecorators(
    required ? ApiProperty(docs) : ApiPropertyOptional(docs),
    Transform(trimString),
    presence(required),
    registerProperty("isCalendarDate", {
      validate: (value) => typeof value === "string" && isCalendarDate(value),
      message: (args) =>
        `${args.property} must be a calendar date in YYYY-MM-DD format, e.g. ${CALENDAR_DATE_EXAMPLE}`,
    }),
  );
}

/**
 * Range rule on the end field, run on the transformed values: strictly
 * after `startField` (timestamps, exclusive end) or on or after it when
 * `allowEqual` (calendar dates). Skipped when either bound is missing, so
 * open-ended ranges keep working.
 */
export function IsDateRangeEnd({
  startField = "startDate",
  allowEqual,
}: {
  startField?: string;
  allowEqual: boolean;
}): PropertyDecorator {
  return registerProperty("isDateRangeEnd", {
    validate: (value, args) => {
      const start = (args.object as Record<string, unknown>)[startField];
      if (value === undefined || value === null || start === undefined || start === null) {
        return true;
      }
      return isValidRangeEnd(start, value, allowEqual);
    },
    message: (args) =>
      `${args.property} must be ${allowEqual ? "on or after" : "after"} ${startField}`,
  });
}

function registerProperty(
  name: string,
  {
    validate,
    message,
    options,
  }: {
    validate: (value: unknown, args: ValidationArguments) => boolean;
    message: (args: ValidationArguments) => string;
    options?: ValidationOptions;
  },
): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name,
      target: target.constructor,
      propertyName: propertyName.toString(),
      options,
      validator: { validate, defaultMessage: message },
    });
  };
}

/** startDate/endDate for a timestamp column: start inclusive, end exclusive. */
export class TimestampRangeQueryDto {
  @TimestampWithTimezoneField({
    required: false,
    description: TIMESTAMP_START_DESCRIPTION,
  })
  startDate?: Date;

  @TimestampWithTimezoneField({
    required: false,
    description: TIMESTAMP_END_DESCRIPTION,
    example: "2026-10-01T18:30:00.000Z",
  })
  @IsDateRangeEnd({ allowEqual: false })
  endDate?: Date;
}

/** startDate/endDate for a DATE column: both inclusive, no timezone. */
export class CalendarDateRangeQueryDto {
  @CalendarDateField({ required: false })
  startDate?: string;

  @CalendarDateField({ required: false })
  @IsDateRangeEnd({ allowEqual: true })
  endDate?: string;
}
