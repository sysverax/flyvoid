import { FlightStatus } from "./entities/enums";

// Shared rules for time-frame reporting on cancelled flights, used by both
// the dashboard trends and GET /cancelled-flights/summary?timeFrame=... so
// their numbers always agree.

/**
 * The timestamp that places a cancelled flight in a reporting period (a
 * TypeORM property path on the `flight` alias). Stored as a
 * `timestamp without time zone` holding UTC. Swap it here for a
 * `cancelled_at` column later.
 */
export const REPORTING_DATE_COLUMN = "flight.createdAt";

/** Every status except draft: the flight has actually been raised. */
export const RAISED_FLIGHT_STATUSES: FlightStatus[] = Object.values(
  FlightStatus,
).filter((status) => status !== FlightStatus.DRAFT);

/** Flights whose hotel cost is settled: the only ones counted as spend. */
export const SPEND_FLIGHT_STATUSES: FlightStatus[] = [
  FlightStatus.ALLOCATED,
  FlightStatus.PAID,
  FlightStatus.PUBLISHED,
];

/** "2026-10-21 18:30:00.000" - matches the UTC `timestamp without time zone` column. */
export const toUtcTimestampParam = (instant: Date): string =>
  instant.toISOString().replace("T", " ").replace("Z", "");
