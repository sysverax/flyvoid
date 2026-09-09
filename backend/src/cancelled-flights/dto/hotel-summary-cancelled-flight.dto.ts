import { ApiProperty } from "@nestjs/swagger";

export class HotelSummaryCancelledFlightSummaryDto {
  @ApiProperty({ example: 100 })
  totalBookings!: number;

  @ApiProperty({ example: 1 })
  totalAdults!: number;

  @ApiProperty({ example: 10 })
  totalChildren!: number;

  @ApiProperty({ example: 5 })
  totalRooms!: number;

  @ApiProperty({ example: 5000 })
  totalHotelCost!: number;

  @ApiProperty({ example: 500 })
  totalDiscount!: number;

  @ApiProperty({ example: 500 })
  totalHotelTax!: number;

  @ApiProperty({ example: 500 })
  totalPlatformFee!: number;

  @ApiProperty({ example: 4500 })
  totalPayable!: number;
}

export class HotelSummaryCancelledFlightResponseDto {
  @ApiProperty({ type: HotelSummaryCancelledFlightSummaryDto })
  summary: HotelSummaryCancelledFlightSummaryDto;
}
