import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { HotelAllocationStatus } from "../entities/enums";

export class HotelAllocationBookingResultDto {
  @ApiProperty({ example: 12 })
  bookingId: number;

  @ApiProperty({ example: "ABC123" })
  pnr: string;

  @ApiProperty({ example: "business" })
  travelClass: string;

  @ApiProperty({
    enum: HotelAllocationStatus,
    description:
      "confirmed = booked with the supplier; failed = no candidate could be booked (retry allowed); manual_check = supplier outcome unknown, reconcile before rebooking; in_progress = being booked; draft = not attempted yet",
    example: HotelAllocationStatus.CONFIRMED,
  })
  status: HotelAllocationStatus;

  @ApiPropertyOptional({
    description:
      "Hotel booked (confirmed) or being reconciled (manual_check/in_progress); null otherwise",
    example: "123456",
    nullable: true,
  })
  hotelCode: string | null;

  @ApiPropertyOptional({ example: "Airport Grand Hotel", nullable: true })
  hotelName: string | null;

  @ApiPropertyOptional({ example: "5 STARS", nullable: true })
  category: string | null;

  @ApiPropertyOptional({
    description: "Supplier booking reference(s); only for confirmed bookings",
    example: "f1c9a1e4-...",
    nullable: true,
  })
  bookingReference: string | null;

  @ApiProperty({ example: 2 })
  totalRooms: number;

  @ApiProperty({ description: "Total price (confirmed bookings only)", example: 264 })
  totalPrice: number;

  @ApiProperty({
    description: "Supplier booking attempts made for this PNR in this run",
    example: 1,
  })
  attempts: number;

  @ApiPropertyOptional({
    description: "Why this hotel was booked, or the failure / manual-check reason",
    nullable: true,
  })
  reason: string | null;
}

export class HotelAllocationsDto {
  @ApiProperty({ description: "ID of the cancelled flight", example: 1 })
  cancelledFlightId: number;

  @ApiProperty({
    description:
      "Flight status after the run: allocated when at least one PNR is confirmed, else passengers_booking_confirmed",
    example: "allocated",
  })
  status: string;

  @ApiProperty({
    description: "Total number of bookings (PNRs) for the cancelled flight",
    example: 10,
  })
  totalBookings: number;

  @ApiProperty({
    description: "PNRs whose hotel is booked and confirmed by the supplier",
    example: 8,
  })
  confirmedBookings: number;

  @ApiProperty({
    description: "Same as confirmedBookings (kept for compatibility)",
    example: 8,
  })
  allocatedBookings: number;

  @ApiProperty({
    description: "PNRs that could not be booked with any candidate hotel",
    example: 1,
  })
  failedBookings: number;

  @ApiProperty({
    description:
      "PNRs whose supplier booking outcome is unknown (timeout/partial); reconcile with the supplier before rebooking",
    example: 1,
  })
  manualCheckBookings: number;

  @ApiProperty({
    description: "PNRs still being booked (e.g. by a concurrent single-PNR booking)",
    example: 0,
  })
  inProgressBookings: number;

  @ApiProperty({ description: "PNRs not attempted yet", example: 0 })
  pendingBookings: number;

  @ApiProperty({ type: [HotelAllocationBookingResultDto] })
  results: HotelAllocationBookingResultDto[];

  @ApiProperty({
    description: "Total number of rooms booked (confirmed) for the cancelled flight",
    example: 5,
  })
  totalRooms: number;

  @ApiProperty({
    description: "Total actual price of the confirmed hotel rooms",
    example: 900,
  })
  totalActualPrice: number;

  @ApiProperty({
    description: "Total selling price of the confirmed hotel rooms",
    example: 1000,
  })
  totalSellingPrice: number;

  @ApiProperty({
    description: "Total discounts applied to the confirmed hotel bookings",
    example: 100,
  })
  totalDiscounts: number;

  @ApiProperty({
    description: "Total hotel taxes of the confirmed rooms",
    example: 50,
  })
  totalHotelTaxes: number;

  @ApiProperty({
    description: "Platform fee percentage",
    example: 10,
  })
  platformFeePercentage: number;

  @ApiProperty({
    description: "Total platform fee of the confirmed hotel bookings",
    example: 30,
  })
  totalPlatformFee: number;

  @ApiProperty({
    description: "Total payable for the confirmed hotel bookings",
    example: 1030,
  })
  totalPrice: number;

  @ApiProperty({
    description: "Currency of the hotel prices",
    example: "EUR",
  })
  currency: string;
}
