import { ApiProperty } from "@nestjs/swagger";
import { AirlineRole } from "../../../common/constants/user.constants";

class AirlineTwoFactorChallengeProfileDto {
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

export class AirlineSigninTwoFactorChallengeResponseDto {
  @ApiProperty({ example: true })
  requiresTwoFactor!: true;

  @ApiProperty()
  twoFactorToken!: string;

  @ApiProperty({ example: "5m" })
  twoFactorTokenExpiresIn!: string;

  @ApiProperty({ type: AirlineTwoFactorChallengeProfileDto })
  user!: AirlineTwoFactorChallengeProfileDto;
}
