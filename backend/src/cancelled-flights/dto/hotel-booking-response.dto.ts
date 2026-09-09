import { ApiProperty } from "@nestjs/swagger";
import { SpecialNote, TravelClass } from "../entities/enums";
import { ParentBookingResponseDto } from "./booking-response.dto";

export class HotelBookingResponseDto {
  @ApiProperty({
    description: "Unique identifier for the hotel booking",
    example: 1,
  })
  id!: number;

  @ApiProperty({
    description: "Details of the passenger booking",
    type: () => ParentBookingResponseDto,
  })
  passengerBooking!: ParentBookingResponseDto;

  @ApiProperty({
    description:
      "Identifier of the cancelled flight associated with the hotel booking",
    example: 1,
  })
  cancelledFlightId!: number;

  @ApiProperty({
    description: "Name of the hotel associated with the booking",
    example: "Grand Hotel",
  })
  hotelName!: string;

  @ApiProperty({
    description: "Rating of the hotel associated with the booking",
    example: "4.5",
  })
  rating!: string;

  @ApiProperty({
    description: "Total number of rooms booked in the hotel",
    example: 2,
  })
  totalRooms!: number;

  @ApiProperty({
    description: "Total cost of the hotel booking",
    example: 350.75,
  })
  totalCost!: number;

  @ApiProperty({
    description: "Timestamp when the hotel booking was created",
    example: "2024-01-15T10:00:00Z",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Timestamp when the hotel booking was last updated",
    example: "2024-01-15T10:00:00Z",
    nullable: true,
  })
  updatedAt!: string | null;
}
