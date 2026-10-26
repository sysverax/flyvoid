import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class GetHotelProvidersQueryDto {
  @ApiPropertyOptional({
    description: "Only active (true) or inactive (false) providers; all when omitted",
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean({ message: "isActive must be true or false" })
  isActive?: boolean;
}

export class HotelProviderDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: "RATEHAWK" })
  code!: string;

  @ApiProperty({ example: "RateHawk" })
  name!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class HotelProviderListResponseDto {
  @ApiProperty({ type: [HotelProviderDto] })
  providers!: HotelProviderDto[];
}
