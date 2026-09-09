import { ApiProperty } from "@nestjs/swagger";

export class SendHotelBookingEmailResponseDto {
  @ApiProperty({ example: 1 })
  hotelBookingId!: number;

  @ApiProperty({ example: "john.doe@example.com" })
  sentTo!: string;

  @ApiProperty({ example: "Hotel booking confirmation email sent" })
  message!: string;
}
