import { ApiProperty } from "@nestjs/swagger";

export class CreditLimitUpdateResponseDto {
  @ApiProperty({ example: 5 })
  airlineId!: number;

  @ApiProperty({ example: 5 })
  walletId!: number;

  @ApiProperty({ example: 10000 })
  previousCreditLimit!: number;

  @ApiProperty({ example: 0 })
  creditLimit!: number;

  @ApiProperty({ example: -1983.52 })
  balance!: number;

  @ApiProperty({ example: 3220 })
  lockedAmount!: number;

  @ApiProperty({
    example: -5203.52,
    description: "balance + creditLimit - lockedAmount; negative blocks new hotel allocations",
  })
  availableBalance!: number;

  @ApiProperty({ example: "USD" })
  currency!: string;

  @ApiProperty({ example: "Reduced after overdue invoices" })
  reason!: string;

  @ApiProperty({ example: "2026-10-29T09:10:00.000Z" })
  changedAt!: string;
}

export class CreditLimitChangedByDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: "Jane Doe" })
  name!: string;

  @ApiProperty({ example: "jane@flyvoid.com" })
  email!: string;
}

export class CreditLimitHistoryItemDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 10000 })
  previousCreditLimit!: number;

  @ApiProperty({ example: 5000 })
  newCreditLimit!: number;

  @ApiProperty({ example: "Reduced after overdue invoices" })
  reason!: string;

  @ApiProperty({ type: CreditLimitChangedByDto, nullable: true })
  changedBy!: CreditLimitChangedByDto | null;

  @ApiProperty({ example: "2026-10-29T09:10:00.000Z" })
  changedAt!: string;
}

export class CreditLimitHistoryResponseDto {
  @ApiProperty({ example: 5 })
  airlineId!: number;

  @ApiProperty({ example: 5000 })
  creditLimit!: number;

  @ApiProperty({ example: -1983.52 })
  balance!: number;

  @ApiProperty({ example: 3220 })
  lockedAmount!: number;

  @ApiProperty({ example: -203.52, description: "balance + creditLimit - lockedAmount" })
  availableBalance!: number;

  @ApiProperty({ example: "USD" })
  currency!: string;

  @ApiProperty({ type: [CreditLimitHistoryItemDto], description: "Newest first" })
  history!: CreditLimitHistoryItemDto[];
}
