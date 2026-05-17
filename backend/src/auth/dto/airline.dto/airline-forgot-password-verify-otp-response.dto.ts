import { ApiProperty } from "@nestjs/swagger";

export class AirlineForgotPasswordVerifyOtpResponseDto {
  @ApiProperty()
  resetPasswordToken!: string;

  @ApiProperty({ example: "1h" })
  resetPasswordTokenExpiresIn!: string;
}
