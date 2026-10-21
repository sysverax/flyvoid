import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Matches, Max, Min } from "class-validator";

export class HotelRecommendationsQueryDto {
  @ApiPropertyOptional({
    description: "Search radius around the departure airport (HOTEL_SEARCH_RADIUS_UNIT, km by default)",
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(70)
  radius?: number;

  @ApiPropertyOptional({
    description: "Room split as adults-children per room, comma-separated; defaults to the recommended split",
    example: "2-0,2-0,1-1",
  })
  @IsOptional()
  @Matches(/^\d+-\d+(,\d+-\d+){0,8}$/, {
    message: "rooms must look like 2-0,1-1 (adults-children per room, up to 9 rooms)",
  })
  rooms?: string;
}
