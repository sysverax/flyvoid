import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WalletEntity } from "./entities/wallet.entity";
import { WalletTransactionEntity } from "./entities/wallet-transaction.entity";
import { WalletAdjustmentEntity } from "./entities/wallet-adjustment.entity";
import { WalletCreditLimitHistoryEntity } from "./entities/wallet-credit-limit-history.entity";
import { PaymentEntity } from "./entities/payment.entity";
import { WalletRepository } from "./repositories/wallet.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletEntity,
      WalletTransactionEntity,
      WalletAdjustmentEntity,
      WalletCreditLimitHistoryEntity,
      PaymentEntity,
    ]),
  ],
  providers: [WalletRepository],
  exports: [WalletRepository],
})
export class FinanceModule {}
