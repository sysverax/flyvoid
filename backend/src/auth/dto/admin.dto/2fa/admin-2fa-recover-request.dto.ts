import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class AdminTwoFactorRecoverRequestDto {
  @ApiProperty({
    description: "Admin email address",
    example: "admin@example.com",
    format: "email",
  })
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "Admin password",
    example: "Password@123",
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    description: "Unused 2FA recovery code",
    example: "A7K9L2Q4R8",
  })
  @IsString()
  @IsNotEmpty()
  recoveryCode!: string;
}
