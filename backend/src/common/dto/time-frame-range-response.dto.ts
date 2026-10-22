import { ApiProperty } from "@nestjs/swagger";
import {
  TIME_FRAME,
  TimeFrame,
} from "../constants/time-frame.constants";

// Response fields telling the frontend exactly which range a time-frame API
// used. Fill them with describeTimeFrameRange() from time-frame.util.ts.

export const TIME_FRAME_RANGE_DOCS = {
  timeFrame: { enum: TIME_FRAME, example: TIME_FRAME.WEEK },
  timezone: {
    description: "IANA timezone the range was computed in (the request `timezone`)",
    example: "Asia/Colombo",
  },
  startDate: {
    description: "Start of the range (inclusive), local time in `timezone` with offset",
    example: "2026-10-16T00:00:00+05:30",
  },
  endDate: {
    description:
      "Last second inside the range (the exclusive end minus 1 second), local time in `timezone` with offset",
    example: "2026-10-22T23:59:59+05:30",
  },
};

export class TimeFrameRangeResponseDto {
  @ApiProperty(TIME_FRAME_RANGE_DOCS.timeFrame)
  timeFrame!: TimeFrame;

  @ApiProperty(TIME_FRAME_RANGE_DOCS.timezone)
  timezone!: string;

  @ApiProperty(TIME_FRAME_RANGE_DOCS.startDate)
  startDate!: string;

  @ApiProperty(TIME_FRAME_RANGE_DOCS.endDate)
  endDate!: string;
}
