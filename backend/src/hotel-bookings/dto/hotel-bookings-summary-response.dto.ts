import { ApiProperty } from "@nestjs/swagger";

export class HotelBookingsSummaryResponseDto {
  @ApiProperty({
    description: "Total number of cancelled flights for this airline",
    example: 12,
  })
  totalCancelFlights!: number;

  @ApiProperty({
    description: "Total number of passenger bookings across those flights",
    example: 40,
  })
  totalBookings!: number;

  @ApiProperty({
    description: "Total number of passengers across those bookings",
    example: 96,
  })
  totalPassengers!: number;

  @ApiProperty({
    description: "Total number of hotel rooms allocated across those flights",
    example: 55,
  })
  totalRooms!: number;

  @ApiProperty({
    description: "Total hotel cost across those flights",
    example: 12500.5,
  })
  totalCost!: number;

  @ApiProperty({
    description: "Total platform fee across those flights",
    example: 1250.05,
  })
  totalPlatformFee!: number;
}
