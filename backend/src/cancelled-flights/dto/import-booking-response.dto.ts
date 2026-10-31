import { ApiProperty } from "@nestjs/swagger";
import { BookingResponseDto } from "./booking-response.dto";

export class BookingFieldErrorDto {
  @ApiProperty({
    example: "email",
    nullable: true,
    description:
      "Field the message is about (pnr, firstName, lastName, email, phone, residency, travelClass, adults, children, childAges, specialNotes); null for the whole row",
  })
  field!: string | null;

  @ApiProperty({ example: "Invalid email format" })
  message!: string;
}

export class FailedBookingValuesDto {
  @ApiProperty({ example: "YYZ001" })
  pnr!: string;

  @ApiProperty({ example: "John" })
  firstName!: string;

  @ApiProperty({ example: "Smith" })
  lastName!: string;

  @ApiProperty({ example: "john.smith1example.com" })
  email!: string;

  @ApiProperty({ example: "14165550101" })
  phone!: string;

  @ApiProperty({
    example: "CA",
    description: "Country code when it was recognised, otherwise the text from the file",
  })
  residency!: string;

  @ApiProperty({
    example: "economy",
    description: "Travel class enum value when recognised, otherwise the text from the file",
  })
  travelClass!: string;

  @ApiProperty({ example: "2" })
  adults!: string;

  @ApiProperty({ example: "1" })
  children!: string;

  @ApiProperty({ type: [String], example: ["7"] })
  childAges!: string[];

  @ApiProperty({ example: "Wheelchair Assistance" })
  specialNotes!: string;
}

export class FailedBookingDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 2, description: "Row in the file (header = row 1)" })
  rowNumber!: number;

  @ApiProperty({ example: "manifest.csv", nullable: true })
  fileName!: string | null;

  @ApiProperty({ type: FailedBookingValuesDto })
  values!: FailedBookingValuesDto;

  @ApiProperty({ type: [BookingFieldErrorDto] })
  errors!: BookingFieldErrorDto[];

  @ApiProperty({ example: "2026-10-31T10:00:00.000Z" })
  createdAt!: string;
}

export class FailedBookingListResponseDto {
  @ApiProperty({ type: [FailedBookingDto] })
  failedBookings!: FailedBookingDto[];
}

export class SummaryDto {
  @ApiProperty({ example: 10, description: "Non-empty rows in the file" })
  totalBookings!: number;

  @ApiProperty({ example: 8, description: "Rows imported as bookings" })
  validBookings!: number;

  @ApiProperty({
    example: 0,
    description:
      "Rows skipped because the same booking (same PNR and details) is already on the flight",
  })
  skippedBookings!: number;

  @ApiProperty({ example: 2, description: "Rows kept as failed bookings" })
  errorBookings!: number;
}

export class ImportBookingResponseDto {
  @ApiProperty({ type: [BookingResponseDto], description: "Bookings created from valid rows" })
  bookings!: BookingResponseDto[];

  @ApiProperty({ type: [FailedBookingDto], description: "Rows that failed, kept to fix or delete" })
  failedBookings!: FailedBookingDto[];

  @ApiProperty({ type: SummaryDto })
  summary!: SummaryDto;
}
