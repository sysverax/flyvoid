import { ApiProperty } from "@nestjs/swagger";

export class HotelAllocationsDto {
  @ApiProperty({ description: "ID of the cancelled flight", example: 1 })
  cancelledFlightId: number;

  @ApiProperty({
    description: "Status of the hotel allocation",
    example: "allocated",
  })
  status: string;

  @ApiProperty({
    description: "Total number of bookings for the cancelled flight",
    example: 10,
  })
  totalBookings: number;

  @ApiProperty({
    description:
      "Number of successfully allocated bookings for the cancelled flight",
    example: 8,
  })
  allocatedBookings: number;

  @ApiProperty({
    description: "Number of failed bookings for the cancelled flight",
    example: 2,
  })
  failedBookings: number;

  @ApiProperty({
    description:
      "Number of allocated bookings confirmed with the hotel supplier (live booking)",
    example: 7,
  })
  bookedBookings: number;

  @ApiProperty({
    description:
      "Allocated bookings whose live supplier booking failed; retry each via POST /:id/bookings/:bookingId/book-hotel",
    example: [{ bookingId: 12, pnr: "ABC123", reason: "Rate no longer available" }],
  })
  bookingFailures: Array<{ bookingId: number; pnr: string; reason: string }>;

  @ApiProperty({
    description: "Total number of rooms allocated for the cancelled flight",
    example: 5,
  })
  totalRooms: number;
  // totalBuyingPrice: number;

  @ApiProperty({
    description: "Total actual price for the allocated hotel rooms",
    example: 900,
  })
  totalActualPrice: number;

  @ApiProperty({
    description: "Total selling price for the allocated hotel rooms",
    example: 1000,
  })
  totalSellingPrice: number;

  @ApiProperty({
    description: "Total discounts applied to the hotel bookings",
    example: 100,
  })
  totalDiscounts: number;

  @ApiProperty({
    description: "Total hotel taxes for the allocated rooms",
    example: 50,
  })
  totalHotelTaxes: number;

  @ApiProperty({
    description: "Platform fee percentage for the allocated hotel rooms",
    example: 10,
  })
  platformFeePercentage: number;

  @ApiProperty({
    description: "Total platform fee for the allocated hotel rooms",
    example: 30,
  })
  totalPlatformFee: number;

  @ApiProperty({
    description: "Currency of the hotel prices",
    example: "USD",
  })
  currency: string;
}
