import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { Logger } from "winston";
import { LoggerService } from "../../common/logger/logger.service";
import { WalletEntity } from "../entities/wallet.entity";
import { WalletTransactionEntity } from "../entities/wallet-transaction.entity";
import { WalletAdjustmentEntity } from "../entities/wallet-adjustment.entity";
import { WalletCreditLimitHistoryEntity } from "../entities/wallet-credit-limit-history.entity";
import { TRANSACTION_TYPES, TRANSACTION_REFERENCE_TYPES } from "../constants";

export interface WalletTransactionFilters {
  page: number;
  limit: number;
  airlineId?: number;
  type?: TRANSACTION_REFERENCE_TYPES;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class WalletRepository {
  private readonly context = "WalletRepository";

  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
    @InjectRepository(WalletTransactionEntity)
    private readonly walletTransactionRepository: Repository<WalletTransactionEntity>,
    @InjectRepository(WalletAdjustmentEntity)
    private readonly walletAdjustmentRepository: Repository<WalletAdjustmentEntity>,
    @InjectRepository(WalletCreditLimitHistoryEntity)
    private readonly creditLimitHistoryRepository: Repository<WalletCreditLimitHistoryEntity>,
    private readonly logger: LoggerService,
  ) {}

  // ─── Wallet ───────────────────────────────────────────────────────────────

  async createWallet(
    payload: Pick<
      WalletEntity,
      "airlineId" | "balance" | "creditLimit" | "lockedAmount" | "currency"
    >,
    requestId: string,
    manager?: EntityManager,
  ): Promise<WalletEntity> {
    this.logger.debug("Creating wallet", this.context, requestId, {
      airlineId: payload.airlineId,
    });

    const repo = manager
      ? manager.getRepository(WalletEntity)
      : this.walletRepository;

    const wallet = repo.create(payload);
    return repo.save(wallet);
  }

  async findWalletByAirlineId(
    airlineId: number,
    requestId: string,
    manager?: EntityManager,
  ): Promise<WalletEntity | null> {
    this.logger.debug("Finding wallet by airline id", this.context, requestId, {
      airlineId,
    });

    const repo = manager
      ? manager.getRepository(WalletEntity)
      : this.walletRepository;

    return repo.findOne({ where: { airlineId } });
  }

  /** Locks the wallet row for the duration of the transaction so concurrent
   * adjustments to the same airline's wallet serialize instead of racing. */
  async lockWalletByAirlineId(
    airlineId: number,
    requestId: string,
    manager: EntityManager,
  ): Promise<WalletEntity | null> {
    this.logger.debug(
      "Locking wallet by airline id for update",
      this.context,
      requestId,
      { airlineId },
    );

    return manager
      .getRepository(WalletEntity)
      .createQueryBuilder("wallet")
      .setLock("pessimistic_write")
      .where("wallet.airlineId = :airlineId", { airlineId })
      .getOne();
  }

  async findWalletById(
    walletId: number,
    requestId: string,
    manager?: EntityManager,
  ): Promise<WalletEntity | null> {
    this.logger.debug("Finding wallet by id", this.context, requestId, {
      walletId,
    });

    const repo = manager
      ? manager.getRepository(WalletEntity)
      : this.walletRepository;

    return repo.findOne({ where: { id: walletId } });
  }

  async updateWalletBalances(
    walletId: number,
    updates: Partial<Pick<WalletEntity, "balance" | "lockedAmount">>,
    requestId: string,
    manager?: EntityManager,
  ): Promise<void> {
    this.logger.debug("Updating wallet balances", this.context, requestId, {
      walletId,
      updates,
    });

    const repo = manager
      ? manager.getRepository(WalletEntity)
      : this.walletRepository;

    await repo.update(walletId, updates);
  }

  async updateCreditLimit(
    walletId: number,
    creditLimit: number,
    requestId: string,
    manager?: EntityManager,
  ): Promise<void> {
    this.logger.debug("Updating wallet credit limit", this.context, requestId, {
      walletId,
      creditLimit,
    });

    const repo = manager
      ? manager.getRepository(WalletEntity)
      : this.walletRepository;

    await repo.update(walletId, { creditLimit });
  }

  // ─── Wallet Transactions ──────────────────────────────────────────────────

  async recordTransaction(
    payload: Pick<
      WalletTransactionEntity,
      | "walletId"
      | "type"
      | "referenceType"
      | "referenceId"
      | "amount"
      | "balanceBefore"
      | "balanceAfter"
      | "description"
      | "createdBy"
    >,
    requestId: string,
    manager?: EntityManager,
  ): Promise<WalletTransactionEntity> {
    this.logger.debug("Recording wallet transaction", this.context, requestId, {
      walletId: payload.walletId,
      type: payload.type,
      referenceType: payload.referenceType,
      referenceId: payload.referenceId,
      amount: payload.amount,
    });

    const repo = manager
      ? manager.getRepository(WalletTransactionEntity)
      : this.walletTransactionRepository;

    const transaction = repo.create(payload);
    return repo.save(transaction);
  }

  async findTransactionsByWalletId(
    walletId: number,
    requestId: string,
  ): Promise<WalletTransactionEntity[]> {
    this.logger.debug(
      "Finding transactions by wallet id",
      this.context,
      requestId,
      { walletId },
    );

    return this.walletTransactionRepository.find({
      where: { walletId },
      order: { createdAt: "DESC" },
    });
  }

  // ─── Wallet Adjustments ───────────────────────────────────────────────────

  async recordAdjustment(
    payload: Pick<
      WalletAdjustmentEntity,
      "walletId" | "type" | "amount" | "reason" | "adjustedByAdminId"
    >,
    requestId: string,
    manager?: EntityManager,
  ): Promise<WalletAdjustmentEntity> {
    this.logger.debug("Recording wallet adjustment", this.context, requestId, {
      walletId: payload.walletId,
      type: payload.type,
      amount: payload.amount,
    });

    const repo = manager
      ? manager.getRepository(WalletAdjustmentEntity)
      : this.walletAdjustmentRepository;

    const adjustment = repo.create(payload);
    return repo.save(adjustment);
  }

  async findAdjustmentsByWalletId(
    walletId: number,
    requestId: string,
  ): Promise<WalletAdjustmentEntity[]> {
    this.logger.debug(
      "Finding adjustments by wallet id",
      this.context,
      requestId,
      { walletId },
    );

    return this.walletAdjustmentRepository.find({
      where: { walletId },
      order: { createdAt: "DESC" },
    });
  }

  // ─── Credit Limit History ─────────────────────────────────────────────────

  async recordCreditLimitChange(
    payload: Pick<
      WalletCreditLimitHistoryEntity,
      | "walletId"
      | "previousCreditLimit"
      | "newCreditLimit"
      | "reason"
      | "changedByAdminId"
    >,
    requestId: string,
    manager?: EntityManager,
  ): Promise<WalletCreditLimitHistoryEntity> {
    this.logger.debug(
      "Recording credit limit change",
      this.context,
      requestId,
      {
        walletId: payload.walletId,
        previousCreditLimit: payload.previousCreditLimit,
        newCreditLimit: payload.newCreditLimit,
      },
    );

    const repo = manager
      ? manager.getRepository(WalletCreditLimitHistoryEntity)
      : this.creditLimitHistoryRepository;

    const entry = repo.create(payload);
    return repo.save(entry);
  }

  async findCreditLimitHistoryByWalletId(
    walletId: number,
    requestId: string,
  ): Promise<WalletCreditLimitHistoryEntity[]> {
    this.logger.debug(
      "Finding credit limit history by wallet id",
      this.context,
      requestId,
      { walletId },
    );

    return this.creditLimitHistoryRepository.find({
      where: { walletId },
      order: { createdAt: "DESC" },
    });
  }

  // ─── Transaction list / summary ───────────────────────────────────────────

  async findTransactionsWithPaginationAndFilters(
    filters: WalletTransactionFilters,
    requestLogger: Logger,
  ): Promise<{ transactions: WalletTransactionEntity[]; totalCount: number }> {
    requestLogger.debug("Querying wallet transactions with filters", {
      context: this.context,
      filters,
    });

    const skip = (filters.page - 1) * filters.limit;

    const qb = this.walletTransactionRepository
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.wallet", "wallet")
      .leftJoinAndSelect("wallet.airline", "airline")
      .orderBy("transaction.createdAt", "DESC")
      .skip(skip)
      .take(filters.limit);

    if (typeof filters.airlineId === "number") {
      qb.andWhere("wallet.airlineId = :airlineId", {
        airlineId: filters.airlineId,
      });
    }

    if (filters.type) {
      qb.andWhere("transaction.referenceType = :type", { type: filters.type });
    }

    if (filters.startDate) {
      qb.andWhere("transaction.createdAt >= :startDate", {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      qb.andWhere("transaction.createdAt <= :endDate", {
        endDate: filters.endDate,
      });
    }

    const [transactions, totalCount] = await qb.getManyAndCount();

    requestLogger.debug("Wallet transaction query complete", {
      context: this.context,
      totalCount,
    });

    return { transactions, totalCount };
  }

  async getWalletsSummary(requestLogger: Logger): Promise<{
    totalWalletBalance: number;
    totalCreditIssued: number;
    totalCreditUsed: number;
  }> {
    requestLogger.debug("Querying wallets summary", { context: this.context });

    // usedCredit isn't a stored column — lockedAmount is reserved for
    // in-flight processes, so a wallet is only drawing on credit once
    // balance can no longer cover both zero AND what's locked, i.e.
    // (balance - lockedAmount) < 0. The shortfall is the credit used.
    const raw = await this.walletRepository
      .createQueryBuilder("wallet")
      .select("COALESCE(SUM(wallet.balance), 0)", "totalWalletBalance")
      .addSelect("COALESCE(SUM(wallet.creditLimit), 0)", "totalCreditIssued")
      .addSelect(
        "COALESCE(SUM(CASE WHEN (wallet.balance - wallet.lockedAmount) < 0 THEN (wallet.lockedAmount - wallet.balance) ELSE 0 END), 0)",
        "totalCreditUsed",
      )
      .getRawOne<{
        totalWalletBalance: string;
        totalCreditIssued: string;
        totalCreditUsed: string;
      }>();

    return {
      totalWalletBalance: Number(raw?.totalWalletBalance ?? 0),
      totalCreditIssued: Number(raw?.totalCreditIssued ?? 0),
      totalCreditUsed: Number(raw?.totalCreditUsed ?? 0),
    };
  }
}
