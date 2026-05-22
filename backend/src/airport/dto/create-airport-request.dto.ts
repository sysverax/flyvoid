import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { AirportType } from "../entities/airport.entity";

export class CreateAirportRequestDto {
  @ApiProperty({ example: "Dubai International Airport" })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: "DXB" })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Length(3, 3)
  iataCode!: string;

  @ApiProperty({ example: "OMDB" })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Length(4, 4)
  icaoCode!: string;

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

  @ApiProperty({ example: "Dubai" })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 25.2532 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? Number(value) : value,
  )
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 55.3657 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? Number(value) : value,
  )
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ example: "Asia/Dubai" })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(100)
  timezone!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ enum: AirportType, example: AirportType.INTERNATIONAL })
  @IsEnum(AirportType)
  type!: AirportType;

  @ApiProperty({ example: "Airport Road", required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MaxLength(255)
  address?: string;

  @ApiProperty({ example: "00000", required: false })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @MaxLength(20)
  postalCode!: string;
}
