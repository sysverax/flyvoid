import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class AirlineForgotPasswordResetRequestDto {
  @ApiProperty({ description: "Reset password token from verify-otp API" })
  @IsString()
  @IsNotEmpty()
  resetPasswordToken!: string;

  @ApiProperty({
    description:
      "New password with minimum 8 characters containing uppercase, lowercase, number, and special character.",
    example: "Password@123",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message:
      "newPassword must include uppercase, lowercase, number, and special character",
  })
  newPassword!: string;
}
