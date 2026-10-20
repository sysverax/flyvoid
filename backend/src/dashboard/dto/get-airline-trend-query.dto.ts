import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import {
  TIME_FRAME,
  TimeFrame,
} from "../../common/constants/time-frame.constants";

export class GetAirlineTrendQueryDto {
  @ApiProperty({
    description:
      "Reporting window, in the airline's timezone. today: hourly up to the current hour; yesterday: 24 hours; week: last 7 days; month: last 12 months; year: last 6 years.",
    enum: TIME_FRAME,
    example: TIME_FRAME.WEEK,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEnum(TIME_FRAME)
  @IsNotEmpty()
  timeFrame!: TimeFrame;
}
