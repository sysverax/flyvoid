import { ApiProperty } from "@nestjs/swagger";
import { BaseCancelledFlightResponseDto } from "./cancelled-flight-response.dto";
import { CancelledFlightRouteDto } from "./review-cancelled-flight-response.dto";

export class CancelledFlightSummaryDto {
  @ApiProperty({ example: 100 })
  totalBookings!: number;

  @ApiProperty({ example: 1 })
  totalAdults!: number;

  @ApiProperty({ example: 10 })
  totalChildren!: number;

  @ApiProperty({ example: 5 })
  totalHotelRooms!: number;

  @ApiProperty({ example: 10000.0 })
  totalCost!: number;
}

export class CancelledFlightListItemDto extends BaseCancelledFlightResponseDto {
  @ApiProperty({ type: CancelledFlightRouteDto })
  route: CancelledFlightRouteDto;

  @ApiProperty({ type: CancelledFlightSummaryDto })
  summary: CancelledFlightSummaryDto;
}

export class CancelledFlightListResponseDto {
  @ApiProperty({ type: [CancelledFlightListItemDto] })
  cancelledFlights!: CancelledFlightListItemDto[];

  @ApiProperty({ example: 100 })
  totalCount!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  pageSize!: number;
}
