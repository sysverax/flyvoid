import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const num = Number(value);
  return Number.isInteger(num) ? num : value;
};

export class GetHotelBookingsQueryDto extends PaginationQueryDto {
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

  @ApiPropertyOptional({
    description:
      "Filter hotel bookings with a check-in date on or after this date",
    example: "2026-09-01",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsDateString(
    {},
    { message: "startDate must be a valid ISO 8601 date string" },
  )
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "Filter hotel bookings with a check-in date on or before this date",
    example: "2026-09-30",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsDateString({}, { message: "endDate must be a valid ISO 8601 date string" })
  @IsOptional()
  endDate?: string;
}
