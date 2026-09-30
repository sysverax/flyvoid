import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CheckRateRequestDto {
  @ApiProperty({
    description: "The unique rate key returned by the availability/recommendations search",
    example: "rate-key-from-hotel-search",
  })
  @IsNotEmpty()
  @IsString()
  rateKey!: string;
}
