import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class AirlineForgotPasswordSendOtpRequestDto {
  @ApiProperty({ example: "aisha.khan@skyjet.com" })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
