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
      "Total PNRs on the airline's cancelled flights, any flight status. Not narrowed by search or startDate/endDate.",
    example: 70,
  })
  totalPnrs!: number;

  @ApiProperty({
    description:
      "PNRs on flights whose status is allocated, paid or published. Not narrowed by search or startDate/endDate.",
    example: 52,
  })
  totalAllocatedPnrs!: number;
}

/** Platform summary: totals of CONFIRMED hotel bookings matching the admin list filters. */
export class HotelBookingsAdminSummaryResponseDto {
  @ApiProperty({ description: "Confirmed hotel bookings", example: 40 })
  totalBookings!: number;

  @ApiProperty({ description: "Adults and children on those bookings' PNRs", example: 96 })
  totalPassengers!: number;

  @ApiProperty({ description: "Booked (non-failed) rooms", example: 55 })
  totalRooms!: number;

  @ApiProperty({ description: "Charged to airlines (Σ total price)", example: 12500.5 })
  totalCost!: number;

  @ApiProperty({ description: "Σ platform fee", example: 1136.41 })
  totalPlatformFee!: number;

  @ApiProperty({
    description: "Σ supplier margin (hotel cost − buying price)",
    example: 820.4,
  })
  totalSupplierMargin!: number;

  @ApiProperty({ description: "Σ discount (not applied yet, always 0)", example: 0 })
  totalDiscounts!: number;

  @ApiProperty({
    description: "Everything the platform keeps: totalPlatformFee + totalSupplierMargin",
    example: 1956.81,
  })
  totalEarnings!: number;

  @ApiProperty({
    description: "Paid to suppliers (Σ buying price) = totalCost − totalEarnings",
    example: 10543.69,
  })
  totalPaidToHotels!: number;
}
