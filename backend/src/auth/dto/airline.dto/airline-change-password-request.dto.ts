import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class AirlineChangePasswordRequestDto {
  @ApiProperty({
    description: "Current account password",
    example: "CurrentPassword@123",
  })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

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
