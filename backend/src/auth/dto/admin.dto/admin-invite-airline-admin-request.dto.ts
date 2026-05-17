import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class AdminInviteAirlineAdminRequestDto {
  @ApiProperty({
    description: "Airline legal/trade name",
    example: "SkyJet Airways",
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  @Matches(/^[\p{L}\p{N}][\p{L}\p{N}\s&'().-]*$/u, {
    message:
      "airlineName must contain valid letters/numbers and may include spaces or basic punctuation",
  })
  airlineName!: string;

  @ApiProperty({
    description: "Unique airline code",
    example: "SKYJET",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+$/, {
    message: "airlineCode must contain only letters and numbers",
  })
  airlineCode!: string;

  @ApiProperty({
    description: "Airline country code (ISO alpha-2)",
    example: "AE",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{2}$/, {
    message: "countryCode must be a 2-letter uppercase ISO country code",
  })
  countryCode!: string;

  @ApiProperty({
    description: "Optional airline contact email",
    example: "ops@skyjet.com",
    required: false,
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @ApiProperty({
    description: "Optional airline contact phone",
    example: "+971501112233",
    required: false,
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsOptional()
  @MaxLength(30)
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: "contactPhone must be a valid phone number",
  })
  contactPhone?: string;

  @ApiProperty({
    description: "Airline admin first name",
    example: "Aisha",
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[\p{L}][\p{L}\p{M}\s'-]*$/u, {
    message:
      "adminFirstName must contain letters and may include spaces, apostrophes, or hyphens",
  })
  adminFirstName!: string;

  @ApiProperty({
    description: "Airline admin last name",
    example: "Khan",
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[\p{L}][\p{L}\p{M}\s'-]*$/u, {
    message:
      "adminLastName must contain letters and may include spaces, apostrophes, or hyphens",
  })
  adminLastName!: string;

  @ApiProperty({
    description: "Airline admin email",
    example: "aisha.khan@skyjet.com",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  adminEmail!: string;
}
