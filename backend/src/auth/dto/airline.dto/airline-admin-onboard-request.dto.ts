import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";

export class AirlineAdminOnboardRequestDto {
  @ApiProperty({
    description: "Airline admin invitation token from onboarding link",
    example: "4f590ac03d2f4f4dbcf31c8a5f9c2e9d1f4a6e9b5c0d1e2f3a4b5c6d7e8f9a0b",
  })
  @IsString()
  @IsNotEmpty()
  invitationToken!: string;

  @ApiProperty({
    description:
      "New password with minimum 8 characters containing uppercase, lowercase, number, and special character.",
    example: "Password@123",
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message:
      "password must include uppercase, lowercase, number, and special character",
  })
  password!: string;
}
