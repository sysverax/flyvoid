import { ApiProperty } from "@nestjs/swagger";

export class HotelBookingsSummaryResponseDto {
  @ApiProperty({
    description:
      "Total number of live hotel bookings (the same rows as the hotel bookings list)",
    example: 40,
  })
  totalBookings!: number;

  @ApiProperty({
    description:
      "Total adults and children on PNRs that have a live hotel booking",
    example: 96,
  })
  totalPassengers!: number;

  @ApiProperty({
    description: "Total number of booked (non-failed) rooms on those hotel bookings",
    example: 55,
  })
  totalRooms!: number;

  @ApiProperty({
    description: "Total hotel cost of those hotel bookings",
    example: 12500.5,
  })
  totalCost!: number;

  @ApiProperty({
    description: "Total platform fee of those hotel bookings",
    example: 1250.05,
  })
  totalPlatformFee!: number;

  @ApiProperty({
    description:
      "Total PNRs on the airline's cancelled flights, any flight status. Not narrowed by search or check-in dates.",
    example: 70,
  })
  totalPnrs!: number;

  @ApiProperty({
    description:
      "PNRs on flights whose status is allocated, paid or published. Not narrowed by search or check-in dates.",
    example: 52,
  })
  totalAllocatedPnrs!: number;
}
