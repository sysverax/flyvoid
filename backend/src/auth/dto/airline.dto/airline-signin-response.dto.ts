import { ApiProperty } from "@nestjs/swagger";
import { AirlineRole } from "../../../common/constants/user.constants";
import { AirlineUserProfileDto } from "./airline-user-profile-response.dto";

export class AirlineSigninResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: "15m" })
  accessTokenExpiresIn!: string;

  @ApiProperty({ example: "7d" })
  refreshTokenExpiresIn!: string;

  @ApiProperty({ type: AirlineUserProfileDto })
  user!: AirlineUserProfileDto;
}
