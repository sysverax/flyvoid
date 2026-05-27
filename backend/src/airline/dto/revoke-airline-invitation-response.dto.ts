import { ApiProperty } from "@nestjs/swagger";
import { AirlineInvitationStatus } from "./airline-invitation-status.enum";

export class RevokeAirlineInvitationResponseDto {
  @ApiProperty({ description: "Revoked invitation id", example: 101 })
  invitationId!: number;

  @ApiProperty({
    description: "Resulting status",
    enum: AirlineInvitationStatus,
    example: AirlineInvitationStatus.REVOKED,
  })
  status!: AirlineInvitationStatus;
}
