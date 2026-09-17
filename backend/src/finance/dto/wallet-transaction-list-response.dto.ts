import { ApiProperty } from "@nestjs/swagger";
import {
  PAYMENT_STATUSES,
  TRANSACTION_REFERENCE_TYPES,
  TRANSACTION_TYPES,
} from "../constants";

export class WalletTransactionAirlineDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: "SkyJet Airways" })
  name!: string;

  @ApiProperty({ example: "SKYJET" })
  code!: string;
}

export class WalletTransactionListItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ type: WalletTransactionAirlineDto })
  airline!: WalletTransactionAirlineDto;

  @ApiProperty({ example: 1500 })
  openingBalance!: number;

  @ApiProperty({ example: 500 })
  transactionAmount!: number;

  @ApiProperty({ example: 2000 })
  closingBalance!: number;

  @ApiProperty({ enum: TRANSACTION_TYPES, example: TRANSACTION_TYPES.CREDIT })
  transactionType!: TRANSACTION_TYPES;

  @ApiProperty({
    enum: TRANSACTION_REFERENCE_TYPES,
    example: TRANSACTION_REFERENCE_TYPES.ADJUSTMENT,
    description:
      "Whether this transaction is a manual adjustment or a cancelled-flight cost",
  })
  type!: TRANSACTION_REFERENCE_TYPES;

  @ApiProperty({ example: 5000, description: "Wallet's current credit limit" })
  creditLimit!: number;

  @ApiProperty({ example: "Manual bank transfer top-up", nullable: true })
  reason!: string | null;

  @ApiProperty({
    enum: PAYMENT_STATUSES,
    example: PAYMENT_STATUSES.SUCCESS,
    description:
      "Always SUCCESS today — manual transfers only, until payment gateway integration",
  })
  status!: PAYMENT_STATUSES;

  @ApiProperty({ example: "2026-09-18T10:00:00.000Z" })
  createdAt!: string;
}

export class WalletTransactionListPaginationDto {
  @ApiProperty({ example: 1 })
  currentPage!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  totalCount!: number;
}

export class WalletTransactionListResponseDto {
  @ApiProperty({ type: [WalletTransactionListItemDto] })
  transactions!: WalletTransactionListItemDto[];

  @ApiProperty({ type: WalletTransactionListPaginationDto })
  pagination!: WalletTransactionListPaginationDto;
}
