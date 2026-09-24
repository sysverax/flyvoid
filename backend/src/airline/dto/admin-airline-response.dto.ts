import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AirlineDetailsDto {
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

  @ApiProperty({ example: "AED" })
  currency!: string;

  @ApiProperty({ example: "Dubai Airport Free Zone, Dubai, UAE" })
  address!: string;

  @ApiProperty({ example: "2026-01-01T10:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-01-15T09:30:00.000Z" })
  updatedAt!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  isSuspended!: boolean;
}

export class AirlineAdminDetailsDto {
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

  @ApiPropertyOptional({
    example: "2026-01-15T09:30:00.000Z",
    nullable: true,
  })
  lastLoginAt!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class AirlineOperationalMetricsDto {
  @ApiProperty({
    description:
      "Cancelled flights currently in progress (draft, in_progress, passengers_booking_confirmed, hotel_allocation_in_progress)",
    example: 3,
  })
  totalOngoingCancelledFlights!: number;

  @ApiProperty({
    description:
      "Cancelled flights that reached a final status (allocated, paid, published)",
    example: 42,
  })
  totalCancelledFlights!: number;

  @ApiProperty({ example: 58 })
  totalChildren!: number;

  @ApiProperty({ example: 120 })
  totalAdults!: number;

  @ApiProperty({ example: 178 })
  totalBookings!: number;

  @ApiProperty({ example: 95 })
  totalRooms!: number;
}

export class AirlineFinancialSummaryDto {
  @ApiProperty({ example: 5 })
  walletId!: number;

  @ApiProperty({ example: 100000 })
  creditLimit!: number;

  @ApiProperty({ example: 2000 })
  balance!: number;

  @ApiProperty({ example: 0 })
  lockedAmount!: number;

  @ApiProperty({
    description: "Platform fee percentage charged to this airline",
    example: 12.5,
  })
  platformFeePercentage!: number;

  @ApiProperty({
    description: "Sums below only consider cancelled flights allocated, paid, or published",
    example: 250000,
  })
  totalActualPrice!: number;

  @ApiProperty({ example: 200000 })
  totalBuyingPrice!: number;

  @ApiProperty({ example: 230000 })
  totalSellingPrice!: number;

  @ApiProperty({ example: 5000 })
  totalDiscounts!: number;

  @ApiProperty({ example: 8000 })
  totalHotelTaxes!: number;

  @ApiProperty({ example: 25000 })
  totalPlatformFee!: number;

  @ApiProperty({ example: 260000 })
  totalPrice!: number;

  @ApiProperty({ example: 30000 })
  totalEarnings!: number;
}

export class AdminAirlineResponseDto {
  @ApiProperty({ type: AirlineDetailsDto })
  airlineDetails!: AirlineDetailsDto;

  @ApiProperty({ type: AirlineAdminDetailsDto })
  adminDetails!: AirlineAdminDetailsDto;

  @ApiProperty({ type: AirlineOperationalMetricsDto })
  operationalMetrics!: AirlineOperationalMetricsDto;

  @ApiProperty({ type: AirlineFinancialSummaryDto })
  financialSummary!: AirlineFinancialSummaryDto;
}
