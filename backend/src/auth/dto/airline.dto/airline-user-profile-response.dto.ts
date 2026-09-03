import { ApiProperty } from "@nestjs/swagger";
import { AirlineRole } from "../../../common/constants/user.constants";
import {
  AirlineAccessControlInputDto,
} from "../../../airline/dto";

export class AirlineUserProfileDto {
  @ApiProperty({ example: 201 })
  id!: number;

  @ApiProperty({ example: 12 })
  airlineId!: number;

  @ApiProperty({ example: "Aisha" })
  firstName!: string;

  @ApiProperty({ example: "Khan" })
  lastName!: string;

  @ApiProperty({ example: "aisha.khan@skyjet.com" })
  email!: string;

  @ApiProperty({ enum: AirlineRole, example: AirlineRole.AIRLINE_ADMIN })
  role!: AirlineRole;

  @ApiProperty({
    description: "Platform asset access controls assigned to this admin",
    type: AirlineAccessControlInputDto,
    isArray: true,
  })
  accessControls!: AirlineAccessControlInputDto[];
}

export class AirlineUserProfileResponseDto extends AirlineUserProfileDto {}
