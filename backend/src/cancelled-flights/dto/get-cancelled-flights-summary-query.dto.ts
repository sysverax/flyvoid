import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { FlightStatus } from "../entities/enums";
import {
  TIME_FRAME,
  TimeFrame,
} from "../../common/constants/time-frame.constants";

// Same filters as GetCancelledFlightsQueryDto, minus pagination - a summary
// is a single aggregate row, not a page of results.
export class GetCancelledFlightsSummaryQueryDto {
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

  @ApiPropertyOptional({
    description: "Filter flights with cancellation date on or after this date",
    example: "2026-09-01",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Filter flights with cancellation date on or before this date",
    example: "2026-09-30",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      "Relative reporting window in the airline's timezone (UTC for platform users). Cannot be combined with startDate/endDate.",
    enum: TIME_FRAME,
    example: TIME_FRAME.MONTH,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEnum(TIME_FRAME)
  @IsOptional()
  timeFrame?: TimeFrame;
}
