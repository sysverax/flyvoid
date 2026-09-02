import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";

export class AdminTwoFactorDisableRequestDto {
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
