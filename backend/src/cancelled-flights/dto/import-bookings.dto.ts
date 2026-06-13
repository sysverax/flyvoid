import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { SpecialNote, TravelClass } from "../entities/enums";

export class ImportBookingRowDto {
  @IsInt()
  row!: number;

  @IsNotEmpty()
  @IsString()
  pnr!: string;

  @IsNotEmpty()
  @IsString()
  first_name!: string;

  @IsNotEmpty()
  @IsString()
  last_name!: string;

  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  phone!: string;

  @IsEnum(TravelClass)
  travel_class!: TravelClass;

  @IsInt()
  @Min(1)
  adults!: number;

  @IsInt()
  @Min(0)
  children!: number;

  @IsOptional()
  @IsArray()
  @IsEnum(SpecialNote, { each: true })
  special_notes?: SpecialNote[];

  @IsOptional()
  @IsString()
  additional_notes?: string;
}

export class ImportBookingsConfirmDto {
  @ApiProperty({ type: [ImportBookingRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportBookingRowDto)
  rows!: ImportBookingRowDto[];
}
