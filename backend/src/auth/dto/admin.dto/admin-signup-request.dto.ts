import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class AdminSignupRequestDto {
  @ApiProperty({
    description: "Admin first name",
    example: "John",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[\p{L}][\p{L}\p{M}\s'-]*$/u, {
    message:
      "firstName must contain letters and may include spaces, apostrophes, or hyphens",
  })
  firstName!: string;

  @ApiProperty({
    description: "Admin last name",
    example: "Doe",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[\p{L}][\p{L}\p{M}\s'-]*$/u, {
    message:
      "lastName must contain letters and may include spaces, apostrophes, or hyphens",
  })
  lastName!: string;

  @ApiProperty({
    description: "Admin email address. Automatically normalized to lowercase.",
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
    description:
      "Password with minimum 8 characters containing uppercase, lowercase, number, and special character.",
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
