import { ApiProperty } from "@nestjs/swagger";
import { AirlineRole } from "../../../common/constants/user.constants";

class AirlineSigninProfileDto {
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

export class AirlineSigninResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: "15m" })
  accessTokenExpiresIn!: string;

  @ApiProperty({ example: "7d" })
  refreshTokenExpiresIn!: string;

  @ApiProperty({ type: AirlineSigninProfileDto })
  user!: AirlineSigninProfileDto;
}
