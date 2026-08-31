import { ApiProperty } from "@nestjs/swagger";
export class BaseCancelledFlightResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: "SW1234" })
  flightNumber!: string;

  @ApiProperty({ example: 1 })
  airlineId!: number;

  @ApiProperty({ example: 1 })
  departureAirportId!: number;

  @ApiProperty({ example: 2 })
  arrivalAirportId!: number;

  @ApiProperty({ example: "2024-01-15" })
  cancellationDate!: string;

  @ApiProperty({
    example: "Severe weather conditions at departure",
    nullable: true,
  })
  cancellationReason?: string | null;

  @ApiProperty({ example: "DRAFT" })
  status!: string;

  @ApiProperty({ example: "2024-01-15T10:00:00Z" })
  createdAt!: string;

  @ApiProperty({ example: "2024-01-15T10:00:00Z", nullable: true })
  updatedAt!: string;
}

export class CancelledFlightResponseDto extends BaseCancelledFlightResponseDto {
  @ApiProperty({
    example: "Severe weather conditions at departure",
    nullable: true,
  })
  cancellationReasonText?: string | null;
}
