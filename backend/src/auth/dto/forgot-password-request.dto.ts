import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class ForgotPasswordRequestDto {
  @ApiProperty({
    type: String,
    description: "Admin account email for password reset OTP",
    example: "admin@example.com",
    format: "email",
  })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
