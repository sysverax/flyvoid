import { ApiProperty } from "@nestjs/swagger";

export class HotelAvailabilityTaxDto {
  @ApiProperty({ example: "City tax" })
  name!: string;

  @ApiProperty({ example: 8 })
  amount!: number;

  @ApiProperty({ type: String, nullable: true, example: "USD" })
  currency!: string | null;
}

export class HotelAvailabilityCancellationDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: "2026-11-08T12:00:00Z",
    description: "Free cancellation until this time; null when non-refundable or unknown",
  })
  freeUntil!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 182.4,
    description: "First penalty charged after freeUntil (supplier price currency)",
  })
  penaltyAmount!: number | null;
}

export class HotelAvailabilityOptionDto {
  @ApiProperty({ example: "Deluxe Double" })
  roomType!: string;

  @ApiProperty({ example: "Room only" })
  mealPlan!: string;

  @ApiProperty({ type: Number, nullable: true, example: 2 })
  maxGuests!: number | null;

  @ApiProperty({ example: 182.4, description: "Supplier price per night, all rooms" })
  pricePerNight!: number;

  @ApiProperty({ example: 364.8, description: "Supplier price for the whole stay, all rooms" })
  totalPrice!: number;

  @ApiProperty({ example: "USD" })
  currency!: string;

  @ApiProperty({ type: [HotelAvailabilityTaxDto], description: "Taxes already in the price" })
  taxesIncluded!: HotelAvailabilityTaxDto[];

  @ApiProperty({
    type: [HotelAvailabilityTaxDto],
    description: "Taxes the guest pays at the hotel (not in the price)",
  })
  taxesAtProperty!: HotelAvailabilityTaxDto[];

  @ApiProperty({ type: HotelAvailabilityCancellationDto })
  cancellation!: HotelAvailabilityCancellationDto;

  @ApiProperty({ type: Number, nullable: true, example: 3 })
  roomsAvailable!: number | null;

  @ApiProperty({ type: [String], example: ["Wi-Fi", "Air conditioning"] })
  features!: string[];
}

export class HotelAvailabilityHotelDto {
  @ApiProperty({ type: Number, nullable: true, example: 6291054, description: "RateHawk HID; null for other suppliers" })
  hid!: number | null;

  @ApiProperty({ example: "6291054", description: "Supplier hotel code" })
  hotelCode!: string;

  @ApiProperty({ example: "Grand Hotel Dubai" })
  name!: string;

  @ApiProperty({ example: 4, description: "0 when unknown" })
  stars!: number;

  @ApiProperty({ type: String, nullable: true, example: "Al Garhoud Rd, Dubai" })
  address!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 3.2 })
  distanceKm!: number | null;

  @ApiProperty({ example: "USD" })
  currency!: string;

  @ApiProperty({ example: 182.4 })
  lowestPricePerNight!: number;

  @ApiProperty({ example: 364.8 })
  lowestTotalPrice!: number;

  @ApiProperty({ type: String, nullable: true, example: "2026-11-08T12:00:00Z" })
  freeCancellationUntil!: string | null;

  @ApiProperty({ type: [HotelAvailabilityOptionDto] })
  options!: HotelAvailabilityOptionDto[];
}

class HotelAvailabilityProviderRefDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: "ratehawk" })
  code!: string;

  @ApiProperty({ example: "RateHawk" })
  name!: string;
}

class HotelAvailabilityAirportRefDto {
  @ApiProperty({ example: 4 })
  id!: number;

  @ApiProperty({ example: "DXB" })
  code!: string;

  @ApiProperty({ example: "Dubai International" })
  name!: string;
}

class HotelAvailabilityRoomEchoDto {
  @ApiProperty({ example: 2 })
  adults!: number;

  @ApiProperty({ type: [Number], example: [] })
  childrenAges!: number[];
}

export class HotelAvailabilityResponseDto {
  @ApiProperty({ type: HotelAvailabilityProviderRefDto })
  provider!: HotelAvailabilityProviderRefDto;

  @ApiProperty({ type: HotelAvailabilityAirportRefDto })
  airport!: HotelAvailabilityAirportRefDto;

  @ApiProperty({ example: "2026-11-10" })
  checkInDate!: string;

  @ApiProperty({ example: "2026-11-12" })
  checkOutDate!: string;

  @ApiProperty({ example: 2 })
  nights!: number;

  @ApiProperty({ type: [HotelAvailabilityRoomEchoDto] })
  rooms!: HotelAvailabilityRoomEchoDto[];

  @ApiProperty({ example: 10 })
  radius!: number;

  @ApiProperty({ example: "km" })
  radiusUnit!: string;

  @ApiProperty({ example: "AE" })
  residency!: string;

  @ApiProperty({ example: "2026-10-27T09:42:11.000Z" })
  searchedAt!: string;

  @ApiProperty({ type: [HotelAvailabilityHotelDto] })
  hotels!: HotelAvailabilityHotelDto[];
}
