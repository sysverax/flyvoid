import { ApiProperty } from "@nestjs/swagger";
import { TimeFrameRangeResponseDto } from "../../common/dto/time-frame-range-response.dto";

const HOTEL_BOOKINGS_IN_RANGE =
  "live hotel bookings created in the range, on allocated, paid or published flights";

const FLIGHTS_IN_RANGE =
  "non-draft cancelled flights created in the range";

const PNRS_IN_RANGE =
  "PNRs created in the range (PNR created_at), on non-draft cancelled flights. Adults + children equals the affected passengers trend total";

// timeFrame, timezone, startDate, endDate come from TimeFrameRangeResponseDto.
export class AirlineDashboardSummaryResponseDto extends TimeFrameRangeResponseDto {
  @ApiProperty({
    description: `Total cost (including tax and platform fee) of ${HOTEL_BOOKINGS_IN_RANGE}`,
    example: 450.86,
  })
  totalHotelBookingCost!: number;

  @ApiProperty({
    description: `Number of ${HOTEL_BOOKINGS_IN_RANGE}`,
    example: 4,
  })
  totalHotelBookings!: number;

  @ApiProperty({
    description: `Booked (non-failed) rooms on ${HOTEL_BOOKINGS_IN_RANGE}`,
    example: 4,
  })
  totalRooms!: number;

  @ApiProperty({
    description: `Total platform fee of ${HOTEL_BOOKINGS_IN_RANGE}`,
    example: 35.86,
  })
  totalPlatformFee!: number;

  @ApiProperty({
    description: "Current platform fee rate (%) of the airline",
    example: 7,
    nullable: true,
    type: Number,
  })
  platformFeePercentage!: number | null;

  @ApiProperty({
    description: `Number of ${FLIGHTS_IN_RANGE}`,
    example: 3,
  })
  totalCancelFlights!: number;

  @ApiProperty({
    description: `Adults on ${PNRS_IN_RANGE}`,
    example: 7,
  })
  totalAdults!: number;

  @ApiProperty({
    description: `Children on ${PNRS_IN_RANGE}`,
    example: 0,
  })
  totalChildren!: number;
}
