import { ApiProperty } from "@nestjs/swagger";
import {
  FlightStatus,
  HotelAllocationStatus,
} from "../../cancelled-flights/entities/enums";

export class HotelBookingListAirlineDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: "SkyWings Airlines" })
  name!: string;

  @ApiProperty({ example: "SW" })
  code!: string;
}

export class HotelBookingListAirportDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: "JFK" })
  code!: string;

  @ApiProperty({ example: "John F. Kennedy International Airport" })
  name!: string;
}

export class HotelBookingListPassengerDto {
  @ApiProperty({ example: 501 })
  id!: number;

  @ApiProperty({ example: "ABC123" })
  pnr!: string;

  @ApiProperty({ example: "John" })
  firstName!: string;

  @ApiProperty({ example: "Doe" })
  lastName!: string;

  @ApiProperty({ example: "john.doe@example.com" })
  email!: string;

  @ApiProperty({ example: "Economy" })
  travelClass!: string;

  @ApiProperty({ example: "+1234567890" })
  phone!: string;

  @ApiProperty({ example: 2 })
  adults!: number;

  @ApiProperty({ example: 1 })
  children!: number;
}

export class HotelBookingListItemDto {
  @ApiProperty({ example: 1, description: "Hotel booking id" })
  id!: number;

  @ApiProperty({ example: 26 })
  cancelledFlightId!: number;

  @ApiProperty({ example: "SW1234" })
  flightNumber!: string;

  @ApiProperty({ enum: FlightStatus, example: FlightStatus.PAID })
  flightStatus!: FlightStatus;

  @ApiProperty({ example: 12 })
  airlineId!: number;

  @ApiProperty({ type: HotelBookingListAirlineDto })
  airline!: HotelBookingListAirlineDto;

  @ApiProperty({ type: HotelBookingListAirportDto })
  destinationAirport!: HotelBookingListAirportDto;

  @ApiProperty({ type: HotelBookingListPassengerDto })
  passenger!: HotelBookingListPassengerDto;

  @ApiProperty({ example: "Grand Hotel" })
  hotelName!: string;

  @ApiProperty({ example: "4 STAR" })
  rate!: string;

  @ApiProperty({ example: "2026-09-15" })
  checkInDate!: string;

  @ApiProperty({ example: "2026-09-16" })
  checkOutDate!: string;

  @ApiProperty({ example: 2 })
  totalRooms!: number;

  @ApiProperty({ example: 345.5 })
  totalPrice!: number;

  @ApiProperty({
    enum: HotelAllocationStatus,
    example: HotelAllocationStatus.CONFIRMED,
  })
  status!: HotelAllocationStatus;

  @ApiProperty({ example: "2026-09-10T10:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-09-10T10:00:00.000Z", nullable: true })
  updatedAt!: string | null;
}

export class HotelBookingListPaginationDto {
  @ApiProperty({ example: 1 })
  currentPage!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 48 })
  totalCount!: number;
}

export class HotelBookingListResponseDto {
  @ApiProperty({ type: [HotelBookingListItemDto] })
  hotelBookings!: HotelBookingListItemDto[];

  @ApiProperty({ type: HotelBookingListPaginationDto })
  pagination!: HotelBookingListPaginationDto;
}

// ── Platform (admin) view ───────────────────────────────────────────────────

export class HotelBookingAdminAirlineDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: "SkyLine Airways" })
  name!: string;
}

export class HotelBookingAdminProviderDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: "RATEHAWK" })
  code!: string;

  @ApiProperty({ example: "RateHawk" })
  name!: string;
}

export class HotelBookingAdminHotelDto {
  @ApiProperty({ example: 42, nullable: true })
  id!: number | null;

  @ApiProperty({ example: "Grand Hotel" })
  name!: string;
}

export class HotelBookingAdminPassengersDto {
  @ApiProperty({ example: 2 })
  adults!: number;

  @ApiProperty({ example: 1 })
  children!: number;
}

export class HotelBookingAdminPricingDto {
  @ApiProperty({ example: 100, description: "Hotel price shown to the airline" })
  hotelCost!: number;

  @ApiProperty({ example: 92, description: "What the supplier charges the platform" })
  buyingPrice!: number;

  @ApiProperty({ example: 0, description: "Tax (not calculated yet, always 0)" })
  tax!: number;

  @ApiProperty({ example: 0 })
  discount!: number;

  @ApiProperty({ example: 10, description: "hotelCost × platform fee %" })
  platformFee!: number;

  @ApiProperty({
    example: 8,
    description: "Supplier margin kept by the platform: hotelCost − buyingPrice",
  })
  supplierMargin!: number;

  @ApiProperty({
    example: 110,
    description: "Charged to the airline wallet: hotelCost + platformFee",
  })
  totalCost!: number;

  @ApiProperty({
    example: 18,
    description: "Everything the platform keeps: platformFee + supplierMargin",
  })
  totalEarning!: number;
}

export class HotelBookingAdminListItemDto {
  @ApiProperty({ example: 456 })
  id!: number;

  @ApiProperty({ type: HotelBookingAdminAirlineDto })
  airline!: HotelBookingAdminAirlineDto;

  @ApiProperty({ type: HotelBookingAdminProviderDto, nullable: true })
  provider!: HotelBookingAdminProviderDto | null;

  @ApiProperty({ type: HotelBookingListAirportDto })
  destinationAirport!: HotelBookingListAirportDto;

  @ApiProperty({ type: HotelBookingAdminHotelDto })
  hotel!: HotelBookingAdminHotelDto;

  @ApiProperty({ type: HotelBookingAdminPassengersDto })
  passengers!: HotelBookingAdminPassengersDto;

  @ApiProperty({ example: 2 })
  rooms!: number;

  @ApiProperty({ type: HotelBookingAdminPricingDto })
  pricing!: HotelBookingAdminPricingDto;

  @ApiProperty({ enum: HotelAllocationStatus, example: HotelAllocationStatus.CONFIRMED })
  status!: HotelAllocationStatus;

  @ApiProperty({ example: "2026-10-25T10:15:00.000Z" })
  createdAt!: string;
}

export class HotelBookingAdminListResponseDto {
  @ApiProperty({ type: [HotelBookingAdminListItemDto] })
  hotelBookings!: HotelBookingAdminListItemDto[];

  @ApiProperty({ type: HotelBookingListPaginationDto })
  pagination!: HotelBookingListPaginationDto;
}
