import { ApiProperty } from "@nestjs/swagger";
import { AIRLINE_INVITATION_STATUSES } from "../../utils";

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
    description: "Invitation update date-time",
    example: "2026-05-26T13:50:00.000Z",
  })
  updatedAt!: string;
}
