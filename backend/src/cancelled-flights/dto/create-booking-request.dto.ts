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
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { TravelClass } from "../entities/enums";
import {
  IsPassportCountry,
  normalizeCountryCode,
} from "../passport-country";
import { MAX_CHILD_AGE } from "../cancelled-flights.constants";

/**
 * Booking field rules, shared by the API (create/update), the CSV import and
 * fixing a failed CSV row, so all three accept exactly the same values.
 * The airline portal's form checks the same rules
 * (frontend/airline/src/lib/booking-fields.ts).
 */
export const BOOKING_FIELD_RULES = {
  pnrMaxLength: 20,
  nameMaxLength: 100,
  emailMaxLength: 255,
  phoneMaxLength: 30,
  // Optional leading +, then 7-20 digits, spaces, dashes or brackets.
  phonePattern: /^\+?[\d\s\-()]{7,20}$/,
} as const;

export const BOOKING_MESSAGES = {
  pnrRequired: "PNR is required",
  pnrTooLong: `PNR must be at most ${BOOKING_FIELD_RULES.pnrMaxLength} characters`,
  firstNameRequired: "First Name is required",
  firstNameTooLong: `First Name must be at most ${BOOKING_FIELD_RULES.nameMaxLength} characters`,
  lastNameRequired: "Last Name is required",
  lastNameTooLong: `Last Name must be at most ${BOOKING_FIELD_RULES.nameMaxLength} characters`,
  emailInvalid: "Invalid email format",
  emailTooLong: `Email must be at most ${BOOKING_FIELD_RULES.emailMaxLength} characters`,
  phoneRequired: "Phone is required",
  phoneInvalid:
    "Phone must be 7-20 digits, spaces, dashes or brackets, optionally starting with +",
  residencyInvalid:
    "Passport Country must be a country name or 2-letter code (e.g. United States or US)",
  travelClassInvalid:
    "Select Economy, Premium Economy, Business or First Class",
  adultsInvalid: "Adults must be a whole number, at least 1",
  childrenInvalid: "Children must be a whole number, 0 or more",
  childAgesInvalid: `Each child age must be a whole number from 0 to ${MAX_CHILD_AGE}`,
  notesInvalid: "Special Notes must be text",
} as const;

export class CreateBookingDto {
  @ApiProperty({ example: "ABC123", maxLength: BOOKING_FIELD_RULES.pnrMaxLength })
  @IsString({ message: BOOKING_MESSAGES.pnrRequired })
  @IsNotEmpty({ message: BOOKING_MESSAGES.pnrRequired })
  @MaxLength(BOOKING_FIELD_RULES.pnrMaxLength, {
    message: BOOKING_MESSAGES.pnrTooLong,
  })
  pnr!: string;

  @ApiProperty({ example: "John", maxLength: BOOKING_FIELD_RULES.nameMaxLength })
  @IsString({ message: BOOKING_MESSAGES.firstNameRequired })
  @IsNotEmpty({ message: BOOKING_MESSAGES.firstNameRequired })
  @MaxLength(BOOKING_FIELD_RULES.nameMaxLength, {
    message: BOOKING_MESSAGES.firstNameTooLong,
  })
  firstName!: string;

  @ApiProperty({ example: "Doe", maxLength: BOOKING_FIELD_RULES.nameMaxLength })
  @IsString({ message: BOOKING_MESSAGES.lastNameRequired })
  @IsNotEmpty({ message: BOOKING_MESSAGES.lastNameRequired })
  @MaxLength(BOOKING_FIELD_RULES.nameMaxLength, {
    message: BOOKING_MESSAGES.lastNameTooLong,
  })
  lastName!: string;

  @ApiProperty({
    example: "john.doe@email.com",
    maxLength: BOOKING_FIELD_RULES.emailMaxLength,
  })
  @IsEmail({}, { message: BOOKING_MESSAGES.emailInvalid })
  @MaxLength(BOOKING_FIELD_RULES.emailMaxLength, {
    message: BOOKING_MESSAGES.emailTooLong,
  })
  email!: string;

  @ApiProperty({ example: "+1 555-0101" })
  @IsString({ message: BOOKING_MESSAGES.phoneRequired })
  @IsNotEmpty({ message: BOOKING_MESSAGES.phoneRequired })
  @Matches(BOOKING_FIELD_RULES.phonePattern, {
    message: BOOKING_MESSAGES.phoneInvalid,
  })
  phone!: string;

  @ApiProperty({
    example: "US",
    description: "Passport country (ISO 3166-1 alpha-2)",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? (normalizeCountryCode(value) ?? value) : value,
  )
  @IsPassportCountry({ message: BOOKING_MESSAGES.residencyInvalid })
  residency!: string;

  @ApiProperty({ enum: TravelClass })
  @IsEnum(TravelClass, { message: BOOKING_MESSAGES.travelClassInvalid })
  travelClass!: TravelClass;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt({ message: BOOKING_MESSAGES.adultsInvalid })
  @Min(1, { message: BOOKING_MESSAGES.adultsInvalid })
  adults!: number;

  @ApiProperty({ example: 1, minimum: 0, default: 0 })
  @IsInt({ message: BOOKING_MESSAGES.childrenInvalid })
  @Min(0, { message: BOOKING_MESSAGES.childrenInvalid })
  children!: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [4],
    description: `One age per child, each 0-${MAX_CHILD_AGE}. Required when children > 0; its length must equal children.`,
  })
  @IsOptional()
  @IsArray({ message: BOOKING_MESSAGES.childAgesInvalid })
  @IsInt({ each: true, message: BOOKING_MESSAGES.childAgesInvalid })
  @Min(0, { each: true, message: BOOKING_MESSAGES.childAgesInvalid })
  @Max(MAX_CHILD_AGE, { each: true, message: BOOKING_MESSAGES.childAgesInvalid })
  childAges?: number[];

  @ApiPropertyOptional({
    example: "Wheelchair Assistance, Late Arrival, Needs a baby cot",
    description:
      "Special Notes as one comma-separated text: preset labels (Wheelchair Assistance, Medical Needs, Infant, Late Arrival, Dietary Requirements, Elderly Passenger) and/or free text. Presets listed here set specialNotes in the response.",
  })
  @IsOptional()
  @IsString({ message: BOOKING_MESSAGES.notesInvalid })
  specialNotes?: string;
}
