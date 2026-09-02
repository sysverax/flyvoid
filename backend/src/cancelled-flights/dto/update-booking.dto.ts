import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";
import { SpecialNote, TravelClass } from "../entities/enums";

export class UpdateBookingDto {
  @ApiPropertyOptional({ example: "ABC123" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  pnr?: string;

  @ApiPropertyOptional({ example: "John" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @ApiPropertyOptional({ example: "john.doe@email.com" })
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @ApiPropertyOptional({ example: "+1 555-0101" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @ApiPropertyOptional({ enum: TravelClass })
  @IsOptional()
  @IsEnum(TravelClass)
  travelClass?: TravelClass;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  // null clears the field
  @ApiPropertyOptional({
    description:
      "Special notes for the booking. Set to null to clear the field.",
    enum: SpecialNote,
    isArray: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: UpdateBookingDto) => o.specialNotes !== null)
  @IsArray()
  @IsEnum(SpecialNote, { each: true })
  specialNotes?: SpecialNote[] | null;

  // null clears the field
  @ApiPropertyOptional({
    description:
      "Additional notes for the booking. Set to null to clear the field.",
    example: "Passenger requires window seat",
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: UpdateBookingDto) => o.additionalNotes !== null)
  @IsString()
  additionalNotes?: string | null;
}
