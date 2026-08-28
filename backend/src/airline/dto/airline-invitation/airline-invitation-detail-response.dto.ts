import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AIRLINE_INVITATION_STATUSES } from "../../constants";

export class AirlineInvitationHistoryItemDto {
  @ApiProperty({ description: "History record id", example: 1 })
  id!: number;

  @ApiProperty({
    description: "Event that occurred on the invitation",
    example: "SENT",
    enum: ["SENT", "RESENT", "REVOKED", "ACCEPTED"],
  })
  event!: string;

  @ApiProperty({
    description:
      "Id of the platform admin who performed the action. Null for ACCEPTED events (performed by the airline admin).",
    example: 1,
    nullable: true,
  })
  performedByAdminId!: number | null;

  @ApiProperty({
    description:
      "Email of the platform admin who performed the action. Null for ACCEPTED events.",
    example: "admin@flyvoid.com",
    nullable: true,
  })
  performedByAdminEmail!: string | null;

  @ApiProperty({
    description: "When this event occurred",
    example: "2026-05-27T13:50:00.000Z",
  })
  createdAt!: string;
}

export class AirlineInvitationDetailResponseDto {
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

  @ApiProperty({ description: "Airline IATA code", example: "SJ" })
  airlineCode!: string;

  @ApiProperty({
    description: "Airline country code (ISO 3166-1 alpha-2)",
    example: "AE",
  })
  countryCode!: string;

  @ApiProperty({
    description: "Company registration number",
    example: "SJ-2026-001",
  })
  companyRegistrationNumber!: string;

  @ApiPropertyOptional({
    description: "Airline website URL",
    example: "https://www.skyjet.com",
    required: false,
  })
  website?: string;

  @ApiProperty({
    description: "Airline contact email",
    example: "contact@skyjet.com",
  })
  contactEmail!: string;

  @ApiProperty({
    description: "Airline contact phone number",
    example: "+971-4-1234567",
  })
  contactPhone!: string;

  @ApiProperty({
    description: "Airline timezone (IANA timezone name)",
    example: "Asia/Dubai",
  })
  timezone!: string;

  @ApiProperty({
    description: "Airline currency (ISO 4217 currency code)",
    example: "AED",
  })
  currency!: string;

  @ApiProperty({
    description: "Airline address",
    example: "123 SkyJet Street, Dubai, UAE",
  })
  address!: string;

  @ApiPropertyOptional({
    description: "Airline logo URL",
    example: "https://www.skyjet.com/logo.png",
    required: false,
  })
  logo?: string;

  @ApiPropertyOptional({
    description: "Airline credit limit",
    example: 100000,
    required: false,
  })
  creditLimit?: number;

  @ApiProperty({ description: "Invited admin first name", example: "Aisha" })
  adminFirstName!: string;

  @ApiProperty({ description: "Invited admin last name", example: "Khan" })
  adminLastName!: string;

  @ApiProperty({
    description: "Invited admin email",
    example: "aisha@skyjet.com",
  })
  adminEmail!: string;

  @ApiProperty({
    description: "Invited admin job title",
    example: "Operations Lead",
  })
  adminJobTitle!: string;

  @ApiProperty({ description: "Invitation creator admin id", example: 1 })
  invitedByAdminId!: number;

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
    description: "Invitation last updated date-time",
    example: "2026-05-26T13:50:00.000Z",
  })
  updatedAt!: string;

  @ApiProperty({
    description: "Chronological history of events on this invitation",
    type: () => [AirlineInvitationHistoryItemDto],
  })
  history!: AirlineInvitationHistoryItemDto[];
}
