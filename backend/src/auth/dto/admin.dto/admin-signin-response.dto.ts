import { ApiProperty } from "@nestjs/swagger";
import { AdminProfileDto } from "../../../admin/dto";

export class AdminSigninResponseDto {
  @ApiProperty({
    description: "JWT access token used for API authorization",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access",
  })
  accessToken!: string;

  @ApiProperty({
    description: "JWT refresh token used to obtain new token pairs",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh",
  })
  refreshToken!: string;

  @ApiProperty({
    description: "Configured access token expiry",
    example: "15m",
  })
  accessTokenExpiresIn!: string;

  @ApiProperty({
    description: "Configured refresh token expiry",
    example: "7d",
  })
  refreshTokenExpiresIn!: string;

  @ApiProperty({
    description: "Authenticated admin profile",
    type: AdminProfileDto,
  })
  admin!: AdminProfileDto;
}
