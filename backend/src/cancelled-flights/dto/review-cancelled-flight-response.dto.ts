import { ApiProperty } from "@nestjs/swagger";
import {
  BaseCancelledFlightResponseDto,
  CancelledFlightResponseDto,
} from "./cancelled-flight-response.dto";

export class RouteAirportDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: "JFK" })
  code: string;

  @ApiProperty({ example: "John F. Kennedy International Airport" })
  name: string;
}
export class CancelledFlightRouteDto {
  @ApiProperty({ type: RouteAirportDto })
  departureAirport: RouteAirportDto;

  @ApiProperty({ type: RouteAirportDto })
  arrivalAirport: RouteAirportDto;
}

export class ReviewCancelledFlightSummaryDto {
  @ApiProperty({ example: 100 })
  totalBookings!: number;

  @ApiProperty({ example: 1 })
  totalAdults!: number;

  @ApiProperty({ example: 10 })
  totalChildren!: number;
}

export class ReviewCancelledFlightDto extends BaseCancelledFlightResponseDto {
  @ApiProperty({ type: CancelledFlightRouteDto })
  route: CancelledFlightRouteDto;
}

export class ReviewCancelledFlightResponseDto {
  @ApiProperty({ type: ReviewCancelledFlightDto })
  flight: ReviewCancelledFlightDto;

  @ApiProperty({ type: ReviewCancelledFlightSummaryDto })
  summary: ReviewCancelledFlightSummaryDto;
}
