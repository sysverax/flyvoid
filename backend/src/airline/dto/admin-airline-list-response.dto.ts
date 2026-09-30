import { ApiProperty } from "@nestjs/swagger";

export class AirlineListItemWalletDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: 2000 })
  balance!: number;

  @ApiProperty({ example: 5000 })
  creditLimit!: number;

  @ApiProperty({ example: 0 })
  lockedAmount!: number;
}

export class AirlineListItemDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: "SkyJet Airways" })
  name!: string;

  @ApiProperty({ description: "IATA code", example: "SKYJET" })
  code!: string;

  @ApiProperty({ example: "AE" })
  countryCode!: string;

  @ApiProperty({
    description: "Platform fee percentage charged to this airline",
    example: 12.5,
  })
  platformFeePercentage!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  isSuspended!: boolean;

  @ApiProperty({ type: AirlineListItemWalletDto })
  wallet!: AirlineListItemWalletDto;

  @ApiProperty({ example: "2026-01-01T10:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-01-15T09:30:00.000Z" })
  updatedAt!: string;
}

export class AdminAirlineListResponseDto {
  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 1 })
  currentPage!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ type: AirlineListItemDto, isArray: true })
  airlines!: AirlineListItemDto[];
}
