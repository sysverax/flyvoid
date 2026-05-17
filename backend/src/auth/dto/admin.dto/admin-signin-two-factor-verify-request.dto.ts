import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length, Matches } from "class-validator";

export class AdminSigninTwoFactorVerifyRequestDto {
  @ApiProperty({
    description: "2FA challenge token returned by signin API",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.2fa.challenge",
  })
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;

  @ApiProperty({
    description: "6-digit authenticator app code",
    example: "123456",
    minLength: 6,
    maxLength: 6,
    pattern: "^[0-9]{6}$",
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  twoFactorCode!: string;
}
