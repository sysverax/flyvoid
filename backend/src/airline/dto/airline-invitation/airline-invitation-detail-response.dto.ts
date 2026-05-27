import { ApiProperty } from "@nestjs/swagger";
import { AIRLINE_INVITATION_STATUSES } from "../../utils";

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
    description: "Company registration number",
    example: "SJ-2026-001",
  })
  companyRegistrationNumber!: string;

  @ApiProperty({ description: "Invited admin first name", example: "Aisha" })
  firstName!: string;

  @ApiProperty({ description: "Invited admin last name", example: "Khan" })
  lastName!: string;

  @ApiProperty({
    description: "Invited admin email",
    example: "aisha@skyjet.com",
  })
  email!: string;

  @ApiProperty({
    description: "Invited admin job title",
    example: "Operations Lead",
  })
  jobTitle!: string;

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
