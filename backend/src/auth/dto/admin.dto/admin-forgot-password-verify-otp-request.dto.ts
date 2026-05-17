import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from "class-validator";

export class AdminForgotPasswordVerifyOtpRequestDto {
  @ApiProperty({
    description: "Admin email address used for OTP request",
    example: "admin@example.com",
    format: "email",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "6-digit numeric OTP",
    example: "444444",
    minLength: 6,
    maxLength: 6,
    pattern: "^[0-9]{6}$",
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: "otp must contain exactly 6 digits" })
  otp!: string;
}
