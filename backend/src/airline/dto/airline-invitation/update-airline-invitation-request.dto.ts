import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdateAirlineInvitationRequestDto {
  @ApiPropertyOptional({
    description: "Airline legal/trade name",
    example: "SkyJet Airways",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MinLength(2)
  @MaxLength(150)
  @Matches(/^[\p{L}\p{N}][\p{L}\p{N}\s&'().-]*$/u, {
    message:
      "airlineName must contain valid letters/numbers and may include spaces or basic punctuation",
  })
  airlineName?: string;

  @ApiPropertyOptional({
    description: "Unique airline code",
    example: "SKYJET",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+$/, {
    message: "airlineCode must contain only letters and numbers",
  })
  airlineCode?: string;

  @ApiPropertyOptional({
    description: "Airline country code (ISO alpha-2)",
    example: "AE",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/, {
    message: "countryCode must be a 2-letter uppercase ISO country code",
  })
  countryCode?: string;

  @ApiPropertyOptional({
    description: "Company registration number",
    example: "CRN-12345",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MaxLength(100)
  companyRegistrationNumber?: string;

  @ApiPropertyOptional({
    description: "Airline website (set to null to clear)",
    example: "https://skyjet.example",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string | null;

  @ApiPropertyOptional({
    description: "Airline contact email",
    example: "ops@skyjet.com",
  })
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  )
  contactEmail?: string;

  @ApiPropertyOptional({
    description: "Airline contact phone",
    example: "+971501112233",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MaxLength(30)
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: "contactPhone must be a valid phone number",
  })
  contactPhone?: string;

  @ApiPropertyOptional({
    description: "Airline timezone",
    example: "Asia/Dubai",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({
    description: "Airline operating currency",
    example: "AED",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({
    description: "Airline registered address",
    example: "Airport Rd, Dubai",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    description: "Airline logo URL (set to null to clear)",
    example: "https://cdn.example.com/skyjet-logo.png",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  logo?: string | null;

  @ApiPropertyOptional({
    description:
      "Initial credit limit for the airline wallet (in base currency units)",
    example: 500000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({
    description: "Invited admin first name",
    example: "Aisha",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[\p{L}][\p{L}\p{M}\s'-]*$/u, {
    message:
      "adminFirstName must contain letters and may include spaces, apostrophes, or hyphens",
  })
  adminFirstName?: string;

  @ApiPropertyOptional({
    description: "Invited admin last name",
    example: "Khan",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[\p{L}][\p{L}\p{M}\s'-]*$/u, {
    message:
      "adminLastName must contain letters and may include spaces, apostrophes, or hyphens",
  })
  adminLastName?: string;

  @ApiPropertyOptional({
    description: "Invited admin email",
    example: "aisha.khan@skyjet.com",
  })
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.toLowerCase().trim() : value,
  )
  adminEmail?: string;

  @ApiPropertyOptional({
    description: "Invited admin job title",
    example: "Country Manager",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MaxLength(100)
  jobTitle?: string;
}
