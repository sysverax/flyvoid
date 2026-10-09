import { ApiProperty } from "@nestjs/swagger";
import {
  HotelAllocationStatus,
  SpecialNote,
  TravelClass,
} from "../entities/enums";
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
    description: "Allocation rationale, including any unverifiable special-need caveat",
    nullable: true,
    example:
      "Best available 4-star option for business class; special request (wheelchair_assistance) recorded but not verifiable from hotel data - confirm with the hotel directly.",
  })
  reason?: string | null;

  @ApiProperty({
    description:
      "Supplier booking state: confirmed (booked), failed, manual_check (outcome unknown - reconcile with the supplier), in_progress or draft",
    enum: HotelAllocationStatus,
    example: HotelAllocationStatus.CONFIRMED,
  })
  status!: HotelAllocationStatus;

  @ApiProperty({
    description: "Supplier booking reference(s); null unless confirmed",
    nullable: true,
    example: "f1c9a1e4-6c1b-4f7e-9d0a-1b2c3d4e5f60",
  })
  bookingReference!: string | null;

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
