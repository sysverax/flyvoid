import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

export class CreateBookingDto {
  @ApiProperty({ example: "ABC123" })
  @IsNotEmpty()
  @IsString()
  pnr!: string;

  @ApiProperty({ example: "John" })
  @IsNotEmpty()
  @IsString()
  first_name!: string;

  @ApiProperty({ example: "Doe" })
  @IsNotEmpty()
  @IsString()
  last_name!: string;

  @ApiProperty({ example: "john.doe@email.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "+1 555-0101" })
  @IsNotEmpty()
  @IsString()
  phone!: string;

  @ApiProperty({ enum: TravelClass })
  @IsEnum(TravelClass)
  travel_class!: TravelClass;

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
  special_notes?: SpecialNote[];

  @ApiPropertyOptional({ example: "Passenger requires window seat" })
  @IsOptional()
  @IsString()
  additional_notes?: string;
}
