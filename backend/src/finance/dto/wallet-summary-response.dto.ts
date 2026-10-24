import { ApiProperty } from "@nestjs/swagger";

// All totals cover the airlines matching the query filters (all airlines when none are given).
export class WalletSummaryResponseDto {
  @ApiProperty({
    description: "Number of airlines matching the filters",
    example: 18,
  })
  totalAirlines!: number;

  @ApiProperty({
    description:
      "Number of airlines matching the filters that are active and not suspended",
    example: 12,
  })
  totalActiveAirlines!: number;

  @ApiProperty({
    description: "Total wallet balance of the matching airlines",
    example: 125000,
  })
  totalWalletBalance!: number;

  @ApiProperty({
    description: "Total credit limit issued to the matching airlines",
    example: 500000,
  })
  totalCreditIssued!: number;

  @ApiProperty({
    description: "Total credit currently used by the matching airlines",
    example: 32000,
  })
  totalCreditUsed!: number;
}
