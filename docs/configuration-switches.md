# Configuration Switches

Features that are switched off for now, and values that may change, are kept as
constants in code. This page lists every one of them: where it lives, what it
controls, and which ones must match across apps.

**When you add, change or remove a switch, update this page.**

---

## Summary

| Switch | Current | Where | Must match |
|---|---|---|---|
| [`PAYMENTS_ENABLED`](#payments_enabled) | `false` | airline portal, admin portal | – (each portal on its own) |
| [`FLIGHT_PAYMENT_STEP_ENABLED`](#flight_payment_step_enabled) | `false` | backend, airline portal, admin portal | ✅ all three |
| [`DROPDOWN_LIMIT`](#dropdown_limit) | `10` | airline portal | – |
| [`PLATFORM_FEE_PERCENT`](#platform_fee_percent) | `10` | airline portal | ⚠️ should match the backend fee (see below) |
| [`MAX_CHILD_AGE`](#max_child_age) | `12` | backend, airline portal | ✅ both |

Files:

| App | File |
|---|---|
| Backend | `backend/src/cancelled-flights/cancelled-flights.constants.ts` |
| Airline portal | `frontend/airline/src/lib/constants.ts` |
| Admin portal | `frontend/admin/src/lib/constants.ts` |

---

## `PAYMENTS_ENABLED`

**Hides the Payments section** for the initial release.

| | Airline portal | Admin portal |
|---|---|---|
| File | `frontend/airline/src/lib/constants.ts` | `frontend/admin/src/lib/constants.ts` |
| Sidebar | "Payments" tab hidden | "Payments" tab hidden |
| `/payments` route | 404 (`app/payments/layout.tsx`) | 404 (`app/payments/layout.tsx`) |
| Manage Users → permissions | "Payments" row hidden | "PAYMENTS & REVENUE" rows hidden (Platform Overview, Detailed Analysis, Platform Treasury) |
| Other | – | Payments removed from `lib/navigation.ts`, so the access redirect never sends a user to it |

**Turning it on:** set to `true` in the portal you want. Frontend only; no
backend change.

**Existing data:** users who already have Payments access keep it while the row
is hidden; editing a user sends it back unchanged.

---

## `FLIGHT_PAYMENT_STEP_ENABLED`

**The manual "Pay" step of a cancelled flight** (`ALLOCATED → PAID`).

It is off because hotels are charged to the airline wallet as each PNR is booked
(see [wallet-cancellation-payment.md](wallet-cancellation-payment.md)). An
`ALLOCATED` flight is already paid for and goes straight to publish.

> **Set the backend, the airline portal and the admin portal to the same
> value.** If only one side is switched on, the wizard and the API disagree
> (for example the wizard shows a Pay step whose API answers 404).

| Where | `false` (now) | `true` |
|---|---|---|
| `POST /cancelled-flights/:id/payment` | 404, hidden from Swagger | sets `PAID` |
| Publish (`POST /cancelled-flights/:id/publish`) | from `allocated` (and old `paid` flights) | from `paid` only |
| Confirmation PDF / booking email | `allocated`, `paid`, `published` | `paid`, `published` |
| Wizard | Payment step hidden; Booking Summary → "Continue to Publish" → Publish | Booking Summary → Payment → Publish |
| Wizard URL `…/step-6` | redirects to step 7 | Payment step |
| Cancelled flights list | Publish button for "Hotels Booked" and "Paid" flights | Publish button for "Paid" flights |
| Cancelled flights status filter (airline and admin portals) | "Paid" option hidden | "Paid" option shown |

Backend: `PUBLISHABLE_FLIGHT_STATUSES` and `CONFIRMATION_FLIGHT_STATUSES` are
derived from the switch in the same file.

Airline portal files using it: `app/cancelled-flight/CancellationWizard.tsx`,
`app/cancelled-flight/[id]/[step]/page.tsx`, `app/cancelled-flight/page.tsx`.

Admin portal files using it: `app/cancellation/page.tsx` (status filter only).

**Related, not switched:** cancelled flight statuses are shown with these
labels in both portals (`StatusBadge`, status filters). The API values are
unchanged.

| API status | Label |
|---|---|
| `draft` | Draft |
| `in_progress` | In Progress |
| `passengers_booking_confirmed` | Ready for Allocation |
| `hotel_allocation_in_progress` | Allocation In Progress |
| `allocated` | Hotels Booked |
| `paid` | Paid (older flights; filter option hidden while the step is off) |
| `published` | Published |

---

## `DROPDOWN_LIMIT`

**How many options are loaded into dropdowns whose options come from an API.**

| | |
|---|---|
| File | `frontend/airline/src/lib/constants.ts` |
| Used by | Bookings → Airport and Cancelled flight filters; cancellation wizard → departure / arrival airport; default of `hotelBookingsService.getCancelledFlights()` |
| Backend maximum | 200 (`PaginationQueryDto`) |

These dropdowns do not search on the server, so items beyond the limit are not
shown. Raise the value or add server-side search if an airline has more items.

The admin portal has no equivalent constant yet.

---

## `PLATFORM_FEE_PERCENT`

**Platform fee percentage used by the airline portal for display.**

| | |
|---|---|
| File | `frontend/airline/src/lib/constants.ts` |
| Used by | cancellation wizard, booking details drawer, published detail view, payment drawer |

⚠️ The fee actually charged is set in the backend: the airline user's
`platformFeePercentage`, or `PLATFORM_FEE_PERCENTAGE` (env, default `10`,
`backend/src/config/config.ts`). If either changes, this constant shows a wrong
fee. Better long term: read the fee from the API instead of a constant.

---

## `MAX_CHILD_AGE`

**Oldest age that counts as a child on a booking** (ages 0 to this, inclusive).
Each child on a booking needs one age, checked by the booking form, the API
(create/update booking, fixing a failed CSV row) and the CSV import.

| | Backend | Airline portal |
|---|---|---|
| File | `backend/src/cancelled-flights/cancelled-flights.constants.ts` | `frontend/airline/src/lib/constants.ts` |
| Used by | `CreateBookingDto` / `UpdateBookingDto`, `booking-import.ts` | booking form child age inputs, CSV guidelines |

Change both together; the CSV format page (`docs/bookings-csv-import.md`)
quotes the range too.

---

## Hotel stay limits (backend environment)

**Limits on a cancelled flight's hotel stay**, checked when a flight is created
or its dates are updated. Set in the backend environment (`.env`), read in
`backend/src/config/config.ts` as `config.stay`.

| Variable | Default | Rule |
|---|---|---|
| `STAY_MAX_NIGHTS` | `7` | check-out at most this many nights after check-in |
| `STAY_MAX_CHECK_IN_DAYS_AHEAD` | `30` | check-in at most this many days after today at the departure airport |

The other stay rules are fixed: check-in today or later at the departure
airport (its own timezone), on or after the cancellation date, and check-out
after check-in. See `backend/src/cancelled-flights/stay-dates.ts`.

---

## Hotel booking status mode (backend environment)

**How a hotel booking gets its final status from the supplier (RateHawk).**
After the booking request, the booking waits up to 180 seconds for its result.
With no result by then it shows as `MANUAL_CHECK` and cannot be rebooked until
it is settled. The mode is set in the backend environment (`.env`) and read in
`backend/src/config/config.ts` as `config.hotelBooking`.

| Variable | Default | Rule |
|---|---|---|
| `HOTEL_BOOKING_STATUS_MODE` | `webhook` | `webhook` or `status` (any other value stops startup) |
| `HOTEL_WEBHOOK_FINAL_CHECK_DELAY_MS` | `3900000` (1 h 5 min) | webhook mode: the one status check, counted from when the booking was sent |
| `HOTEL_POST_RUN_CHECK_INTERVAL_MS` / `HOTEL_POST_RUN_CHECK_COUNT` | 5 min / `2` | status mode: the re-check schedule after a run |

**`webhook`:**

1. During the 180-second wait the booking status is not polled. The result
   comes from the supplier's booking webhook
   (`POST /webhooks/ratehawk/booking-status`): `completed` confirms the
   booking, `failed` fails it and the next hotel is tried. No webhook in 180
   seconds: `MANUAL_CHECK`, and no other hotel is tried.
2. A webhook for a `MANUAL_CHECK` booking settles it. The reported status is
   applied as is, with no status call. RateHawk gets 200 only once the result
   is saved; if anything fails it gets 503 and sends the webhook again.
   Webhooks for bookings already settled are acknowledged and ignored.
3. The status endpoint is not called until 1 h 5 min after the booking was
   sent (after RateHawk's webhook retries at 30 s … 5 min have passed). If the
   booking is still `MANUAL_CHECK` then, it is called once and the result is
   logged. `completed` confirms it and `failed` fails it. Anything else
   (still processing, or a status API error) marks it `FAILED` with code
   `no_final_status` and a reason naming the wait and what the check returned.
4. The due time comes from the stored send time, so a restart does not reset
   it. A check that finds another run holding the flight is retried every
   `HOTEL_POST_RUN_CHECK_INTERVAL_MS`.
5. "Retry remaining bookings" is not held back while bookings wait for their
   webhook, because retry runs skip `MANUAL_CHECK` PNRs.

**`status`:** the earlier behaviour. Status checks run at the end of the run
and then every `HOTEL_POST_RUN_CHECK_INTERVAL_MS`, `HOTEL_POST_RUN_CHECK_COUNT`
times. Incoming webhooks are acknowledged with 200 and ignored.

Notes:

- **Late webhook:** a webhook that arrives after the check failed the booking
  (or one contradicting a failed booking) is not applied. Its status and time
  are appended to the failure message (on the booking attempt, and on the
  PNR while it has not been rebooked), and RateHawk gets 200. A late
  `completed` is also logged as an error: reconcile it with the supplier.
- **Hotelbeds:** these modes do not apply. It has no status endpoint and no
  webhooks, so its `MANUAL_CHECK` bookings are always resolved by hand.

---

## Adding a new switch

1. Put it in the app's constants file (table above), with a comment saying what
   `false` and `true` do.
2. If more than one app needs it, use the **same name** everywhere and say
   **"Must match …"** in each comment.
3. Add a section to this page and a row to the summary table.
