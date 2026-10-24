import { ApiProperty } from "@nestjs/swagger";
import { FlightStatus } from "../entities/enums";

export class CancelledFlightListAirportDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: "JFK" })
  code!: string;

  @ApiProperty({ example: "John F. Kennedy International Airport" })
  name!: string;
}

export class CancelledFlightListItemDto {
  @ApiProperty({ example: 101 })
  id!: number;

  @ApiProperty({ example: "SW1234" })
  flightNumber!: string;

  @ApiProperty({ type: CancelledFlightListAirportDto })
  departureAirport!: CancelledFlightListAirportDto;

  @ApiProperty({ type: CancelledFlightListAirportDto })
  arrivalAirport!: CancelledFlightListAirportDto;

  @ApiProperty({ example: "2026-09-07" })
  cancellationDate!: string;

  @ApiProperty({ example: 48 })
  totalBookings!: number;

  @ApiProperty({ example: 72 })
  totalPassengers!: number;

  @ApiProperty({ example: 9420.5 })
  totalCost!: number;

  @ApiProperty({ enum: FlightStatus, example: FlightStatus.IN_PROGRESS })
  status!: FlightStatus;
}

export class CancelledFlightListAirlineDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: "SkyWings Airlines" })
  name!: string;
}

// Platform (admin) view: same item as the airline view, plus the owning airline.
// Platform (admin) only: airline users do not get these fields.
export class CancelledFlightAdminListItemDto extends CancelledFlightListItemDto {
  @ApiProperty({
    description: "Distinct hotels with a confirmed booking for this flight",
    example: 3,
  })
  totalHotels!: number;

  @ApiProperty({ description: "Hotel rooms booked for this flight", example: 21 })
  totalRooms!: number;

  @ApiProperty({
    description: "Platform earnings from this flight's hotel bookings",
    example: 856.4,
  })
  totalEarnings!: number;

  @ApiProperty({ type: CancelledFlightListAirlineDto })
  airline!: CancelledFlightListAirlineDto;
}

export class CancelledFlightListPaginationDto {
  @ApiProperty({ example: 1 })
  currentPage!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 124 })
  totalCount!: number;
}

// Airline view response.
export class CancelledFlightListResponseDto {
  @ApiProperty({ type: [CancelledFlightListItemDto] })
  cancelledFlights!: CancelledFlightListItemDto[];

  @ApiProperty({ type: CancelledFlightListPaginationDto })
  pagination!: CancelledFlightListPaginationDto;
}

// shorten=true (dropdowns): one entry per cancellation; the same flight
// number can be cancelled more than once, so cancellationDate tells them apart.
export class CancelledFlightShortListItemDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: "FV123" })
  flightNumber!: string;

  @ApiProperty({ example: "2026-09-07" })
  cancellationDate!: string;
}

export class CancelledFlightShortListResponseDto {
  @ApiProperty({ type: [CancelledFlightShortListItemDto] })
  cancelledFlights!: CancelledFlightShortListItemDto[];

  @ApiProperty({ type: CancelledFlightListPaginationDto })
  pagination!: CancelledFlightListPaginationDto;
}

// Platform (admin) view response.
export class CancelledFlightAdminListResponseDto {
  @ApiProperty({ type: [CancelledFlightAdminListItemDto] })
  cancelledFlights!: CancelledFlightAdminListItemDto[];

  @ApiProperty({ type: CancelledFlightListPaginationDto })
  pagination!: CancelledFlightListPaginationDto;
}
