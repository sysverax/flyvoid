import { ApiProperty } from "@nestjs/swagger";
import {
  TIME_FRAME,
  TimeFrame,
  TREND_GRANULARITY,
  TrendGranularity,
} from "../../common/constants/time-frame.constants";

const BUCKET_DESCRIPTION =
  'Bucket start in the airline\'s timezone: "2026-10-21T14:00" (hour), "2026-10-21" (day), "2026-10" (month) or "2026" (year)';

const LABEL_DESCRIPTION =
  'Display label for the bucket: "14:00" (hour), weekday name such as "Monday" (day, i.e. week), month name such as "October" (month) or "2026" (year)';

export class AirlineTrendResponseDto {
  @ApiProperty({ enum: TIME_FRAME, example: TIME_FRAME.WEEK })
  timeFrame!: TimeFrame;

  @ApiProperty({ enum: TREND_GRANULARITY, example: TREND_GRANULARITY.DAY })
  granularity!: TrendGranularity;

  @ApiProperty({
    description:
      "IANA timezone the buckets are computed in (the airline's timezone, or UTC if it is not set)",
    example: "Asia/Colombo",
  })
  timezone!: string;

  @ApiProperty({
    description: "Start of the window (inclusive), in the airline's timezone",
    example: "2026-10-15T00:00:00+05:30",
  })
  startDate!: string;

  @ApiProperty({
    description: "End of the window (inclusive), in the airline's timezone",
    example: "2026-10-21T23:59:59+05:30",
  })
  endDate!: string;
}

export class HotelSpendTrendPointDto {
  @ApiProperty({ description: BUCKET_DESCRIPTION, example: "2026-10-16" })
  bucket!: string;

  @ApiProperty({ description: LABEL_DESCRIPTION, example: "Friday" })
  label!: string;

  @ApiProperty({
    description:
      "Total hotel cost (including tax and platform fee) of allocated, paid and published flights",
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
    description: "Adults plus children on non-draft cancelled flights",
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
    description: "Number of non-draft cancelled flights",
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
