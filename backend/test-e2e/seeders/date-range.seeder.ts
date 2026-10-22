/**
 * Date-range filter seeders — black-box e2e only.
 *
 * Raw SQL helpers for wallets / wallet transactions (timestamp filters) and
 * passenger bookings / hotel bookings (DATE filters). Builds on the airline,
 * airport and cancelled-flight helpers in airline-dashboard.seeder.ts.
 */
import { query } from "../helpers/db-client.helper";

/** `timestamp without time zone` columns hold UTC: pass an explicit UTC string. */
function toUtcTimestamp(instant: Date): string {
  return instant.toISOString().replace("T", " ").replace("Z", "");
}

export async function insertWallet(airlineId: number): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO wallets (airline_id, balance, credit_limit, locked_amount, currency)
     VALUES ($1, 0, 0, 0, 'USD')
     RETURNING id`,
    [airlineId],
  );
  return res.rows[0].id;
}

export async function insertWalletTransaction(params: {
  walletId: number;
  createdAt: Date;
  amount?: number;
}): Promise<number> {
  const amount = params.amount ?? 10;
  const res = await query<{ id: number }>(
    `INSERT INTO wallet_transactions
      (wallet_id, type, reference_type, reference_id, amount, balance_before, balance_after, description, created_at)
     VALUES ($1, 'CREDIT', 'ADJUSTMENT', 0, $2, 0, $2, 'e2e date range', $3)
     RETURNING id`,
    [params.walletId, amount, toUtcTimestamp(params.createdAt)],
  );
  return res.rows[0].id;
}

export async function insertProvider(code: string): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO providers (code, name, is_active) VALUES ($1, $2, true) RETURNING id`,
    [code, `E2E provider ${code}`],
  );
  return res.rows[0].id;
}

/** A passenger booking (PNR) whose hotel is booked, so it counts as live. */
export async function insertBookedPassenger(
  cancelledFlightId: number,
  email: string,
): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO cancelled_flight_bookings
      (cancelled_flight_id, pnr, first_name, last_name, email, phone, residency, travel_class, adults, children, allocation_status)
     VALUES ($1, $2, 'E2E', 'Passenger', $3, '+94110000000', 'LK', 'economy', 1, 0, 'confirmed')
     RETURNING id`,
    [cancelledFlightId, `E2E${Math.floor(Math.random() * 1_000_000)}`, email],
  );
  return res.rows[0].id;
}

/** A successful hotel booking with the given check-in date (YYYY-MM-DD). */
export async function insertHotelBooking(params: {
  cancelledFlightId: number;
  bookingId: number;
  providerId: number;
  checkInDate: string;
}): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO hotel_bookings
      (cancelled_flight_id, booking_id, provider_id, attempt_order, status, check_in_date, check_out_date, provider_request_id)
     VALUES ($1, $2, $3, 1, 'success', $4::date, $4::date + 1, $5)
     RETURNING id`,
    [
      params.cancelledFlightId,
      params.bookingId,
      params.providerId,
      params.checkInDate,
      `e2e-${Math.random().toString(36).slice(2, 12)}`,
    ],
  );
  return res.rows[0].id;
}

/**
 * Removes wallet rows (wallet_transactions has no cascade from wallets) and
 * providers. Call before deleteDashboardData, which removes airlines and
 * cancelled flights (cascading to bookings and hotel bookings).
 */
export async function deleteDateRangeData(params: {
  airlineIds: number[];
  providerIds: number[];
}): Promise<void> {
  if (params.airlineIds.length) {
    await query(
      `DELETE FROM wallet_transactions
        WHERE wallet_id IN (SELECT id FROM wallets WHERE airline_id = ANY($1))`,
      [params.airlineIds],
    );
    await query(`DELETE FROM wallets WHERE airline_id = ANY($1)`, [
      params.airlineIds,
    ]);
  }
  if (params.providerIds.length) {
    await query(
      `DELETE FROM hotel_bookings WHERE provider_id = ANY($1)`,
      [params.providerIds],
    );
    await query(`DELETE FROM providers WHERE id = ANY($1)`, [
      params.providerIds,
    ]);
  }
}
