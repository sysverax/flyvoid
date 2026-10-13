import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { SpecialNote, TravelClass } from "../entities/enums";
import {
  IsPassportCountry,
  normalizeCountryCode,
} from "../passport-country";

export class CreateBookingDto {
  @ApiProperty({ example: "ABC123" })
  @IsNotEmpty()
  @IsString()
  pnr!: string;

  @ApiProperty({ example: "John" })
  @IsNotEmpty()
  @IsString()
  firstName!: string;

  @ApiProperty({ example: "Doe" })
  @IsNotEmpty()
  @IsString()
  lastName!: string;

  @ApiProperty({ example: "john.doe@email.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "+1 555-0101" })
  @IsNotEmpty()
  @IsString()
  phone!: string;

  @ApiProperty({
    example: "US",
    description: "Passport country (ISO 3166-1 alpha-2)",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? (normalizeCountryCode(value) ?? value) : value,
  )
  @IsPassportCountry()
  residency!: string;

  @ApiProperty({ enum: TravelClass })
  @IsEnum(TravelClass)
  travelClass!: TravelClass;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  adults!: number;

  @ApiProperty({ example: 1, minimum: 0, default: 0 })
  @IsInt()
  @Min(0)
  children!: number;

  @ApiPropertyOptional({ enum: SpecialNote, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(SpecialNote, { each: true })
  specialNotes?: SpecialNote[];

  @ApiPropertyOptional({ example: "Passenger requires window seat" })
  @IsOptional()
  @IsString()
  additionalNotes?: string;
}
