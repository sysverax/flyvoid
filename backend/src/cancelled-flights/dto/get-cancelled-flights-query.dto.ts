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
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { FlightStatus } from "../entities/enums";

export class GetCancelledFlightsQueryDto extends PaginationQueryDto {
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
    description: "Filter by airline id (platform users only)",
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
}
