import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TRANSACTION_TYPES } from "../constants";

export class WalletAdjustmentResponseDto {
  @ApiProperty({ example: 1 })
  adjustmentId!: number;

  @ApiProperty({ example: 1 })
  transactionId!: number;

  @ApiProperty({ example: 12 })
  airlineId!: number;

  @ApiProperty({ example: 5 })
  walletId!: number;

  @ApiProperty({ enum: TRANSACTION_TYPES, example: TRANSACTION_TYPES.CREDIT })
  type!: TRANSACTION_TYPES;

  @ApiProperty({ example: 500 })
  amount!: number;

  @ApiProperty({ example: 1500 })
  openingBalance!: number;

  @ApiProperty({ example: 2000 })
  closingBalance!: number;

  @ApiProperty({ example: 5000 })
  creditLimit!: number;

  @ApiPropertyOptional({ example: "Manual bank transfer top-up", nullable: true })
  reason?: string | null;

  @ApiProperty({ example: "2026-09-18T10:00:00.000Z" })
  createdAt!: string;
}
