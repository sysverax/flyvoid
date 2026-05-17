import { ApiProperty } from "@nestjs/swagger";
import { AdminProfileDto } from "../../../admin/dto";

export class AdminSigninTwoFactorChallengeResponseDto {
  @ApiProperty({
    description: "Indicates 2FA verification is required",
    example: true,
  })
  requiresTwoFactor!: boolean;

  @ApiProperty({
    description: "Short-lived token used for 2FA verification step",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.2fa.challenge",
  })
  twoFactorToken!: string;

  @ApiProperty({
    description: "Configured 2FA challenge token expiry",
    example: "5m",
  })
  twoFactorTokenExpiresIn!: string;

  @ApiProperty({
    description: "Admin profile associated with the challenge",
    type: AdminProfileDto,
  })
  admin!: AdminProfileDto;
}
