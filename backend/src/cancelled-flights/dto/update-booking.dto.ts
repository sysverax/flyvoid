import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { TravelClass } from "../entities/enums";
import {
  IsPassportCountry,
  normalizeCountryCode,
} from "../passport-country";
import { MAX_CHILD_AGE } from "../cancelled-flights.constants";
import {
  BOOKING_FIELD_RULES,
  BOOKING_MESSAGES,
  normalizePnr,
} from "./create-booking-request.dto";

export class UpdateBookingDto {
  @ApiPropertyOptional({ example: "ABC123" })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? normalizePnr(value) : value,
  )
  @IsString({ message: BOOKING_MESSAGES.pnrRequired })
  @IsNotEmpty({ message: BOOKING_MESSAGES.pnrRequired })
  @MaxLength(BOOKING_FIELD_RULES.pnrMaxLength, {
    message: BOOKING_MESSAGES.pnrTooLong,
  })
  pnr?: string;

  @ApiPropertyOptional({ example: "John" })
  @IsOptional()
  @IsString({ message: BOOKING_MESSAGES.firstNameRequired })
  @IsNotEmpty({ message: BOOKING_MESSAGES.firstNameRequired })
  @MaxLength(BOOKING_FIELD_RULES.nameMaxLength, {
    message: BOOKING_MESSAGES.firstNameTooLong,
  })
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString({ message: BOOKING_MESSAGES.lastNameRequired })
  @IsNotEmpty({ message: BOOKING_MESSAGES.lastNameRequired })
  @MaxLength(BOOKING_FIELD_RULES.nameMaxLength, {
    message: BOOKING_MESSAGES.lastNameTooLong,
  })
  lastName?: string;

  @ApiPropertyOptional({ example: "john.doe@email.com" })
  @IsOptional()
  @IsEmail({}, { message: BOOKING_MESSAGES.emailInvalid })
  @MaxLength(BOOKING_FIELD_RULES.emailMaxLength, {
    message: BOOKING_MESSAGES.emailTooLong,
  })
  email?: string;

  @ApiPropertyOptional({ example: "+1 555-0101" })
  @IsOptional()
  @IsString({ message: BOOKING_MESSAGES.phoneRequired })
  @IsNotEmpty({ message: BOOKING_MESSAGES.phoneRequired })
  @Matches(BOOKING_FIELD_RULES.phonePattern, {
    message: BOOKING_MESSAGES.phoneInvalid,
  })
  phone?: string;

  @ApiPropertyOptional({
    example: "US",
    description: "Passport country (ISO 3166-1 alpha-2)",
  })
  // Can be changed but never cleared, so only an omitted field skips validation.
  @ValidateIf((o: UpdateBookingDto) => o.residency !== undefined)
  @Transform(({ value }) =>
    typeof value === "string" ? (normalizeCountryCode(value) ?? value) : value,
  )
  @IsPassportCountry({ message: BOOKING_MESSAGES.residencyInvalid })
  residency?: string;

  @ApiPropertyOptional({ enum: TravelClass })
  @IsOptional()
  @IsEnum(TravelClass, { message: BOOKING_MESSAGES.travelClassInvalid })
  travelClass?: TravelClass;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt({ message: BOOKING_MESSAGES.adultsInvalid })
  @Min(1, { message: BOOKING_MESSAGES.adultsInvalid })
  adults?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsOptional()
  @IsInt({ message: BOOKING_MESSAGES.childrenInvalid })
  @Min(0, { message: BOOKING_MESSAGES.childrenInvalid })
  children?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [4],
    description: `One age per child, each 0-${MAX_CHILD_AGE}. Send it whenever children changes; its length must equal the booking's children.`,
  })
  @IsOptional()
  @IsArray({ message: BOOKING_MESSAGES.childAgesInvalid })
  @IsInt({ each: true, message: BOOKING_MESSAGES.childAgesInvalid })
  @Min(0, { each: true, message: BOOKING_MESSAGES.childAgesInvalid })
  @Max(MAX_CHILD_AGE, { each: true, message: BOOKING_MESSAGES.childAgesInvalid })
  childAges?: number[];

  // null clears the field
  @ApiPropertyOptional({
    description:
      "Special Notes as one comma-separated text (preset labels and/or free text). Set to null to clear.",
    example: "Wheelchair Assistance, Needs a baby cot",
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: UpdateBookingDto) => o.specialNotes !== null)
  @IsString({ message: BOOKING_MESSAGES.notesInvalid })
  specialNotes?: string | null;
}
