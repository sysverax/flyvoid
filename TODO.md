# TODO

## 1. Send passenger residency (passport country) to RateHawk

**Why:** RateHawk certification requires the guest's passport country to be sent as `residency` in the search and hotel page requests. Prices can differ by residency; without it, the hotel may charge the passenger extra at check-in, and RateHawk won't take responsibility. Passport country can differ from one PNR to another, and we don't capture it today.

**Decision needed first:** what to do when a PNR has no passport country:
- **Option 1:** fall back to the departure airport's country (already stored) and log a warning.
- **Option 2:** block allocation until the airline fills it in. Stricter but safer.

### Steps

- [ ] **Database:** add a nullable `residency` column (`varchar(2)`, ISO 3166-1 alpha-2) to `cancelled_flight_bookings`. Use a new migration file if `20261008_alter_hotel_allocation_live_booking.sql` has already been merged.
  - Optional: add `residency` to `hotel_booking_attempts` to record which country each booking was priced with.
- [ ] **Backend passenger data:**
  - Add `residency` to `BookingEntity` (`backend/src/cancelled-flights/entities/booking.entity.ts`).
  - Add an optional `residency` to `create-booking-request.dto.ts` and `update-booking.dto.ts`, validated as a 2-letter country code and stored uppercase.
  - Return it in the passenger list, review and booking-details responses.
- [ ] **CSV import** (`importBookings` in `backend/src/cancelled-flights/cancelled-flights.service.ts`):
  - Add **Passport Country** as the last column (index 10), so older CSV files still import.
  - If filled, validate it as a 2-letter country code; otherwise report a row error.
- [ ] **Frontend (airline):**
  - CSV template download (`CancellationWizard.tsx`): add the "Passport Country" header and a sample value.
  - Add/edit passenger form: add a country selector.
  - Passenger list and review step: show the passport country.
  - Add `residency` to the booking types in `frontend/airline/src/services/cancellation.service.ts`.
- [ ] **Hotel provider interface** (`hotel-provider.interface.ts`):
  - `searchNearbyHotelsWithOccupancies(...)`: optional `residency` for the search.
  - `checkRate(rateKey, requestId, { residency })`: the PNR's residency.
  - `bookHotel`: no change; it uses the prebooked key, which is already priced for that residency.
  - Hotelbeds: ignores the new parameter for now.
- [ ] **RateHawk provider** (`ratehawk.provider.ts`):
  - Send `residency` in `/search/serp/geo/`, `/search/serp/hotels/` (including the star-rating and radius-widening searches) and `/search/hp/`.
  - RateHawk expects a lowercase 2-letter code (e.g. `gb`, `lk`). Confirm against their docs.
- [ ] **Allocation flow** (`hotel-allocation.service.ts`):
  - Multi-hotel search (once per flight): send the most common residency among the PNRs being booked.
  - Rate check (hotel page + prebook) per PNR: send that PNR's own residency. Same for `book-hotel` retries.
  - Apply the missing-residency rule chosen above.
- [ ] **Sandbox test:**
  - Flight with PNRs from different passport countries, plus one PNR without one.
  - Check the logs: the search sends the majority residency; each PNR's hotel page and prebook send its own.
  - Confirm bookings still succeed, the new CSV column imports, and older CSV files still work.
- [ ] **RateHawk certification answer:** send the prepared answer (search sends the flight's majority residency; hotel page and prebook send each booking's own). If Option 2 is chosen, add: "Allocation cannot start until every passenger booking has a passport country."

## 2. Receive RateHawk booking status webhooks

**Why:** today we poll `/hotel/order/booking/finish/status/` every 2.5 s for up to 180 s. An order still `processing` after that becomes MANUAL_CHECK and must be reconciled by hand. With a webhook, RateHawk sends the final status whenever it arrives, so those bookings resolve to SUCCESS or FAILED automatically. Keep polling as the main path; the webhook is a safety net (whichever arrives first wins).

**After building:** send RateHawk the callback URLs (sandbox and production) and the response our server returns, and update the certification answer (see below).

### Steps

- [ ] **Check RateHawk's webhook spec:** payload fields, how they authenticate the call (signature, shared key or IP allow-list), and the response they expect from our server.
- [ ] **Public endpoint:** e.g. `POST /api/v1/webhooks/ratehawk/booking-status`.
  - No user login (RateHawk calls it); reachable from the internet over HTTPS on each environment.
  - Verify the request using RateHawk's authentication before trusting anything; reject anything that fails.
- [ ] **Processing:**
  - Find the booking attempt by the `partner_order_id` in the payload. It's already saved, including for timed-out bookings (`provider_idempotency_key`).
  - `ok` → mark the attempt SUCCESS (save the reference, refresh flight totals, then fetch `/hotel/order/info/`).
  - Final error → mark it FAILED.
  - Only update attempts that are still `pending` or `manual_check` (the same compare-and-set check used today), so a webhook and polling can't both win.
  - Repeated webhooks for the same order must be harmless.
- [ ] **Multi-room bookings:** each room is a separate RateHawk order. Track rooms individually; the booking becomes SUCCESS only when all its rooms are `ok`.
- [ ] **Response to RateHawk:** reply in the format they expect.
- [ ] **Sandbox test:** give RateHawk the sandbox callback URL and test with their special test orders (e.g. a `partner_order_id` ending in `unknown_success`) to simulate a late final status. Confirm a timed-out MANUAL_CHECK booking resolves automatically.
- [ ] **RateHawk certification answer:** add the webhook part:
  > We use both methods: we poll /hotel/order/booking/finish/status/ every 2.5 seconds for up to 180 seconds, and we also receive booking status webhooks at [callback URL], so orders that are still processing after our polling window are resolved automatically when the final status arrives. Our server responds to your webhooks with [response per your spec].
