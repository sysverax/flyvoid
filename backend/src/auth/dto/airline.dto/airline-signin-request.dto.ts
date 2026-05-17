import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class AirlineSigninRequestDto {
  @ApiProperty({
    description: "Airline user email",
    example: "aisha.khan@skyjet.com",
  })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "Airline user password",
    example: "Password@123",
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
