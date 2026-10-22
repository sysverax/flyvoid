import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { FlightStatus } from "../entities/enums";
import { TimeFrame } from "../../common/constants/time-frame.constants";
import { CalendarDateRangeQueryDto } from "../../common/dto/date-range-query.dto";
import {
  TIMEZONE_DESCRIPTION,
  TimeFrameField,
  TimezoneField,
} from "../../common/dto/time-frame-query.dto";

// Same filters as GetCancelledFlightsQueryDto, minus pagination - a summary
// is a single aggregate row, not a page of results. startDate/endDate filter
// cancellation_date (a DATE column): YYYY-MM-DD, both inclusive.
export class GetCancelledFlightsSummaryQueryDto extends CalendarDateRangeQueryDto {
  @ApiPropertyOptional({
    description: "Filter by cancelled flight status",
    enum: FlightStatus,
    example: FlightStatus.IN_PROGRESS,
  })
  @IsEnum(FlightStatus)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsOptional()
  status?: FlightStatus;

  @ApiPropertyOptional({
    description: "Search by cancelled flight flight number",
    example: "1024",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(50)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description:
      "Filter by airline id (platform users only; ignored for airline users, who are always scoped to their own airline)",
    example: 12,
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    const num = Number(value);
    return Number.isInteger(num) ? num : value;
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  airlineId?: number;

  // Cannot be combined with startDate/endDate (checked in the service).
  @TimeFrameField({ required: false })
  timeFrame?: TimeFrame;

  // Required with timeFrame. Without timeFrame it is ignored and not
  // validated, so the frontend can always send it.
  @ValidateIf((query: GetCancelledFlightsSummaryQueryDto) => query.timeFrame !== undefined)
  @TimezoneField({
    required: true,
    description: `${TIMEZONE_DESCRIPTION} Required when timeFrame is sent; ignored otherwise.`,
  })
  timezone?: string;
}
