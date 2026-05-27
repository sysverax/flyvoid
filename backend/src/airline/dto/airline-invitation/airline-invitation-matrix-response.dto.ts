import { ApiProperty } from "@nestjs/swagger";

export class AirlineInvitationMatrixResponseDto {
  @ApiProperty({ description: "Total invitations sent", example: 100 })
  totalSent!: number;

  @ApiProperty({ description: "Accepted invitations", example: 47 })
  accepted!: number;

  @ApiProperty({ description: "Pending invitations", example: 22 })
  pending!: number;

  @ApiProperty({ description: "Expired invitations", example: 18 })
  expired!: number;

  @ApiProperty({ description: "Revoked invitations", example: 13 })
  revoked!: number;
}
