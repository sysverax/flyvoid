import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class AdminTwoFactorRecoverRequestDto {
  @ApiProperty({
    description: "2FA challenge token returned by signin API",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.2fa.challenge",
  })
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;

  @ApiProperty({
    description: "Unused 2FA recovery code",
    example: "A7K9L2Q4R8",
  })
  @IsString()
  @IsNotEmpty()
  recoveryCode!: string;
}
