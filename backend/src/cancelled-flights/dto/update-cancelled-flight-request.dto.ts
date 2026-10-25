import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { CalendarDateField } from "../../common/dto/date-range-query.dto";
import { CancellationReason } from "../entities/enums";

export class UpdateCancelledFlightDto {
  @ApiPropertyOptional({ example: "SW1234" })
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  departureAirportId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  arrivalAirportId?: number;

  // Calendar dates (YYYY-MM-DD), never converted between timezones. The stay
  // rules (cancelled-flights/stay-dates.ts) run on these combined with the
  // stored values whenever one of them or the departure airport changes.
  @CalendarDateField({
    required: false,
    description: "Date the flight was cancelled, YYYY-MM-DD",
  })
  cancellationDate?: string;

  @CalendarDateField({
    required: false,
    description:
      "Hotel check-in, YYYY-MM-DD: today or later at the departure airport, on or after the cancellation date",
  })
  checkInDate?: string;

  @CalendarDateField({
    required: false,
    description: "Hotel check-out, YYYY-MM-DD: after check-in (exclusive)",
  })
  checkOutDate?: string;

  @ApiPropertyOptional({ enum: CancellationReason })
  @IsOptional()
  @IsEnum(CancellationReason)
  cancellationReason?: CancellationReason;

  @ApiPropertyOptional({ example: "Severe weather conditions at departure" })
  @IsOptional()
  @IsString()
  cancellationReasonText?: string;
}
