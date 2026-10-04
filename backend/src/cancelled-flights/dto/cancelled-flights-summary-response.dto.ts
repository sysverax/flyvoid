import { ApiProperty } from "@nestjs/swagger";

export class CancelledFlightsSummaryResponseDto {
  @ApiProperty({
    description: "Total number of cancelled flights matching the filters",
    example: 12,
  })
  totalCancelFlights!: number;

  @ApiProperty({
    description: "Total number of adult passengers across those flights",
    example: 28,
  })
  totalAdults!: number;

  @ApiProperty({
    description: "Total number of child passengers across those flights",
    example: 6,
  })
  totalChildren!: number;

  @ApiProperty({
    description: "Total number of passenger bookings across those flights",
    example: 18,
  })
  totalBookings!: number;

  @ApiProperty({
    description: "Total number of hotel rooms allocated across those flights",
    example: 15,
  })
  totalRooms!: number;

  @ApiProperty({
    description: "Total hotel cost (selling price, before tax and platform fee)",
    example: 4200.5,
  })
  totalHotelCost!: number;

  @ApiProperty({
    description: "Total hotel tax across those flights",
    example: 210.25,
  })
  totalHotelTax!: number;

  @ApiProperty({
    description: "Total discount applied across those flights",
    example: 80,
  })
  totalDiscount!: number;

  @ApiProperty({
    description: "Total payable cost across those flights (hotel cost + tax + platform fee)",
    example: 4830.75,
  })
  totalCost!: number;

  @ApiProperty({
    description: "Total platform fee across those flights",
    example: 420.05,
  })
  totalPlatformFee!: number;
}
