import { ApiProperty } from "@nestjs/swagger";

export class AirlineAdminUserDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: "Aisha" })
  firstName!: string;

  @ApiProperty({ example: "Khan" })
  lastName!: string;

  @ApiProperty({ example: "admin@skyjet.com" })
  email!: string;

  @ApiProperty({ example: "Airline Admin" })
  jobTitle!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class AdminAirlineResponseDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: "SkyJet Airways" })
  name!: string;

  @ApiProperty({ example: "SKYJET" })
  code!: string;

  @ApiProperty({ example: "AE" })
  countryCode!: string;

  @ApiProperty({ example: "CRN-001234" })
  companyRegistrationNumber!: string;

  @ApiProperty({ example: "https://skyjet.com", nullable: true })
  website!: string | null;

  @ApiProperty({ example: "ops@skyjet.com" })
  contactEmail!: string;

  @ApiProperty({ example: "+971501112233" })
  contactPhone!: string;

  @ApiProperty({ example: "Asia/Dubai" })
  timezone!: string;

  @ApiProperty({ example: "https://cdn.example.com/skyjet-logo.png", nullable: true })
  logo!: string | null;

  @ApiProperty({ example: "AED" })
  currency!: string;

  @ApiProperty({ example: "Dubai Airport Free Zone, Dubai, UAE" })
  address!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  isSuspended!: boolean;

  @ApiProperty({ type: AirlineAdminUserDto, nullable: true })
  adminUser!: AirlineAdminUserDto | null;

  @ApiProperty({ example: "2026-01-01T10:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-01-15T09:30:00.000Z" })
  updatedAt!: string;
}
