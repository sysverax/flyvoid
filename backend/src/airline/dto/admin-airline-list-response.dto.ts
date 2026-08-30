import { ApiProperty } from "@nestjs/swagger";
import { BaseAdminAirlineResponseDto } from "./admin-airline-response.dto";

export class AirlineDataDto extends BaseAdminAirlineResponseDto {
  @ApiProperty({ example: 150 })
  flightsCount!: number;

  @ApiProperty({ example: 1200 })
  passengersCount: number;

  @ApiProperty({ example: 300 })
  hotelBookingsCount: number;

  @ApiProperty({ example: 500000 })
  spendAmount!: number;

  @ApiProperty({ example: 10000 })
  revenueAmount!: number;
}

export class AdminAirlineListResponseDto {
  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 1 })
  currentPage!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ type: AirlineDataDto, isArray: true })
  airlines!: AirlineDataDto[];
}
