import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class AirlineInitialPasswordResetRequestDto {
  @ApiProperty({
    description: "Initial reset password token from signin challenge",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.initial.password.reset",
  })
  @IsString()
  @IsNotEmpty()
  resetPasswordToken!: string;

  @ApiProperty({
    description:
      "New password with minimum 8 characters containing uppercase, lowercase, number, and special character.",
    example: "NewPassword@123",
    minLength: 8,
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
