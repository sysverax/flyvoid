import { FlightStatus } from "./entities/enums";

// Switches and configurable values: every one is listed in
// docs/configuration-switches.md. Update that page when you change this file.

/**
 * The manual "Pay" step (POST /cancelled-flights/:id/payment, ALLOCATED -> PAID).
 * Off: hotels are charged to the airline wallet as each PNR is booked
 * (docs/wallet-cancellation-payment.md), so an ALLOCATED flight is already
 * paid for and goes straight to publish. Set to true to bring the step back.
 */
export const FLIGHT_PAYMENT_STEP_ENABLED = false;

/**
 * Oldest age that counts as a child on a booking (ages 0 to this, inclusive).
 * Must match MAX_CHILD_AGE in frontend/airline/src/lib/constants.ts.
 */
export const MAX_CHILD_AGE = 12;

/** Statuses from which a flight can be published. PAID keeps older flights publishable. */
export const PUBLISHABLE_FLIGHT_STATUSES: FlightStatus[] =
  FLIGHT_PAYMENT_STEP_ENABLED
    ? [FlightStatus.PAID]
    : [FlightStatus.ALLOCATED, FlightStatus.PAID];

/** Statuses in which hotel confirmations (PDF, email) can be sent. */
export const CONFIRMATION_FLIGHT_STATUSES: FlightStatus[] = [
  ...PUBLISHABLE_FLIGHT_STATUSES,
  FlightStatus.PUBLISHED,
];
