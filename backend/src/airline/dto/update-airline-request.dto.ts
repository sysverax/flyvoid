import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateAirlineRequestDto {
  @ApiPropertyOptional({ example: "SkyJet Airways", minLength: 2, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: "SKYJET", minLength: 2, maxLength: 20 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: "AE", minLength: 2, maxLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  countryCode?: string;

  @ApiPropertyOptional({ example: "CRN-001234", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  companyRegistrationNumber?: string;

  @ApiPropertyOptional({
    example: "https://skyjet.com",
    nullable: true,
    description: "Set to null to remove the website URL",
  })
  @IsOptional()
  @ValidateIf((o) => o.website !== null)
  @IsString()
  @MaxLength(255)
  website?: string | null;

  @ApiPropertyOptional({ example: "ops@skyjet.com" })
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: "+971501112233", maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @ApiPropertyOptional({ example: "Asia/Dubai", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({
    example: "https://cdn.example.com/logo.png",
    nullable: true,
    description: "Set to null to remove the logo URL",
  })
  @IsOptional()
  @ValidateIf((o) => o.logo !== null)
  @IsString()
  @MaxLength(512)
  logo?: string | null;

  @ApiPropertyOptional({ example: "AED", maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ example: "Dubai Airport Free Zone, Dubai, UAE", maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: true, description: "Set to false to deactivate the airline" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, description: "Set to true to suspend the airline" })
  @IsOptional()
  @IsBoolean()
  isSuspended?: boolean;

  @ApiPropertyOptional({ example: "Aisha", minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  adminFirstName?: string;

  @ApiPropertyOptional({ example: "Khan", minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  adminLastName?: string;

  @ApiPropertyOptional({ example: "admin@skyjet.com" })
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  @IsEmail()
  adminEmail?: string;

  @ApiPropertyOptional({ example: "Airline Administrator", minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  adminJobTitle?: string;
}
