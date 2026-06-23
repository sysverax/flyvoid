import { ApiProperty } from "@nestjs/swagger";
import { AirlineRole } from "../../../common/constants/user.constants";

class AirlineSigninPasswordResetProfileDto {
  @ApiProperty({ example: 201 })
  id!: number;

  @ApiProperty({ example: 12 })
  airlineId!: number;

  @ApiProperty({ example: "Aisha" })
  firstName!: string;

  @ApiProperty({ example: "Khan" })
  lastName!: string;

  @ApiProperty({ example: "aisha.khan@skyjet.com" })
  email!: string;

  @ApiProperty({ enum: AirlineRole, example: AirlineRole.AIRLINE_STAFF })
  role!: AirlineRole;
}

export class AirlineSigninPasswordResetChallengeResponseDto {
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
    description: "Airline user profile associated with the challenge",
    type: AirlineSigninPasswordResetProfileDto,
  })
  user!: AirlineSigninPasswordResetProfileDto;
}
