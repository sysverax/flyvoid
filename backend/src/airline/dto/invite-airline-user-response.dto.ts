import { ApiProperty } from "@nestjs/swagger";
import { AirlineUserResponseDto } from "./airline-user-response.dto";

export class InviteAirlineUserResponseDto {
  @ApiProperty({
    description: "Created airline user",
    type: AirlineUserResponseDto,
  })
  user!: AirlineUserResponseDto;

  @ApiProperty({
    description: "Temporary password for first login",
    example: "uD8#rT2@vQ6!",
  })
  temporaryPassword!: string;
}
