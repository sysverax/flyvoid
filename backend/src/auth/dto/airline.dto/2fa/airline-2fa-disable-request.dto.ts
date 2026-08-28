import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length, Matches } from "class-validator";

export class AirlineTwoFactorDisableRequestDto {
  @ApiProperty({
    description: "6-digit authenticator app code",
    example: "123456",
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  twoFactorCode!: string;
}
