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
