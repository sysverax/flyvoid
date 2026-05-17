import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length, Matches } from "class-validator";

export class AirlineSigninTwoFactorVerifyRequestDto {
  @ApiProperty({ description: "2FA challenge token from signin response" })
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;

  @ApiProperty({
    description: "6-digit authenticator app code",
    example: "123456",
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  twoFactorCode!: string;
}
