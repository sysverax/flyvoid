import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class AdminForgotPasswordResetRequestDto {
  @ApiProperty({
    description: "Reset password token received from verify-otp API",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @IsNotEmpty()
  @IsString()
  resetPasswordToken!: string;

  @ApiProperty({
    description:
      "New password with minimum 8 characters containing uppercase, lowercase, number, and special character.",
    example: "Password@123",
    minLength: 8,
    pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).+$",
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
