import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AIRLINE_INVITATION_STATUSES } from "../../constants";

export class AirlineInvitationResponseDto {
  @ApiProperty({ description: "Invitation id", example: 101 })
  invitationId!: number;

  @ApiProperty({
    description:
      "Airline id. Null until onboarding is completed and airline is created.",
    example: null,
    nullable: true,
  })
  airlineId!: number | null;

  @ApiProperty({ description: "Airline name", example: "SkyJet Airlines" })
  airlineName!: string;

  @ApiProperty({ description: "Airline code", example: "SJ" })
  airlineCode!: string;

  @ApiProperty({ description: "Airline country code", example: "AE" })
  countryCode!: string;

  @ApiProperty({
    description: "Airline company registration number",
    example: "1234567890",
  })
  companyRegistrationNumber!: string;

  @ApiProperty({
    description: "Airline contact email",
    example: "contact@skyjet.com",
  })
  contactEmail!: string;

  @ApiPropertyOptional({
    description: "Airline credit limit",
    example: 100000,
    required: false,
  })
  creditLimit?: number;

  @ApiProperty({
    description: "Invitation status",
    enum: AIRLINE_INVITATION_STATUSES,
    example: AIRLINE_INVITATION_STATUSES.PENDING,
  })
  status!: AIRLINE_INVITATION_STATUSES;

  @ApiProperty({
    description: "Invitation expiry date-time",
    example: "2026-05-27T13:50:00.000Z",
  })
  expiresAt!: string;

  @ApiProperty({
    description: "Invitation creation date-time",
    example: "2026-05-25T13:50:00.000Z",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Invitation update date-time",
    example: "2026-05-26T13:50:00.000Z",
  })
  updatedAt!: string;

  @ApiProperty({
    description: "Invitation creator admin id",
    example: 1,
  })
  invitedByAdminId!: number;
}
