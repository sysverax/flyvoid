import { ApiProperty } from "@nestjs/swagger";
import { HotelAllocationStatus } from "../../cancelled-flights/entities/enums";
import { BookingResponseDto } from "../../cancelled-flights/dto/booking-response.dto";
import { ReviewCancelledFlightDto } from "../../cancelled-flights/dto/review-cancelled-flight-response.dto";

export class HotelBookingRoomDto {
  @ApiProperty({ example: 2 })
  adults!: number;

  @ApiProperty({ example: 1 })
  children!: number;

  @ApiProperty({ example: "Double Room" })
  roomName!: string;

  @ApiProperty({ example: "Room Only" })
  boardName!: string;

  @ApiProperty({ example: 120.5 })
  price!: number;
}

export class HotelBookingHotelDetailDto {
  @ApiProperty({ example: "HTL001" })
  hotelCode!: string;

  @ApiProperty({ example: "Grand Hotel" })
  hotelName!: string;

  @ApiProperty({ example: "4EST" })
  category!: string;

  @ApiProperty({ example: "123 Beach Road, Colombo", nullable: true })
  address?: string | null;

  @ApiProperty({
    example: {
      phones: [{ phoneNumber: "+94112345678", phoneType: "PHONEHOTEL" }],
      email: "reservations@grandhotel.com",
    },
    nullable: true,
  })
  contact?: {
    phones: Array<{ phoneNumber: string; phoneType: string }>;
    email: string | null;
  } | null;

  @ApiProperty({ example: 7.292639, nullable: true })
  latitude?: number | null;

  @ApiProperty({ example: 79.839859, nullable: true })
  longitude?: number | null;

  @ApiProperty({ example: 20, nullable: true })
  distanceFromAirportKm?: number | null;

  @ApiProperty({
    example: "https://photos.hotelbeds.com/giata/bigger/10/101080/101080a.jpg",
    nullable: true,
  })
  imageUrl?: string | null;

  @ApiProperty({ example: "https://www.grandhotel.com", nullable: true })
  website?: string | null;

  @ApiProperty({
    example: ["Swimming pool", "Free WiFi", "Gym"],
    nullable: true,
    type: [String],
  })
  amenities?: string[] | null;

  @ApiProperty({ example: "2024-01-15" })
  checkInDate!: string;

  @ApiProperty({ example: "2024-01-16" })
  checkOutDate!: string;

  @ApiProperty({ type: [HotelBookingRoomDto] })
  rooms!: HotelBookingRoomDto[];

  @ApiProperty({ example: 2 })
  totalRooms!: number;

  @ApiProperty({ example: 350.75 })
  actualPrice!: number;

  @ApiProperty({
    example: 300,
    description: "Platform-only field; omitted for airline users",
    nullable: true,
  })
  buyingPrice?: number;

  @ApiProperty({ example: 320 })
  sellingPrice!: number;

  @ApiProperty({ example: 15.5 })
  tax!: number;

  @ApiProperty({ example: 10 })
  platformFee!: number;

  @ApiProperty({ example: 5 })
  discount!: number;

  @ApiProperty({ example: 345.5 })
  totalPrice!: number;

  @ApiProperty({
    example: 25.5,
    description: "Platform-only field; omitted for airline users",
    nullable: true,
  })
  earnings?: number;

  @ApiProperty({ example: "confirmed", enum: HotelAllocationStatus })
  status!: HotelAllocationStatus;

  @ApiProperty({ example: "HB-1001-0" })
  bookingReference!: string;

  @ApiProperty({ example: "2024-01-15T10:00:00Z" })
  createdAt!: string;

  @ApiProperty({ example: "2024-01-15T10:00:00Z", nullable: true })
  updatedAt!: string | null;

  reason?: string | null;
}

export class HotelBookingDetailResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ type: ReviewCancelledFlightDto })
  flight!: ReviewCancelledFlightDto;

  @ApiProperty({ type: BookingResponseDto })
  booking!: BookingResponseDto;

  @ApiProperty({ type: HotelBookingHotelDetailDto })
  hotel!: HotelBookingHotelDetailDto;
}
