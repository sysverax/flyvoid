import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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
    description: "Company registration number",
    example: "CRN-12345",
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(100)
  companyRegistrationNumber!: string;

  @ApiProperty({
    description: "Airline website",
    example: "https://skyjet.example",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @ApiProperty({
    description: "Airline contact email",
    example: "ops@skyjet.com",
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  contactEmail!: string;

  @ApiProperty({
    description: "Airline contact phone",
    example: "+971501112233",
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: "contactPhone must be a valid phone number",
  })
  contactPhone!: string;

  @ApiProperty({
    description: "Airline timezone",
    example: "Asia/Dubai",
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(100)
  timezone!: string;

  @ApiProperty({
    description: "Airline logo URL or file reference",
    example: "https://cdn.example.com/skyjet-logo.png",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  logo?: string;

  @ApiProperty({ description: "Airline registered address", example: "Airport Rd, Dubai" })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;

  @ApiProperty({ description: "Airline operating currency", example: "AED" })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsNotEmpty()
  @MaxLength(10)
  currency!: string;


  @ApiProperty({ description: "Airline admin first name", example: "Aisha" })
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

  @ApiProperty({ description: "Airline admin last name", example: "Khan" })
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

  @ApiProperty({ description: "Airline admin email", example: "aisha.khan@skyjet.com" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  adminEmail!: string;

  @ApiProperty({ description: "Airline admin job title", example: "Country Manager" })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(100)
  jobTitle!: string;

  @ApiProperty({ description: "Initial credit limit for the airline wallet (in cents or base currency units)", example: 500000, required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditLimit?: number;
}
