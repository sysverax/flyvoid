import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TimeFrame } from "../../common/constants/time-frame.constants";
import { TIME_FRAME_RANGE_DOCS } from "../../common/dto/time-frame-range-response.dto";

export class CancelledFlightsSummaryResponseDto {
  @ApiProperty({
    description: "Total number of cancelled flights matching the filters",
    example: 12,
  })
  totalCancelFlights!: number;

  @ApiProperty({
    description: "Total number of adult passengers across those flights",
    example: 28,
  })
  totalAdults!: number;

  @ApiProperty({
    description: "Total number of child passengers across those flights",
    example: 6,
  })
  totalChildren!: number;

  @ApiProperty({
    description:
      "Total number of passenger bookings (PNRs) across those flights, with or without a hotel",
    example: 18,
  })
  totalBookings!: number;

  @ApiProperty({
    description:
      "Total number of live hotel bookings across those flights (the same rows as the hotel bookings list)",
    example: 15,
  })
  totalHotelBookings!: number;

  @ApiProperty({
    description: "Total number of hotel rooms allocated across those flights",
    example: 15,
  })
  totalRooms!: number;

  @ApiProperty({
    description: "Total hotel cost (selling price, before tax and platform fee)",
    example: 4200.5,
  })
  totalHotelCost!: number;

  @ApiProperty({
    description: "Total hotel tax across those flights",
    example: 210.25,
  })
  totalHotelTax!: number;

  @ApiProperty({
    description: "Total discount applied across those flights",
    example: 80,
  })
  totalDiscount!: number;

  @ApiProperty({
    description: "Total payable cost across those flights (hotel cost + tax + platform fee)",
    example: 4830.75,
  })
  totalCost!: number;

  @ApiProperty({
    description: "Total platform fee across those flights",
    example: 420.05,
  })
  totalPlatformFee!: number;

  @ApiProperty({
    description:
      "Current platform fee rate (%) of the airline user's airline. Always null for platform users.",
    example: 10,
    nullable: true,
    type: Number,
  })
  platformFeePercentage!: number | null;

  // Present only when the request sends timeFrame.
  @ApiPropertyOptional({
    ...TIME_FRAME_RANGE_DOCS.timeFrame,
    description: "Echo of the request timeFrame. Only present when timeFrame is sent.",
  })
  timeFrame?: TimeFrame;

  @ApiPropertyOptional({
    ...TIME_FRAME_RANGE_DOCS.timezone,
    description: `${TIME_FRAME_RANGE_DOCS.timezone.description}. Only present when timeFrame is sent.`,
  })
  timezone?: string;

  @ApiPropertyOptional({
    ...TIME_FRAME_RANGE_DOCS.startDate,
    description: `${TIME_FRAME_RANGE_DOCS.startDate.description}. Only present when timeFrame is sent.`,
  })
  startDate?: string;

  @ApiPropertyOptional({
    ...TIME_FRAME_RANGE_DOCS.endDate,
    description: `${TIME_FRAME_RANGE_DOCS.endDate.description}. Only present when timeFrame is sent.`,
  })
  endDate?: string;
}
