import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export type PnrBookingStatus =
  | "SUCCESS"
  | "PENDING"
  | "FAILED"
  | "MANUAL_CHECK"
  | "NOT_STARTED";

export class HotelAllocationRoomDto {
  @ApiProperty({ example: 2 })
  adults: number;

  @ApiProperty({ example: 0 })
  children: number;

  @ApiProperty({ example: "Double Room" })
  roomName: string;

  @ApiProperty({ example: "Room only" })
  boardName: string;

  @ApiProperty({ example: 120 })
  price: number;

  @ApiPropertyOptional({
    description:
      "Taxes not included in the price, collected by the hotel from the guest at check-in (per room, original currency)",
    example: [{ name: "City tax", amount: 2.88, currencyCode: "EUR" }],
  })
  taxesAtProperty?: Array<{
    name: string;
    amount: number;
    currencyCode: string | null;
  }>;
}

export class HotelAllocationHotelDto {
  @ApiProperty({ example: "123456" })
  hotelCode: string;

  @ApiProperty({ example: "Airport Grand Hotel" })
  hotelName: string;

  @ApiProperty({ example: "5 STARS" })
  category: string;

  @ApiPropertyOptional({
    description: "Only for SUCCESS",
    nullable: true,
    example: "1 Airport Rd",
  })
  address: string | null;

  @ApiPropertyOptional({ description: "Only for SUCCESS", nullable: true })
  checkInDate: string | null;

  @ApiPropertyOptional({ description: "Only for SUCCESS", nullable: true })
  checkOutDate: string | null;

  @ApiProperty({ description: "Only for SUCCESS (else 0)", example: 2 })
  totalRooms: number;

  @ApiProperty({ description: "Only for SUCCESS (else 0)", example: 264 })
  totalPrice: number;

  @ApiProperty({
    type: [HotelAllocationRoomDto],
    description: "Only for SUCCESS",
  })
  rooms: HotelAllocationRoomDto[];
}

export class HotelAllocationBookingResultDto {
  @ApiProperty({ example: 12 })
  bookingId: number;

  @ApiProperty({ example: "ABC123" })
  pnr: string;

  @ApiProperty({ example: "business" })
  travelClass: string;

  @ApiPropertyOptional({
    description: "Persisted processing order of the PNR (class priority first)",
    nullable: true,
    example: 2,
  })
  processingOrder: number | null;

  @ApiProperty({
    enum: ["SUCCESS", "PENDING", "FAILED", "MANUAL_CHECK", "NOT_STARTED"],
    description:
      "SUCCESS = booked with the supplier; PENDING = booking in progress (not confirmed); FAILED = no hotel could be booked; MANUAL_CHECK = supplier outcome unknown, reconcile before rebooking; NOT_STARTED = not attempted yet",
    example: "SUCCESS",
  })
  bookingStatus: PnrBookingStatus;

  @ApiPropertyOptional({
    type: HotelAllocationHotelDto,
    nullable: true,
    description:
      "SUCCESS: the booked hotel. PENDING / MANUAL_CHECK: the hotel being attempted (not confirmed). FAILED / NOT_STARTED: null",
  })
  hotel: HotelAllocationHotelDto | null;

  @ApiPropertyOptional({
    description: "Supplier booking reference(s); only for SUCCESS",
    nullable: true,
  })
  providerBookingReference: string | null;

  @ApiProperty({
    description: "Booking attempts recorded for this PNR",
    example: 2,
  })
  attempts: number;

  @ApiPropertyOptional({
    description: "Booked-hotel note, or the failure / manual-check reason",
    nullable: true,
  })
  reason: string | null;
}

export class HotelAllocationsDto {
  @ApiProperty({ description: "ID of the cancelled flight", example: 1 })
  cancelledFlightId: number;

  @ApiProperty({ description: "Flight status", example: "allocated" })
  status: string;

  @ApiProperty({
    description:
      "True while an allocation run is booking hotels in the background",
    example: false,
  })
  running: boolean;

  @ApiPropertyOptional({
    description: "Why the last allocation run stopped early, if it did",
    nullable: true,
    example: null,
  })
  lastRunError: string | null;

  @ApiProperty({ example: 100 })
  totalPnrs: number;

  @ApiProperty({ example: 93 })
  successfulPnrs: number;

  @ApiProperty({ example: 2 })
  pendingPnrs: number;

  @ApiProperty({ example: 3 })
  failedPnrs: number;

  @ApiProperty({ example: 2 })
  manualCheckPnrs: number;

  @ApiProperty({ example: 0 })
  notStartedPnrs: number;

  @ApiProperty({
    description: "True only when every PNR is SUCCESS",
    example: false,
  })
  fullyBooked: boolean;

  @ApiProperty({
    description:
      "False once the first allocation and its one retry have been used",
    example: true,
  })
  canRetry: boolean;

  @ApiProperty({
    description: "Retry is blocked while bookings wait for the supplier check",
    example: false,
  })
  awaitingSupplierCheck: boolean;

  @ApiProperty({
    description: "When the next supplier check is due",
    example: "2026-10-16T10:05:00.000Z",
    nullable: true,
    type: String,
  })
  nextSupplierCheckAt: string | null;

  @ApiProperty({ type: [HotelAllocationBookingResultDto] })
  results: HotelAllocationBookingResultDto[];

  @ApiProperty({ description: "Rooms of successful bookings", example: 5 })
  totalRooms: number;

  @ApiProperty({ example: 900 })
  totalActualPrice: number;

  @ApiProperty({ example: 1000 })
  totalSellingPrice: number;

  @ApiProperty({ example: 100 })
  totalDiscounts: number;

  @ApiProperty({ example: 50 })
  totalHotelTaxes: number;

  @ApiProperty({ example: 10 })
  platformFeePercentage: number;

  @ApiProperty({ example: 30 })
  totalPlatformFee: number;

  @ApiProperty({
    description: "Total payable for successful bookings",
    example: 1030,
  })
  totalPrice: number;

  @ApiProperty({ example: "EUR" })
  currency: string;
}

export class HotelAllocationProgressDto {
  @ApiProperty({ description: "ID of the cancelled flight", example: 1 })
  cancelledFlightId: number;

  @ApiProperty({
    description: "Flight status",
    example: "hotel_allocation_in_progress",
  })
  status: string;

  @ApiProperty({
    description:
      "True while an allocation run is booking hotels in the background",
    example: true,
  })
  running: boolean;

  @ApiPropertyOptional({
    description: "Why the last allocation run stopped early, if it did",
    nullable: true,
    example: null,
  })
  lastRunError: string | null;

  @ApiProperty({ example: 15 })
  totalPnrs: number;

  @ApiProperty({
    description:
      "PNRs with a final outcome: successful + failed + manual check",
    example: 10,
  })
  processedPnrs: number;

  @ApiProperty({ example: 8 })
  successfulPnrs: number;

  @ApiProperty({ example: 2 })
  pendingPnrs: number;

  @ApiProperty({ example: 1 })
  failedPnrs: number;

  @ApiProperty({ example: 1 })
  manualCheckPnrs: number;

  @ApiProperty({ example: 3 })
  notStartedPnrs: number;

  @ApiProperty({
    description: "True only when every PNR is SUCCESS",
    example: false,
  })
  fullyBooked: boolean;
}
