import { ApiProperty } from "@nestjs/swagger";
import { AirlineRole } from "../../../common/constants/user.constants";
import { AirlineUserProfileDto } from "./airline-user-profile-response.dto";

export class AirlineSigninTwoFactorChallengeResponseDto {
  @ApiProperty({ example: true })
  requiresTwoFactor!: boolean;

  @ApiProperty()
  twoFactorToken!: string;

  @ApiProperty({ example: "5m" })
  twoFactorTokenExpiresIn!: string;

  @ApiProperty({ type: AirlineUserProfileDto })
  user!: AirlineUserProfileDto;
}
