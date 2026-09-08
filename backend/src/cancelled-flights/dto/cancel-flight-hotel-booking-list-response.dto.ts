import { ApiProperty } from "@nestjs/swagger";
import { HotelBookingResponseDto } from "./hotel-booking-response.dto";

export class CancelledFlightHotelBookingListResponseDto {
  @ApiProperty({
    description: "List of cancelled flight hotel bookings",
    type: [HotelBookingResponseDto],
  })
  hotelBookings: HotelBookingResponseDto[];
  @ApiProperty({ description: "Total number of hotel bookings", example: 50 })
  totalHotelBookings: number;
  @ApiProperty({ description: "Current page number", example: 1 })
  currentPage: number;
  @ApiProperty({
    description: "Number of hotel bookings per page",
    example: 10,
  })
  limit: number;
}
