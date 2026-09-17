import { ApiProperty } from "@nestjs/swagger";

export class WalletSummaryResponseDto {
  @ApiProperty({
    description: "Total wallet balance across all airlines",
    example: 125000,
  })
  totalWalletBalance!: number;

  @ApiProperty({
    description: "Total credit limit issued across all airlines",
    example: 500000,
  })
  totalCreditIssued!: number;

  @ApiProperty({
    description: "Total credit currently used across all airlines",
    example: 32000,
  })
  totalCreditUsed!: number;
}
