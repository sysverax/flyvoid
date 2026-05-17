import { ApiProperty } from "@nestjs/swagger";
import { AirlineRole } from "../../../common/constants/user.constants";

export class AirlineUserProfileResponseDto {
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
}
