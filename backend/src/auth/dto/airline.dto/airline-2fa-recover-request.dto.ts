import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class AirlineTwoFactorRecoverRequestDto {
  @ApiProperty({ example: "aisha.khan@skyjet.com" })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: "Password@123" })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: "ABCD2EFGH3" })
  @Transform(({ value }: { value: string }) => value.trim().toUpperCase())
  @IsString()
  @IsNotEmpty()
  recoveryCode!: string;
}
