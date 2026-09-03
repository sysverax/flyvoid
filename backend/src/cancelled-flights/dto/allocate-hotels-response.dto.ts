import { ApiProperty } from "@nestjs/swagger";

export class AllocateHotelsSummaryDto {
  @ApiProperty({ example: 10 })
  totalPNRs!: number;

  @ApiProperty({ example: 9 })
  successfulAllocations!: number;

  @ApiProperty({ example: 1 })
  failedAllocations!: number;

  @ApiProperty({ example: 12 })
  totalRoomsAllocated!: number;

  @ApiProperty({ example: 1450.0 })
  totalCost!: number;
}

export class AllocateHotelsAllocatedRoomDto {
  @ApiProperty({ example: "Double Room" })
  roomType!: string;

  @ApiProperty({ example: 2 })
  capacity!: number;

  @ApiProperty({ example: 85.0 })
  pricePerNight!: number;

  @ApiProperty({ example: 85.0 })
  totalCost!: number;
}

export class AllocateHotelsHotelDto {
  @ApiProperty({ example: "Club Hotel Dolphin" })
  name!: string;

  @ApiProperty({ example: "Near Airport, Negombo" })
  address!: string;

  @ApiProperty({ example: 4 })
  stars!: number;

  @ApiProperty({ example: "2026-09-01" })
  checkIn!: string;

  @ApiProperty({ example: "2026-09-02" })
  checkOut!: string;
}

export class AllocateHotelsItemDto {
  @ApiProperty({ example: 5 })
  bookingId!: number;

  @ApiProperty({ example: "PNR001" })
  pnr!: string;

  @ApiProperty({ example: "John Smith" })
  passengerName!: string;

  @ApiProperty({ example: "business" })
  travelClass!: string;

  @ApiProperty({ example: "accessibility" })
  subGroup!: string;

  @ApiProperty({ example: 2 })
  adults!: number;

  @ApiProperty({ example: 0 })
  children!: number;

  @ApiProperty({ type: AllocateHotelsHotelDto })
  hotel!: AllocateHotelsHotelDto;

  @ApiProperty({ type: [AllocateHotelsAllocatedRoomDto] })
  rooms!: AllocateHotelsAllocatedRoomDto[];

  @ApiProperty({ example: 1 })
  totalRooms!: number;

  @ApiProperty({ example: 85.0 })
  totalCost!: number;

  @ApiProperty({ example: 75.0 })
  buyingPrice!: number;

  @ApiProperty({ example: 90.0 })
  sellingPrice!: number;

  @ApiProperty({ example: 5.0 })
  platformFee!: number;

  @ApiProperty({ example: 10.0 })
  earnings!: number;

  @ApiProperty({ example: "HB-789123" })
  bookingReference!: string;

  @ApiProperty({ example: "hotelbeds" })
  vendor!: string;

  @ApiProperty({ example: "confirmed" })
  status!: string;
}

export class AllocateHotelsFailedItemDto {
  @ApiProperty({ example: 8 })
  bookingId!: number;

  @ApiProperty({ example: "PNR008" })
  pnr!: string;

  @ApiProperty({
    example: "No available rooms matching passenger requirements",
  })
  reason!: string;

  @ApiProperty({ example: "allocation_failed" })
  status!: string;
}

export class AllocateHotelsResponseDto {
  @ApiProperty({ example: 1 })
  flightId!: number;

  @ApiProperty({ example: "SW1234" })
  flightNumber!: string;

  @ApiProperty({ example: "allocation_complete" })
  status!: string;

  @ApiProperty({ type: AllocateHotelsSummaryDto })
  summary!: AllocateHotelsSummaryDto;

  @ApiProperty({ type: [AllocateHotelsItemDto] })
  allocations!: AllocateHotelsItemDto[];

  @ApiProperty({ type: [AllocateHotelsFailedItemDto] })
  failedAllocations!: AllocateHotelsFailedItemDto[];
}
