import { ApiProperty } from "@nestjs/swagger";

export class AdminForgotPasswordVerifyOtpResponseDto {
  @ApiProperty({
    description: "Short-lived token used for password reset",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  resetPasswordToken!: string;

  @ApiProperty({
    description: "Reset token expiry duration",
    example: "10m",
  })
  resetPasswordTokenExpiresIn!: string;
}
