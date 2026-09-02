import { ApiProperty } from "@nestjs/swagger";
import { SpecialNote, TravelClass } from "../entities/enums";

export class BookingResponseDto {
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

  @ApiProperty({ example: "Economy" })
  travelClass!: TravelClass;

  @ApiProperty({ example: 2 })
  adults!: number;

  @ApiProperty({ example: 1 })
  children!: number;

  @ApiProperty({
    example: ["Vegetarian meal", "Extra legroom"],
    nullable: true,
  })
  specialNotes!: SpecialNote[];

  @ApiProperty({ example: "Please provide a baby cot", nullable: true })
  additionalNotes?: string | null;

  @ApiProperty({ example: "2024-01-15T10:00:00Z" })
  createdAt!: string;

  @ApiProperty({ example: "2024-01-15T10:00:00Z", nullable: true })
  updatedAt!: string | null;
}
