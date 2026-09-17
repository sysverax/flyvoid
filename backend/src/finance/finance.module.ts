import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { WalletEntity } from "./entities/wallet.entity";
import { WalletTransactionEntity } from "./entities/wallet-transaction.entity";
import { WalletAdjustmentEntity } from "./entities/wallet-adjustment.entity";
import { WalletCreditLimitHistoryEntity } from "./entities/wallet-credit-limit-history.entity";
import { PaymentEntity } from "./entities/payment.entity";
import { WalletRepository } from "./repositories/wallet.repository";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      WalletEntity,
      WalletTransactionEntity,
      WalletAdjustmentEntity,
      WalletCreditLimitHistoryEntity,
      PaymentEntity,
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletRepository, WalletService],
  exports: [WalletRepository],
})
export class FinanceModule {}
