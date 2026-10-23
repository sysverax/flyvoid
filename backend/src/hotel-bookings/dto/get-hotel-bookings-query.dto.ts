import { Transform } from "class-transformer";
import { ApiPropertyOptional, IntersectionType } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from "class-validator";
import { TimestampRangeQueryDto } from "../../common/dto/date-range-query.dto";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const num = Number(value);
  return Number.isInteger(num) ? num : value;
};

// startDate/endDate filter the hotel booking's creation time (a timestamp
// column): ISO 8601 with timezone, start inclusive, end exclusive.
export class GetHotelBookingsQueryDto extends IntersectionType(
  PaginationQueryDto,
  TimestampRangeQueryDto,
) {
  @ApiPropertyOptional({
    description: "Filter by destination (arrival) airport id",
    example: 3,
  })
  @Transform(toOptionalInt)
  @IsInt({ message: "destinationAirportId must be an integer" })
  @Min(1, {
    message: "destinationAirportId must be greater than or equal to 1",
  })
  @IsOptional()
  destinationAirportId?: number;

  @ApiPropertyOptional({
    description: "Filter by cancelled flight id",
    example: 26,
  })
  @Transform(toOptionalInt)
  @IsInt({ message: "cancelledFlightId must be an integer" })
  @Min(1, { message: "cancelledFlightId must be greater than or equal to 1" })
  @IsOptional()
  cancelledFlightId?: number;

  @ApiPropertyOptional({
    description:
      "Search by hotel booking id, flight number, hotel name, or passenger email",
    example: "grand hotel",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: "Filter by airline id (platform users only)",
    example: 12,
  })
  @Transform(toOptionalInt)
  @IsInt({ message: "airlineId must be an integer" })
  @Min(1, { message: "airlineId must be greater than or equal to 1" })
  @IsOptional()
  airlineId?: number;
}

export class GetHotelBookingsSummaryQueryDto extends TimestampRangeQueryDto {
  @ApiPropertyOptional({
    description: "Filter by destination (arrival) airport id",
    example: 3,
  })
  @Transform(toOptionalInt)
  @IsInt({ message: "destinationAirportId must be an integer" })
  @Min(1, {
    message: "destinationAirportId must be greater than or equal to 1",
  })
  @IsOptional()
  destinationAirportId?: number;

  @ApiPropertyOptional({
    description: "Filter by cancelled flight id",
    example: 26,
  })
  @Transform(toOptionalInt)
  @IsInt({ message: "cancelledFlightId must be an integer" })
  @Min(1, { message: "cancelledFlightId must be greater than or equal to 1" })
  @IsOptional()
  cancelledFlightId?: number;

  @ApiPropertyOptional({
    description:
      "Search by hotel booking id, flight number, hotel name, or passenger email",
    example: "grand hotel",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: "Filter by airline id (platform users only)",
    example: 12,
  })
  @Transform(toOptionalInt)
  @IsInt({ message: "airlineId must be an integer" })
  @Min(1, { message: "airlineId must be greater than or equal to 1" })
  @IsOptional()
  airlineId?: number;
}
