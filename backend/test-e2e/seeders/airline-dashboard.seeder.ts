/**
 * Airline dashboard seeders — black-box e2e only.
 *
 * Raw SQL helpers for airlines, airports, airline access controls and
 * cancelled flights used by the dashboard trend specs.
 */
import { query } from "../helpers/db-client.helper";

export type DashboardFlightStatus =
  | "draft"
  | "in_progress"
  | "passengers_booking_confirmed"
  | "hotel_allocation_in_progress"
  | "allocated"
  | "paid"
  | "published";

/**
 * `timestamp without time zone` columns hold UTC. Pass an explicit UTC
 * string so pg doesn't serialise the Date in the test machine's timezone.
 */
function toUtcTimestamp(instant: Date): string {
  return instant.toISOString().replace("T", " ").replace("Z", "");
}

function randomLetters(length: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from(
    { length },
    () => letters[Math.floor(Math.random() * letters.length)],
  ).join("");
}

export async function insertDashboardAirline(params: {
  code: string;
  contactEmail: string;
  timezone: string;
  currency: string;
}): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO airlines
      (name, code, country_code, company_registration_number, contact_email, contact_phone, timezone, address, currency, platform_fee_percentage, is_active)
     VALUES ($1,$2,'LK',$3,$4,'+94110000000',$5,'E2E Street',$6,10,true)
     RETURNING id`,
    [
      `${params.code} Airline`,
      params.code,
      `${params.code}-REG`,
      params.contactEmail,
      params.timezone,
      params.currency,
    ],
  );
  return res.rows[0].id;
}

export async function insertDashboardAirport(
  createdByAdminId: number,
): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO airports
      (name, iata_code, icao_code, country_code, city, latitude, longitude, timezone, is_active, type, postal_code, created_by)
     VALUES ($1,$2,$3,'LK','Colombo',6.9271,79.8612,'Asia/Colombo',true,'INTERNATIONAL','00100',$4)
     RETURNING id`,
    [
      "E2E Dashboard Airport",
      randomLetters(3),
      randomLetters(4),
      createdByAdminId,
    ],
  );
  return res.rows[0].id;
}

export async function grantAirlineAccess(
  airlineUserId: number,
  asset: string,
  action: "VIEW" | "EDIT",
): Promise<void> {
  await query(
    `INSERT INTO airline_access_controls (airline_user_id, asset, access_action)
     VALUES ($1, $2, $3)`,
    [airlineUserId, asset, action],
  );
}

export async function insertDashboardCancelledFlight(params: {
  airlineId: number;
  airportId: number;
  status: DashboardFlightStatus;
  createdAt: Date;
  /** "YYYY-MM-DD"; defaults to the UTC date of createdAt. */
  cancellationDate?: string;
  totalAdults?: number;
  totalChildren?: number;
  totalPrice?: number;
}): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO cancelled_flights
      (flight_number, airline_id, departure_airport_id, arrival_airport_id, cancellation_date, status, total_adults, total_children, total_price, platform_fee_percentage, created_at, updated_at)
     VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,10,$9,$9)
     RETURNING id`,
    [
      `E2E${Math.floor(Math.random() * 100000)}`,
      params.airlineId,
      params.airportId,
      params.cancellationDate ?? params.createdAt.toISOString().slice(0, 10),
      params.status,
      params.totalAdults ?? 0,
      params.totalChildren ?? 0,
      params.totalPrice ?? 0,
      toUtcTimestamp(params.createdAt),
    ],
  );
  return res.rows[0].id;
}

export async function deleteDashboardData(params: {
  airlineIds: number[];
  airportIds: number[];
}): Promise<void> {
  if (params.airlineIds.length) {
    await query(`DELETE FROM cancelled_flights WHERE airline_id = ANY($1)`, [
      params.airlineIds,
    ]);
    await query(`DELETE FROM airline_users WHERE airline_id = ANY($1)`, [
      params.airlineIds,
    ]);
    await query(`DELETE FROM airlines WHERE id = ANY($1)`, [
      params.airlineIds,
    ]);
  }
  if (params.airportIds.length) {
    await query(`DELETE FROM airports WHERE id = ANY($1)`, [
      params.airportIds,
    ]);
  }
}
