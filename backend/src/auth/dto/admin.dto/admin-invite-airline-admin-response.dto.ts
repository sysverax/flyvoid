import { ApiProperty } from "@nestjs/swagger";

export class AdminInviteAirlineAdminResponseDto {
  @ApiProperty({
    description: "Invitation id",
    example: 101,
  })
  invitationId!: number;

  @ApiProperty({
    description: "Airline id",
    example: 12,
  })
  airlineId!: number;

  @ApiProperty({
    description: "Airline admin email",
    example: "aisha.khan@skyjet.com",
  })
  email!: string;

  @ApiProperty({
    description: "Invitation expiry duration",
    example: "48h",
  })
  expiresIn!: string;

  @ApiProperty({
    description: "Onboarding link. Provided for local/dev/test environments.",
    example: "http://localhost:3000/airline/onboard?token=...",
    nullable: true,
  })
  onboardingLink!: string | null;
}
