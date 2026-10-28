import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { Logger } from "winston";
import { LoggerService } from "../common/logger/logger.service";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-request.interface";
import { UserType } from "../common/constants/user.constants";
import { WalletRepository } from "./repositories/wallet.repository";
import { WalletEntity } from "./entities/wallet.entity";
import {
  PAYMENT_STATUSES,
  TRANSACTION_REFERENCE_TYPES,
  TRANSACTION_TYPES,
} from "./constants";
import {
  CreditLimitHistoryResponseDto,
  CreditLimitUpdateResponseDto,
  UpdateCreditLimitRequestDto,
  CreateWalletAdjustmentRequestDto,
  GetWalletsSummaryQueryDto,
  GetWalletTransactionsQueryDto,
  WalletAdjustmentResponseDto,
  WalletBalanceResponseDto,
  WalletSummaryResponseDto,
  WalletTransactionListResponseDto,
} from "./dto";

@Injectable()
export class WalletService {
  private readonly context = "WalletService";

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly logger: LoggerService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Create adjustment (platform only) ───────────────────────────────────

  async createAdjustment(
    authenticatedUser: AuthenticatedUser,
    dto: CreateWalletAdjustmentRequestDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<WalletAdjustmentResponseDto> {
    requestLogger.info("Creating wallet adjustment", {
      context: this.context,
      airlineId: dto.airlineId,
      type: dto.type,
      amount: dto.amount,
    });

    const result = await this.dataSource.transaction(async (manager) => {
      // Row lock so concurrent adjustments to the same wallet serialize
      // rather than reading/writing a stale balance.
      const wallet = await this.walletRepository.lockWalletByAirlineId(
        dto.airlineId,
        requestId,
        manager,
      );

      if (!wallet) {
        requestLogger.warn("Wallet not found for airline", {
          context: this.context,
          airlineId: dto.airlineId,
        });
        throw new NotFoundException({
          message: `Wallet not found for airline '${dto.airlineId}'`,
          details: `No wallet exists for airline '${dto.airlineId}'`,
          solution: `Create a wallet for airline '${dto.airlineId}' before attempting adjustments`,
        });
      }

      const openingBalance = Number(wallet.balance);
      const lockedAmount = Number(wallet.lockedAmount);
      const closingBalance =
        dto.type === TRANSACTION_TYPES.CREDIT
          ? this.round(openingBalance + dto.amount)
          : this.round(openingBalance - dto.amount);

      // lockedAmount is reserved for in-flight processes (e.g. a pending
      // cancelled-flight charge) that will later deduct it from balance too,
      // so a manual debit must never eat into funds already held.
      if (
        dto.type === TRANSACTION_TYPES.DEBIT &&
        closingBalance < lockedAmount
      ) {
        requestLogger.warn(
          "Debit would breach funds locked for pending processes",
          {
            context: this.context,
            airlineId: dto.airlineId,
            openingBalance,
            lockedAmount,
            amount: dto.amount,
          },
        );
        throw new BadRequestException({
          message: `Insufficient available balance for this debit — ${lockedAmount} is locked for pending processes`,
          details: `The requested debit amount would reduce the wallet balance below the funds reserved for pending processes`,
          solution: `Ensure sufficient available balance before attempting this debit`,
        });
      }

      const adjustment = await this.walletRepository.recordAdjustment(
        {
          walletId: wallet.id,
          type: dto.type,
          amount: dto.amount,
          reason: dto.reason ?? "",
          adjustedByAdminId: authenticatedUser.sub,
        },
        requestId,
        manager,
      );

      const transaction = await this.walletRepository.recordTransaction(
        {
          walletId: wallet.id,
          type: dto.type,
          referenceType: TRANSACTION_REFERENCE_TYPES.ADJUSTMENT,
          referenceId: adjustment.id,
          amount: dto.amount,
          balanceBefore: openingBalance,
          balanceAfter: closingBalance,
          description: dto.reason,
          createdBy: authenticatedUser.sub,
        },
        requestId,
        manager,
      );

      await this.walletRepository.updateWalletBalances(
        wallet.id,
        { balance: closingBalance },
        requestId,
        manager,
      );

      return {
        wallet,
        adjustment,
        transaction,
        openingBalance,
        closingBalance,
      };
    });

    requestLogger.info("Wallet adjustment created successfully", {
      context: this.context,
      airlineId: dto.airlineId,
      adjustmentId: result.adjustment.id,
      transactionId: result.transaction.id,
    });

    return {
      adjustmentId: result.adjustment.id,
      transactionId: result.transaction.id,
      airlineId: dto.airlineId,
      walletId: result.wallet.id,
      type: dto.type,
      amount: dto.amount,
      openingBalance: result.openingBalance,
      closingBalance: result.closingBalance,
      creditLimit: Number(result.wallet.creditLimit),
      reason: dto.reason ?? null,
      createdAt: result.transaction.createdAt.toISOString(),
    };
  }

  // ── Update credit limit (platform only) ─────────────────────────────────

  /**
   * Sets an onboarded airline's credit limit and records the change in
   * wallet_credit_limit_history. Any value >= 0 is allowed, even below what
   * the airline already uses: available balance then goes negative and the
   * next hotel allocation's wallet lock fails until the wallet is topped up.
   * Runs that already hold their lock are not affected. Not a balance
   * movement, so no wallet transaction is written.
   */
  async updateCreditLimit(
    authenticatedUser: AuthenticatedUser,
    airlineId: number,
    dto: UpdateCreditLimitRequestDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<CreditLimitUpdateResponseDto> {
    requestLogger.info("Updating airline credit limit", {
      context: this.context,
      airlineId,
      creditLimit: dto.creditLimit,
      adminId: authenticatedUser.sub,
    });

    const result = await this.dataSource.transaction(async (manager) => {
      // Same row lock as adjustments and allocation wallet locks, so the
      // change cannot interleave with a lock, charge or adjustment.
      const wallet = await this.walletRepository.lockWalletByAirlineId(
        airlineId,
        requestId,
        manager,
      );
      if (!wallet) {
        requestLogger.warn("Wallet not found for airline", {
          context: this.context,
          airlineId,
        });
        throw new NotFoundException({
          message: `Wallet not found for airline '${airlineId}'`,
          details: `No wallet exists for airline '${airlineId}'; it is created when the airline finishes onboarding`,
          solution:
            "Update the credit limit on the invitation until the airline is onboarded",
        });
      }

      const previousCreditLimit = this.round(Number(wallet.creditLimit));
      const creditLimit = this.round(dto.creditLimit);
      if (previousCreditLimit === creditLimit) {
        throw new BadRequestException({
          message: `Credit limit is already ${creditLimit}`,
          details: "The new credit limit is the same as the current one",
          solution: "Enter a different credit limit",
        });
      }

      await this.walletRepository.updateCreditLimit(
        wallet.id,
        creditLimit,
        requestId,
        manager,
      );
      const history = await this.walletRepository.recordCreditLimitChange(
        {
          walletId: wallet.id,
          previousCreditLimit,
          newCreditLimit: creditLimit,
          reason: dto.reason,
          changedByAdminId: authenticatedUser.sub,
        },
        requestId,
        manager,
      );
      return { wallet, previousCreditLimit, creditLimit, history };
    });

    const balance = this.round(Number(result.wallet.balance));
    const lockedAmount = this.round(Number(result.wallet.lockedAmount));
    const availableBefore = this.round(
      balance + result.previousCreditLimit - lockedAmount,
    );
    const availableBalance = this.round(
      balance + result.creditLimit - lockedAmount,
    );
    const changeLog = {
      context: this.context,
      airlineId,
      walletId: result.wallet.id,
      historyId: result.history.id,
      adminId: authenticatedUser.sub,
      previousCreditLimit: result.previousCreditLimit,
      creditLimit: result.creditLimit,
      balance,
      lockedAmount,
      availableBefore,
      availableBalance,
    };
    if (availableBalance < 0) {
      requestLogger.warn(
        "Credit limit updated; available balance is negative, new hotel allocations are blocked until the wallet is topped up",
        changeLog,
      );
    } else {
      requestLogger.info("Credit limit updated", changeLog);
    }

    return {
      airlineId,
      walletId: result.wallet.id,
      previousCreditLimit: result.previousCreditLimit,
      creditLimit: result.creditLimit,
      balance,
      lockedAmount,
      availableBalance,
      currency: result.wallet.currency,
      reason: dto.reason,
      changedAt: result.history.createdAt.toISOString(),
    };
  }

  /** An airline's credit limit changes, newest first (onboarding included). */
  async getCreditLimitHistory(
    airlineId: number,
    requestId: string,
    requestLogger: Logger,
  ): Promise<CreditLimitHistoryResponseDto> {
    const wallet = await this.walletRepository.findWalletByAirlineId(
      airlineId,
      requestId,
    );
    if (!wallet) {
      throw new NotFoundException({
        message: `Wallet not found for airline '${airlineId}'`,
        details: `No wallet exists for airline '${airlineId}'`,
        solution: "The wallet is created when the airline finishes onboarding",
      });
    }
    const rows = await this.walletRepository.findCreditLimitHistoryWithAdmins(
      wallet.id,
      requestId,
    );
    requestLogger.info("Fetched credit limit history", {
      context: this.context,
      airlineId,
      walletId: wallet.id,
      entries: rows.length,
    });
    const creditLimit = this.round(Number(wallet.creditLimit));
    const balance = this.round(Number(wallet.balance));
    const lockedAmount = this.round(Number(wallet.lockedAmount));
    return {
      airlineId,
      creditLimit,
      balance,
      lockedAmount,
      availableBalance: this.round(balance + creditLimit - lockedAmount),
      currency: wallet.currency,
      history: rows.map((row) => ({
        id: Number(row.id),
        previousCreditLimit: Number(row.previousCreditLimit),
        newCreditLimit: Number(row.newCreditLimit),
        reason: row.reason,
        changedBy:
          row.adminId === null || row.adminId === undefined
            ? null
            : {
                id: Number(row.adminId),
                name: `${row.adminFirstName ?? ""} ${row.adminLastName ?? ""}`.trim(),
                email: row.adminEmail ?? "",
              },
        changedAt: new Date(row.createdAt).toISOString(),
      })),
    };
  }

  // ── List transactions (platform + airline) ──────────────────────────────

  async listTransactions(
    authenticatedUser: AuthenticatedUser,
    query: GetWalletTransactionsQueryDto,
    requestLogger: Logger,
  ): Promise<WalletTransactionListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    requestLogger.info("Listing wallet transactions", {
      context: this.context,
      userType: authenticatedUser.userType,
      query,
    });

    // startDate/endDate format and order are validated by the DTO
    // (TimestampRangeQueryDto); both are UTC Dates here.
    const airlineScopeId = this.resolveAirlineScope(
      authenticatedUser,
      query.airlineId,
    );

    // No status column exists yet — every transaction today represents a
    // completed manual transfer, so a status filter for anything other than
    // SUCCESS can never match a real record.
    if (query.status && query.status !== PAYMENT_STATUSES.SUCCESS) {
      return {
        transactions: [],
        pagination: { currentPage: page, limit, totalCount: 0 },
      };
    }

    const { transactions, totalCount } =
      await this.walletRepository.findTransactionsWithPaginationAndFilters(
        {
          page,
          limit,
          airlineId: airlineScopeId,
          type: query.type,
          startDate: query.startDate,
          endDate: query.endDate,
          search: query.search?.trim(),
        },
        requestLogger,
      );

    return {
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        airline: {
          id: transaction.wallet.airline.id,
          name: transaction.wallet.airline.name,
          code: transaction.wallet.airline.code,
        },
        openingBalance: Number(transaction.balanceBefore),
        transactionAmount: Number(transaction.amount),
        closingBalance: Number(transaction.balanceAfter),
        transactionType: transaction.type,
        type: transaction.referenceType,
        creditLimit: Number(transaction.wallet.creditLimit),
        reason: transaction.description ?? null,
        status: PAYMENT_STATUSES.SUCCESS,
        createdAt: transaction.createdAt.toISOString(),
      })),
      pagination: {
        currentPage: page,
        limit,
        totalCount,
      },
    };
  }

  // ── Get wallet balance (platform + airline) ─────────────────────────────

  async getWalletBalance(
    authenticatedUser: AuthenticatedUser,
    requestId: string,
    requestLogger: Logger,
  ): Promise<WalletBalanceResponseDto> {
    const airlineId = this.requireAirlineScope(
      authenticatedUser,
      authenticatedUser.airlineId,
    );

    requestLogger.info("Fetching wallet balance", {
      context: this.context,
      airlineId,
    });

    const wallet = await this.walletRepository.findWalletByAirlineId(
      airlineId,
      requestId,
    );

    if (!wallet) {
      throw new NotFoundException(
        `Wallet not found for airline '${airlineId}'`,
      );
    }

    return this.toBalanceResponse(wallet);
  }

  // ── Summary (platform only) ──────────────────────────────────────────────

  async getWalletsSummary(
    query: GetWalletsSummaryQueryDto,
    requestLogger: Logger,
  ): Promise<WalletSummaryResponseDto> {
    requestLogger.info("Fetching wallets summary", {
      context: this.context,
      query,
    });

    return this.walletRepository.getWalletsSummary(
      {
        search: query.search?.trim() || undefined,
        countryCode: query.countryCode,
        isActive: query.isActive,
        isSuspended: query.isSuspended,
      },
      requestLogger,
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Airline users are always scoped to their own airline; platform users
   * may optionally scope to one airline via the query param (undefined =
   * all airlines). */
  private resolveAirlineScope(
    authenticatedUser: AuthenticatedUser,
    queryAirlineId?: number,
  ): number | undefined {
    if (authenticatedUser.userType === UserType.AIRLINE) {
      if (!authenticatedUser.airlineId) {
        throw new BadRequestException(
          "Authenticated airline user does not have an associated airlineId",
        );
      }

      if (queryAirlineId && queryAirlineId !== authenticatedUser.airlineId) {
        throw new BadRequestException(
          "airlineId filter is not allowed for other airlines",
        );
      }

      return authenticatedUser.airlineId;
    }

    return queryAirlineId;
  }

  /** Same as resolveAirlineScope, but airlineId is mandatory in the result
   * (used by single-wallet lookups, where platform users must name one). */
  private requireAirlineScope(
    authenticatedUser: AuthenticatedUser,
    queryAirlineId?: number,
  ): number {
    const airlineId = this.resolveAirlineScope(
      authenticatedUser,
      queryAirlineId,
    );

    if (!airlineId) {
      throw new BadRequestException("airlineId is required for platform users");
    }

    return airlineId;
  }

  private toBalanceResponse(wallet: WalletEntity): WalletBalanceResponseDto {
    return {
      walletId: wallet.id,
      airlineId: wallet.airlineId,
      balance: Number(wallet.balance),
      creditLimit: Number(wallet.creditLimit),
      lockedAmount: Number(wallet.lockedAmount),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
