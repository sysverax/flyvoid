// Switches and configurable values: every one is listed in
// docs/configuration-switches.md. Update that page when you change this file.

// Payments is hidden for the initial release. Set to true to restore the
// sidebar tab, the /payments route and the PAYMENTS & REVENUE rows in Manage Users.
export const PAYMENTS_ENABLED = false;

// The cancelled flight "Payment" step. Off: hotels are charged to the airline
// wallet as each PNR is booked, so "paid" is only seen on older flights and
// the status filter hides it. Must match the backend's and the airline
// portal's FLIGHT_PAYMENT_STEP_ENABLED.
export const FLIGHT_PAYMENT_STEP_ENABLED = false;
