import { ApiProperty } from "@nestjs/swagger";
import { BookingResponseDto } from "./booking-response.dto";

export class CancelledFlightBookingsListResponseDto {
  @ApiProperty({
    description: "List of cancelled flight bookings",
    type: [BookingResponseDto],
  })
  bookings: BookingResponseDto[];
  @ApiProperty({ description: "Total number of bookings", example: 50 })
  totalBookings: number;
  @ApiProperty({ description: "Current page number", example: 1 })
  currentPage: number;
  @ApiProperty({ description: "Number of bookings per page", example: 10 })
  limit: number;
}
