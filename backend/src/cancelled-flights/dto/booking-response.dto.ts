import { ApiProperty } from "@nestjs/swagger";
import { TravelClass } from "../entities/enums";

export class ParentBookingResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  cancelledFlightId!: number;

  @ApiProperty({ example: "ABC123" })
  pnr!: string;

  @ApiProperty({ example: "John" })
  firstName!: string;

  @ApiProperty({ example: "Doe" })
  lastName!: string;

  @ApiProperty({ example: "john.doe@example.com" })
  email!: string;

  @ApiProperty({ example: "+1234567890" })
  phone!: string;

  @ApiProperty({
    example: "US",
    description: "Passport country (ISO 3166-1 alpha-2)",
  })
  residency!: string;

  @ApiProperty({ example: "Economy" })
  travelClass!: TravelClass;

  @ApiProperty({ example: 2 })
  adults!: number;

  @ApiProperty({ example: 1 })
  children!: number;
}

export class BookingResponseDto extends ParentBookingResponseDto {
  @ApiProperty({
    type: [Number],
    example: [4],
    description: "One age per child (0-12)",
  })
  childAges!: number[];

  @ApiProperty({
    example: "Wheelchair Assistance, Needs a baby cot",
    nullable: true,
    description: "Special Notes as entered: presets and free text, comma-separated",
  })
  specialNotes!: string | null;

  @ApiProperty({ example: "2024-01-15T10:00:00Z" })
  createdAt!: string;

  @ApiProperty({ example: "2024-01-15T10:00:00Z", nullable: true })
  updatedAt!: string | null;
}
