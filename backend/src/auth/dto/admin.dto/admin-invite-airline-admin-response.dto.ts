import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
    description: "Airline name",
    example: "SkyJet Airlines",
  })
  airlineName!: string;

  @ApiProperty({
    description: "Airline code",
    example: "SJ",
  })
  airlineCode!: string;

  @ApiProperty({
    description: "Airline company registration number",
    example: "CRN-123456",
  })
  companyRegistrationNumber!: string;

  @ApiPropertyOptional({
    description: "Airline website",
    example: "https://www.skyjet.com",
  })
  website?: string;

  @ApiProperty({
    description: "Airline contact email",
    example: "contact@skyjet.com",
  })
  contactEmail!: string;

  @ApiProperty({
    description: "Airline contact phone",
    example: "+1234567890",
  })
  contactPhone!: string;

  @ApiProperty({
    description: "Airline timezone",
    example: "America/New_York",
  })
  timezone!: string;

  @ApiProperty({
    description: "Airline currency",
    example: "USD",
  })
  currency!: string;

  @ApiProperty({
    description: "Airline address",
    example: "123 SkyJet St, New York, NY 10001",
  })
  address!: string;

  @ApiPropertyOptional({
    description: "Airline logo URL",
    example: "https://cdn.skyjet.com/logo.png",
  })
  logo?: string;

  @ApiProperty({
    description: "Airline admin first name",
    example: "Aisha",
  })
  firstName!: string;

  @ApiProperty({
    description: "Airline admin last name",
    example: "Khan",
  })
  lastName!: string;

  @ApiProperty({
    description: "Airline admin email",
    example: "aisha.khan@skyjet.com",
  })
  email!: string;

  @ApiProperty({
    description: "Airline admin job title",
    example: "Operations Lead",
  })
  jobTitle!: string;

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
  onboardingLink?: string;
}
