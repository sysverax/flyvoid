import { ApiProperty } from "@nestjs/swagger";
import { AirlineAccessControlInputDto } from "./airline-access-control-input.dto";
import { AirlineUserResponseDto } from "./airline-user-response.dto";

export class AirlineUserDetailsResponseDto extends AirlineUserResponseDto {
  @ApiProperty({
    description: "Airline asset access controls assigned to this user",
    type: AirlineAccessControlInputDto,
    isArray: true,
  })
  accessControls!: AirlineAccessControlInputDto[];
}
