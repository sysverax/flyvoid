import { ApiProperty } from "@nestjs/swagger";
import { AIRLINE_INVITATION_STATUSES } from "../../utils";

export class RevokeAirlineInvitationResponseDto {
  @ApiProperty({ description: "Revoked invitation id", example: 101 })
  invitationId!: number;

  @ApiProperty({
    description: "Resulting status",
    enum: AIRLINE_INVITATION_STATUSES,
    example: AIRLINE_INVITATION_STATUSES.REVOKED,
  })
  status!: AIRLINE_INVITATION_STATUSES;
}
