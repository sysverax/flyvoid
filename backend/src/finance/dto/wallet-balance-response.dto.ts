import { ApiProperty } from "@nestjs/swagger";

export class WalletBalanceResponseDto {
  @ApiProperty({ example: 5 })
  walletId!: number;

  @ApiProperty({ example: 12 })
  airlineId!: number;

  @ApiProperty({ example: 2000 })
  balance!: number;

  @ApiProperty({ example: 5000 })
  creditLimit!: number;

  @ApiProperty({ example: 0 })
  lockedAmount!: number;

  @ApiProperty({ example: "USD" })
  currency!: string;

  @ApiProperty({ example: "2026-09-18T10:00:00.000Z" })
  updatedAt!: string;
}
