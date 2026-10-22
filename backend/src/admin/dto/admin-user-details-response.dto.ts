import { ApiProperty } from "@nestjs/swagger";
import { AdminUserResponseDto } from "./admin-user-response.dto";
import { PlatformAccessControlInputDto } from "./platform-access-control-input.dto";

export class AdminUserDetailsResponseDto extends AdminUserResponseDto {
  @ApiProperty({
    description: "Platform asset access controls assigned to this admin",
    type: PlatformAccessControlInputDto,
    isArray: true,
  })
  accessControls!: PlatformAccessControlInputDto[];
}
