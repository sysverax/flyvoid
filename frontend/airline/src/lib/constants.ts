// Switches and configurable values: every one is listed in
// docs/configuration-switches.md. Update that page when you change this file.

export const PLATFORM_FEE_PERCENT = 10;

// Payments is hidden for the initial release. Set to true to restore the
// sidebar tab, the /payments route and the Payments row in Manage Users.
export const PAYMENTS_ENABLED = false;

// Number of items loaded into dropdowns whose options come from an API
// (airports, cancelled flights).
export const DROPDOWN_LIMIT = 10;

// The cancellation wizard's "Payment" step (POST /cancelled-flights/:id/payment).
// Off: hotels are charged to the wallet as each PNR is booked, so an allocated
// flight goes straight from Booking Summary to Publish. Must match the
// backend's FLIGHT_PAYMENT_STEP_ENABLED.
export const FLIGHT_PAYMENT_STEP_ENABLED = false;
