import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class AdminForgotPasswordSendOtpRequestDto {
  @ApiProperty({
    description: "Admin email address for OTP delivery",
    example: "admin@example.com",
    format: "email",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
