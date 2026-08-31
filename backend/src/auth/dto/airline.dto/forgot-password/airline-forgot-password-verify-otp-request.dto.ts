import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from "class-validator";

export class AirlineForgotPasswordVerifyOtpRequestDto {
  @ApiProperty({ example: "aisha.khan@skyjet.com" })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: "444444" })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp!: string;
}
