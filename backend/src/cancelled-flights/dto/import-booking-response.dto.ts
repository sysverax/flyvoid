import { ApiProperty } from "@nestjs/swagger";
import { BookingResponseDto } from "./booking-response.dto";

export class ErrorListItemDto {
  @ApiProperty({ example: 3 })
  row!: number;

  @ApiProperty({ example: ["Invalid email format", "Missing first name"] })
  errors!: string[];
}

export class SummaryDto {
  @ApiProperty({ example: 10 })
  totalBookings!: number;

  @ApiProperty({ example: 8 })
  validBookings!: number;

  @ApiProperty({ example: 2 })
  errorBookings!: number;
}

export class ImportBookingResponseDto {
  @ApiProperty({ type: [BookingResponseDto] })
  bookings!: BookingResponseDto[];

  @ApiProperty({ type: SummaryDto })
  summary!: SummaryDto;

  @ApiProperty({ type: [ErrorListItemDto] })
  errorList!: ErrorListItemDto[];
}
