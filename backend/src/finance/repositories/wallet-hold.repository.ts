import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { Logger } from "winston";
import {
  TRANSACTION_REFERENCE_TYPES,
  TRANSACTION_TYPES,
  WALLET_HOLD_ITEM_STATUSES,
  WALLET_HOLD_STATUSES,
} from "../constants";

/** The wallet cannot cover the estimated cost of the PNRs a run is about to book. */
export class InsufficientWalletBalanceError extends Error {
  constructor(
    readonly available: number,
    readonly required: number,
  ) {
    super(
      `Insufficient wallet balance: ${available.toFixed(2)} available, ${required.toFixed(2)} required to book the remaining PNRs`,
    );
    this.name = "InsufficientWalletBalanceError";
  }
}

export interface WalletHoldItemInput {
  bookingId: number;
  amount: number;
}

interface LockedWallet {
  id: number;
  balance: number;
  creditLimit: number;
  lockedAmount: number;
}

const toMoney = (value: number): string =>
  (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);

/**
 * Wallet holds for cancelled-flight hotel bookings
 * (docs/wallet-cancellation-payment.md). Every method runs inside the caller's
 * transaction. Lock order: PNR booking -> hold items -> wallet -> holds; the
 * wallet row is locked last and nothing else is locked after it.
 */
@Injectable()
export class WalletHoldRepository {
  private readonly context = "WalletHoldRepository";

  /**
   * Locks the estimated cost of the given PNRs in the airline's wallet for one
   * run. PNRs that already have a HELD share (e.g. from an interrupted run) are
   * skipped, so nothing is locked twice.
   */
  async reserveForRun(
    manager: EntityManager,
    params: {
      airlineId: number;
      cancelledFlightId: number;
      runId: string;
      items: WalletHoldItemInput[];
    },
    requestLogger: Logger,
  ): Promise<{ lockedAmount: number; heldPnrs: number; alreadyHeldPnrs: number }> {
    const bookingIds = params.items.map((item) => item.bookingId);
    const alreadyHeld = new Set<number>(
      bookingIds.length
        ? (
            (await manager.query(
              `SELECT booking_id FROM wallet_hold_items
                WHERE booking_id = ANY($1) AND status = $2`,
              [bookingIds, WALLET_HOLD_ITEM_STATUSES.HELD],
            )) as Array<{ booking_id: number }>
          ).map((row) => Number(row.booking_id))
        : [],
    );
    const items = params.items.filter(
      (item) => !alreadyHeld.has(item.bookingId) && item.amount > 0,
    );
    const total = Number(
      toMoney(items.reduce((sum, item) => sum + item.amount, 0)),
    );
    if (items.length === 0) {
      return {
        lockedAmount: 0,
        heldPnrs: 0,
        alreadyHeldPnrs: alreadyHeld.size,
      };
    }

    const wallet = await this.lockWallet(manager, params.airlineId);
    if (!wallet) {
      throw new Error(`Wallet not found for airline '${params.airlineId}'`);
    }
    // UPDATE through manager.query returns [rows, rowCount].
    const [, lockedRows] = (await manager.query(
      `UPDATE wallets
          SET locked_amount = locked_amount + $1, updated_at = now()
        WHERE id = $2
          AND balance + credit_limit - locked_amount - $1 >= 0`,
      [toMoney(total), wallet.id],
    )) as [unknown[], number];
    if (lockedRows === 0) {
      const available = wallet.balance + wallet.creditLimit - wallet.lockedAmount;
      requestLogger.warn("Wallet cannot cover the hotel booking estimate", {
        context: this.context,
        airlineId: params.airlineId,
        cancelledFlightId: params.cancelledFlightId,
        runId: params.runId,
        available,
        required: total,
      });
      throw new InsufficientWalletBalanceError(available, total);
    }

    const [hold] = (await manager.query(
      `INSERT INTO wallet_holds
              (wallet_id, cancelled_flight_id, run_id, initial_amount, remaining_amount, status)
       VALUES ($1, $2, $3, $4, $4, $5)
       ON CONFLICT (run_id) DO UPDATE
          SET initial_amount = wallet_holds.initial_amount + EXCLUDED.initial_amount,
              remaining_amount = wallet_holds.remaining_amount + EXCLUDED.remaining_amount,
              status = EXCLUDED.status,
              updated_at = now()
       RETURNING id`,
      [
        wallet.id,
        params.cancelledFlightId,
        params.runId,
        toMoney(total),
        WALLET_HOLD_STATUSES.OPEN,
      ],
    )) as Array<{ id: number }>;
    await manager.query(
      `INSERT INTO wallet_hold_items (hold_id, booking_id, amount, status)
       SELECT $1, booking_id, amount, $4
         FROM unnest($2::int[], $3::numeric[]) AS t(booking_id, amount)`,
      [
        hold.id,
        items.map((item) => item.bookingId),
        items.map((item) => toMoney(item.amount)),
        WALLET_HOLD_ITEM_STATUSES.HELD,
      ],
    );

    requestLogger.info("Locked wallet funds for hotel bookings", {
      context: this.context,
      airlineId: params.airlineId,
      cancelledFlightId: params.cancelledFlightId,
      runId: params.runId,
      holdId: hold.id,
      amount: total,
      heldPnrs: items.length,
      alreadyHeldPnrs: alreadyHeld.size,
    });
    return {
      lockedAmount: total,
      heldPnrs: items.length,
      alreadyHeldPnrs: alreadyHeld.size,
    };
  }

  /**
   * Charges a confirmed hotel booking: balance goes down by its actual cost
   * (always allowed, even below zero) and the PNR's HELD share is released.
   * Flights that never had a hold (allocated before wallet payment existed)
   * are not charged. Returns false when nothing was charged.
   */
  async chargeBooking(
    manager: EntityManager,
    params: {
      airlineId: number;
      cancelledFlightId: number;
      bookingId: number;
      hotelBookingId: number;
      amount: number;
      description: string;
      createdBy?: number | null;
    },
    requestLogger: Logger,
  ): Promise<boolean> {
    const holds = (await manager.query(
      `SELECT 1 FROM wallet_holds WHERE cancelled_flight_id = $1 LIMIT 1`,
      [params.cancelledFlightId],
    )) as unknown[];
    if (holds.length === 0) {
      requestLogger.info(
        "Flight has no wallet hold; hotel booking not charged to the wallet",
        {
          context: this.context,
          cancelledFlightId: params.cancelledFlightId,
          hotelBookingId: params.hotelBookingId,
        },
      );
      return false;
    }

    const [items] = (await manager.query(
      `UPDATE wallet_hold_items
          SET status = $1, hotel_booking_id = $2, updated_at = now()
        WHERE booking_id = $3
          AND status = $4
          AND hold_id IN (SELECT id FROM wallet_holds WHERE cancelled_flight_id = $5)
        RETURNING hold_id, amount`,
      [
        WALLET_HOLD_ITEM_STATUSES.CHARGED,
        params.hotelBookingId,
        params.bookingId,
        WALLET_HOLD_ITEM_STATUSES.HELD,
        params.cancelledFlightId,
      ],
    )) as [Array<{ hold_id: number; amount: string }>, number];
    const item = items[0];
    const release = item ? Number(item.amount) : 0;

    const wallet = await this.lockWallet(manager, params.airlineId);
    if (!wallet) {
      throw new Error(`Wallet not found for airline '${params.airlineId}'`);
    }

    let charge = 0;
    if (params.amount > 0) {
      const inserted = (await manager.query(
        `INSERT INTO wallet_transactions
                (wallet_id, type, reference_type, reference_id, amount,
                 balance_before, balance_after, description, created_by)
         SELECT w.id, $2, $3, $4, $5, w.balance, w.balance - $5, $6, $7
           FROM wallets w
          WHERE w.id = $1
         ON CONFLICT (reference_type, reference_id)
           WHERE reference_type = 'BOOKING' AND type = 'DEBIT'
           DO NOTHING
         RETURNING id`,
        [
          wallet.id,
          TRANSACTION_TYPES.DEBIT,
          TRANSACTION_REFERENCE_TYPES.BOOKING,
          params.hotelBookingId,
          toMoney(params.amount),
          params.description,
          params.createdBy ?? null,
        ],
      )) as Array<{ id: number }>;
      if (inserted.length === 0) {
        requestLogger.warn("Hotel booking was already charged to the wallet", {
          context: this.context,
          cancelledFlightId: params.cancelledFlightId,
          hotelBookingId: params.hotelBookingId,
        });
      } else {
        charge = params.amount;
      }
    } else {
      requestLogger.warn("Confirmed hotel booking has no cost to charge", {
        context: this.context,
        cancelledFlightId: params.cancelledFlightId,
        hotelBookingId: params.hotelBookingId,
      });
    }

    const [updated] = (await manager.query(
      `UPDATE wallets
          SET balance = balance - $1,
              locked_amount = GREATEST(locked_amount - $2, 0),
              updated_at = now()
        WHERE id = $3
        RETURNING balance, credit_limit, locked_amount`,
      [toMoney(charge), toMoney(release), wallet.id],
    )) as [
      Array<{ balance: string; credit_limit: string; locked_amount: string }>,
      number,
    ];
    if (item) {
      await this.reduceHolds(manager, [
        { holdId: Number(item.hold_id), amount: release },
      ]);
    }

    const after = updated[0];
    const available =
      Number(after.balance) +
      Number(after.credit_limit) -
      Number(after.locked_amount);
    const details = {
      context: this.context,
      airlineId: params.airlineId,
      cancelledFlightId: params.cancelledFlightId,
      bookingId: params.bookingId,
      hotelBookingId: params.hotelBookingId,
      charged: charge,
      released: release,
      balance: Number(after.balance),
      lockedAmount: Number(after.locked_amount),
      available,
    };
    if (available < 0) {
      // Allowed: the supplier already booked the hotel. The next lock fails
      // until the airline tops up.
      requestLogger.warn(
        "Charged hotel booking to the wallet; available balance is now negative",
        details,
      );
    } else {
      requestLogger.info("Charged hotel booking to the wallet", details);
    }
    return charge > 0;
  }

  /** Releases the HELD shares of the given PNRs of a flight. Returns the amount released. */
  async releaseBookings(
    manager: EntityManager,
    params: { airlineId: number; cancelledFlightId: number; bookingIds: number[] },
    requestLogger: Logger,
  ): Promise<number> {
    if (params.bookingIds.length === 0) return 0;
    const rows = (await manager.query(
      `SELECT id, hold_id, amount FROM wallet_hold_items
        WHERE booking_id = ANY($1)
          AND status = $2
          AND hold_id IN (SELECT id FROM wallet_holds WHERE cancelled_flight_id = $3)
        ORDER BY id
        FOR UPDATE`,
      [
        params.bookingIds,
        WALLET_HOLD_ITEM_STATUSES.HELD,
        params.cancelledFlightId,
      ],
    )) as Array<{ id: number; hold_id: number; amount: string }>;
    if (rows.length === 0) return 0;
    await manager.query(
      `UPDATE wallet_hold_items SET status = $1, updated_at = now()
        WHERE id = ANY($2)`,
      [WALLET_HOLD_ITEM_STATUSES.RELEASED, rows.map((row) => row.id)],
    );

    const total = Number(
      toMoney(rows.reduce((sum, row) => sum + Number(row.amount), 0)),
    );
    const wallet = await this.lockWallet(manager, params.airlineId);
    if (!wallet) {
      throw new Error(`Wallet not found for airline '${params.airlineId}'`);
    }
    await manager.query(
      `UPDATE wallets
          SET locked_amount = GREATEST(locked_amount - $1, 0), updated_at = now()
        WHERE id = $2`,
      [toMoney(total), wallet.id],
    );
    const byHold = new Map<number, number>();
    for (const row of rows) {
      const holdId = Number(row.hold_id);
      byHold.set(holdId, (byHold.get(holdId) ?? 0) + Number(row.amount));
    }
    await this.reduceHolds(
      manager,
      [...byHold].map(([holdId, amount]) => ({ holdId, amount })),
    );

    requestLogger.info("Released wallet funds of unbooked PNRs", {
      context: this.context,
      airlineId: params.airlineId,
      cancelledFlightId: params.cancelledFlightId,
      bookings: params.bookingIds,
      released: total,
    });
    return total;
  }

  /** PNRs of a flight that still have a HELD share. */
  async findHeldBookingIds(
    manager: EntityManager,
    cancelledFlightId: number,
  ): Promise<number[]> {
    const rows = (await manager.query(
      `SELECT i.booking_id FROM wallet_hold_items i
         JOIN wallet_holds h ON h.id = i.hold_id
        WHERE h.cancelled_flight_id = $1 AND i.status = $2
        ORDER BY i.booking_id`,
      [cancelledFlightId, WALLET_HOLD_ITEM_STATUSES.HELD],
    )) as Array<{ booking_id: number }>;
    return rows.map((row) => Number(row.booking_id));
  }

  private async lockWallet(
    manager: EntityManager,
    airlineId: number,
  ): Promise<LockedWallet | null> {
    await manager.query(`SET LOCAL lock_timeout = '5s'`);
    const [wallet] = (await manager.query(
      `SELECT id, balance, credit_limit, locked_amount FROM wallets
        WHERE airline_id = $1
        FOR UPDATE`,
      [airlineId],
    )) as Array<{
      id: number;
      balance: string;
      credit_limit: string;
      locked_amount: string;
    }>;
    return wallet
      ? {
          id: Number(wallet.id),
          balance: Number(wallet.balance),
          creditLimit: Number(wallet.credit_limit),
          lockedAmount: Number(wallet.locked_amount),
        }
      : null;
  }

  /** Lowers each hold's remaining amount and closes holds with no HELD item left. */
  private async reduceHolds(
    manager: EntityManager,
    reductions: Array<{ holdId: number; amount: number }>,
  ): Promise<void> {
    for (const { holdId, amount } of reductions.sort(
      (a, b) => a.holdId - b.holdId,
    )) {
      await manager.query(
        `UPDATE wallet_holds h
            SET remaining_amount = GREATEST(h.remaining_amount - $1, 0),
                status = CASE
                  WHEN EXISTS (SELECT 1 FROM wallet_hold_items i
                                WHERE i.hold_id = h.id AND i.status = $3)
                  THEN h.status ELSE $4 END,
                updated_at = now()
          WHERE h.id = $2`,
        [
          toMoney(amount),
          holdId,
          WALLET_HOLD_ITEM_STATUSES.HELD,
          WALLET_HOLD_STATUSES.CLOSED,
        ],
      );
    }
  }
}
