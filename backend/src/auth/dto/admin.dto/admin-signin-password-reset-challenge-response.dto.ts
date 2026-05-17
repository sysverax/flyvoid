import { ApiProperty } from "@nestjs/swagger";
import { AdminProfileDto } from "../../../admin/dto";

export class AdminSigninPasswordResetChallengeResponseDto {
  @ApiProperty({
    description:
      "Indicates initial password reset is required before session issuance",
    example: true,
  })
  requiresPasswordReset!: boolean;

  @ApiProperty({
    description: "Short-lived token used for initial password reset step",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.initial.password.reset",
  })
  resetPasswordToken!: string;

  @ApiProperty({
    description: "Configured initial password reset token expiry",
    example: "15m",
  })
  resetPasswordTokenExpiresIn!: string;

  @ApiProperty({
    description: "Admin profile associated with the challenge",
    type: AdminProfileDto,
  })
  admin!: AdminProfileDto;
}
