import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ResendAirlineInvitationResponseDto {
  @ApiProperty({ description: "Refreshed invitation id", example: 101 })
  invitationId!: number;

  @ApiProperty({ description: "Invitation expiry duration", example: "48h" })
  expiresIn!: string;

  @ApiPropertyOptional({
    description: "Onboarding link in local/dev/test environments",
    example: "http://localhost:3000/airline/onboard?token=...",
  })
  onboardingLink?: string;
}
