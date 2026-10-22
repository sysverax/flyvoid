import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsDefined, IsEnum, IsNotEmpty, IsOptional } from "class-validator";
import {
  TIME_FRAME,
  TimeFrame,
} from "../constants/time-frame.constants";
import { IsIanaTimeZone } from "../validator/time-zone.validator";

// Shared input for every API that filters or groups by a time frame. See
// docs/guidelines/time-frame-apis.md - don't redefine these fields.

export const TIME_FRAME_DESCRIPTION =
  "Reporting window, computed in the calendar of `timezone`. Start inclusive, end exclusive. " +
  "today: 00:00 today -> 00:00 tomorrow (hourly buckets up to the current hour); " +
  "yesterday: 00:00 yesterday -> 00:00 today; " +
  "week: rolling 7 days including today; " +
  "month: last 12 months including the current month; " +
  "year: last 6 years including the current year.";

export const TIMEZONE_DESCRIPTION =
  'IANA timezone of the user, e.g. "Asia/Colombo" or "America/New_York". ' +
  'Raw offsets such as "+05:30" or "UTC+5:30" are rejected with 400.';

export const TIMEZONE_EXAMPLE = "Asia/Colombo";

const trimString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

/** `timeFrame`: trimmed, lowercased, one of TIME_FRAME. */
export function TimeFrameField({
  required,
}: {
  required: boolean;
}): PropertyDecorator {
  const docs = {
    description: TIME_FRAME_DESCRIPTION,
    enum: TIME_FRAME,
    example: TIME_FRAME.WEEK,
  };
  return applyDecorators(
    required ? ApiProperty(docs) : ApiPropertyOptional(docs),
    Transform(({ value }: { value: unknown }) =>
      typeof value === "string" ? value.trim().toLowerCase() : value,
    ),
    IsEnum(TIME_FRAME),
    required ? IsNotEmpty() : IsOptional(),
  );
}

/**
 * `timezone`: trimmed, must be a named IANA timezone. When `required`, a
 * missing value is a 400 (combine with @ValidateIf for conditional rules).
 * `description` overrides the Swagger text, e.g. to explain a condition.
 */
export function TimezoneField({
  required,
  description = TIMEZONE_DESCRIPTION,
}: {
  required: boolean;
  description?: string;
}): PropertyDecorator {
  const docs = { description, example: TIMEZONE_EXAMPLE };
  return applyDecorators(
    required ? ApiProperty(docs) : ApiPropertyOptional(docs),
    Transform(trimString),
    required
      ? IsDefined({ message: "timezone is required" })
      : IsOptional(),
    IsIanaTimeZone(),
  );
}

export class TimeFrameQueryDto {
  @TimeFrameField({ required: true })
  timeFrame!: TimeFrame;

  @TimezoneField({ required: true })
  timezone!: string;
}
