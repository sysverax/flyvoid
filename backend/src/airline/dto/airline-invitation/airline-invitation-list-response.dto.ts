import { ApiProperty } from "@nestjs/swagger";
import { AirlineInvitationResponseDto } from "./airline-invitation-response.dto";

export class AirlineInvitationListResponseDto {
  @ApiProperty({ description: "Total number of invitations", example: 44 })
  total!: number;

  @ApiProperty({ description: "Current page number", example: 1 })
  currentPage!: number;

  @ApiProperty({
    description: "Maximum records returned per page",
    example: 10,
  })
  limit!: number;

  @ApiProperty({
    description: "Paginated invitation records",
    type: AirlineInvitationResponseDto,
    isArray: true,
  })
  invitations!: AirlineInvitationResponseDto[];
}
