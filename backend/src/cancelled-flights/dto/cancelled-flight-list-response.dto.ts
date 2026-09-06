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

export class CancelledFlightListPaginationDto {
  @ApiProperty({ example: 1 })
  currentPage!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 124 })
  totalCount!: number;
}

export class CancelledFlightListResponseDto {
  @ApiProperty({ type: [CancelledFlightListItemDto] })
  cancelledFlights!: CancelledFlightListItemDto[];

  @ApiProperty({ type: CancelledFlightListPaginationDto })
  pagination!: CancelledFlightListPaginationDto;
}
