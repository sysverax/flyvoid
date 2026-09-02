import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AIRLINE_INVITATION_STATUSES } from "../../constants";

export class UpdateAirlineInvitationResponseDto {
  @ApiProperty({ description: "Invitation id", example: 101 })
  invitationId!: number;

  @ApiProperty({ description: "Airline name", example: "SkyJet Airlines" })
  airlineName!: string;

  @ApiProperty({ description: "Airline IATA code", example: "SJ" })
  airlineCode!: string;

  @ApiProperty({
    description: "Airline country code (ISO 3166-1 alpha-2)",
    example: "AE",
  })
  countryCode!: string;

  @ApiProperty({
    description: "Company registration number",
    example: "SJ-2026-001",
  })
  companyRegistrationNumber!: string;

  @ApiPropertyOptional({
    description: "Airline website URL",
    example: "https://www.skyjet.com",
    nullable: true,
  })
  website?: string | null;

  @ApiProperty({
    description: "Airline contact email",
    example: "contact@skyjet.com",
  })
  contactEmail!: string;

  @ApiProperty({
    description: "Airline contact phone number",
    example: "+971-4-1234567",
  })
  contactPhone!: string;

  @ApiProperty({
    description: "Airline timezone (IANA timezone name)",
    example: "Asia/Dubai",
  })
  timezone!: string;

  @ApiProperty({
    description: "Airline currency (ISO 4217 currency code)",
    example: "AED",
  })
  currency!: string;

  @ApiProperty({
    description: "Airline address",
    example: "123 SkyJet Street, Dubai, UAE",
  })
  address!: string;

  @ApiPropertyOptional({
    description: "Airline logo URL",
    example: "https://www.skyjet.com/logo.png",
    nullable: true,
  })
  logo?: string | null;

  @ApiPropertyOptional({
    description: "Airline credit limit",
    example: 100000,
  })
  creditLimit?: number;

  @ApiProperty({ description: "Invited admin first name", example: "Aisha" })
  adminFirstName!: string;

  @ApiProperty({ description: "Invited admin last name", example: "Khan" })
  adminLastName!: string;

  @ApiProperty({
    description: "Invited admin email",
    example: "aisha@skyjet.com",
  })
  adminEmail!: string;

  @ApiProperty({
    description: "Invited admin job title",
    example: "Operations Lead",
  })
  adminJobTitle!: string;

  @ApiProperty({
    description: "Invitation status",
    enum: AIRLINE_INVITATION_STATUSES,
    example: AIRLINE_INVITATION_STATUSES.PENDING,
  })
  status!: AIRLINE_INVITATION_STATUSES;

  @ApiProperty({
    description: "Invitation expiry date-time",
    example: "2026-05-27T13:50:00.000Z",
  })
  expiresAt!: string;

  @ApiProperty({
    description: "Invitation last updated date-time",
    example: "2026-05-26T13:50:00.000Z",
  })
  updatedAt!: string;
}
