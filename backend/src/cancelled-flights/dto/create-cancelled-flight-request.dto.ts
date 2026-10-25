import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { CalendarDateField } from "../../common/dto/date-range-query.dto";
import { CancellationReason } from "../entities/enums";

export class CreateCancelledFlightDto {
  @ApiProperty({ example: "SW1234" })
  @IsNotEmpty()
  @IsString()
  flightNumber!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  departureAirportId!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  arrivalAirportId!: number;

  // Calendar dates (YYYY-MM-DD), never converted between timezones; the stay
  // rules are in cancelled-flights/stay-dates.ts.
  @CalendarDateField({
    required: true,
    description: "Date the flight was cancelled, YYYY-MM-DD",
  })
  cancellationDate!: string;

  @CalendarDateField({
    required: true,
    description:
      "Hotel check-in, YYYY-MM-DD: today or later at the departure airport, on or after the cancellation date, at most STAY_MAX_CHECK_IN_DAYS_AHEAD days ahead",
  })
  checkInDate!: string;

  @CalendarDateField({
    required: true,
    description:
      "Hotel check-out, YYYY-MM-DD: after check-in (exclusive), at most STAY_MAX_NIGHTS nights",
  })
  checkOutDate!: string;

  @ApiPropertyOptional({ enum: CancellationReason })
  @IsOptional()
  @IsEnum(CancellationReason)
  cancellationReason?: CancellationReason;

  @ApiPropertyOptional({ example: "Severe weather conditions at departure" })
  @IsOptional()
  @IsString()
  cancellationReasonText?: string;
}
