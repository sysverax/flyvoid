import { ApiProperty } from "@nestjs/swagger";
import {
  TREND_GRANULARITY,
  TrendGranularity,
} from "../../common/constants/time-frame.constants";
import { TimeFrameRangeResponseDto } from "../../common/dto/time-frame-range-response.dto";

const BUCKET_DESCRIPTION =
  'Bucket start, local wall-clock time in the request `timezone` (no offset): "2026-10-21T14:00" (hour), "2026-10-21" (day), "2026-10" (month) or "2026" (year)';

const LABEL_DESCRIPTION =
  'Display label for the bucket: "14:00" (hour), weekday name such as "Monday" (day, i.e. week), month name such as "October" (month) or "2026" (year)';

// timeFrame, timezone, startDate, endDate come from TimeFrameRangeResponseDto.
export class AirlineTrendResponseDto extends TimeFrameRangeResponseDto {
  @ApiProperty({ enum: TREND_GRANULARITY, example: TREND_GRANULARITY.DAY })
  granularity!: TrendGranularity;
}

export class HotelSpendTrendPointDto {
  @ApiProperty({ description: BUCKET_DESCRIPTION, example: "2026-10-16" })
  bucket!: string;

  @ApiProperty({ description: LABEL_DESCRIPTION, example: "Friday" })
  label!: string;

  @ApiProperty({
    description:
      "Total hotel cost (including tax and platform fee) of live hotel bookings created in this bucket, on allocated, paid and published flights",
    example: 1250.5,
  })
  spend!: number;
}

export class HotelSpendTrendResponseDto extends AirlineTrendResponseDto {
  @ApiProperty({
    type: [HotelSpendTrendPointDto],
    description: "One point per bucket, oldest first; empty buckets are 0",
  })
  points!: HotelSpendTrendPointDto[];
}

export class AffectedPassengersTrendPointDto {
  @ApiProperty({ description: BUCKET_DESCRIPTION, example: "2026-10-16" })
  bucket!: string;

  @ApiProperty({ description: LABEL_DESCRIPTION, example: "Friday" })
  label!: string;

  @ApiProperty({
    description:
      "Adults plus children on PNRs created in this bucket, on non-draft cancelled flights",
    example: 148,
  })
  passengers!: number;
}

export class AffectedPassengersTrendResponseDto extends AirlineTrendResponseDto {
  @ApiProperty({
    type: [AffectedPassengersTrendPointDto],
    description: "One point per bucket, oldest first; empty buckets are 0",
  })
  points!: AffectedPassengersTrendPointDto[];
}

export class CancelledFlightsTrendPointDto {
  @ApiProperty({ description: BUCKET_DESCRIPTION, example: "2026-10-16" })
  bucket!: string;

  @ApiProperty({ description: LABEL_DESCRIPTION, example: "Friday" })
  label!: string;

  @ApiProperty({
    description: "Number of non-draft cancelled flights created in this bucket",
    example: 4,
  })
  flights!: number;
}

export class CancelledFlightsTrendResponseDto extends AirlineTrendResponseDto {
  @ApiProperty({
    type: [CancelledFlightsTrendPointDto],
    description: "One point per bucket, oldest first; empty buckets are 0",
  })
  points!: CancelledFlightsTrendPointDto[];
}
