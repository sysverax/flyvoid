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

## 2. Handle partial bookings (some rooms booked, some failed)

**Why:** a PNR that needs more than one room (e.g. 4 adults → 2 rooms of 2) books each room as its own RateHawk order, all at the same hotel. If room 1 is booked and room 2 definitely fails (e.g. `soldout`), the PNR is **partially booked**: some passengers have a room, others don't. Today the code marks this MANUAL_CHECK, which is wrong. MANUAL_CHECK means "outcome unknown", whereas here the outcome is known: one room succeeded, one failed. It needs its own state and automatic recovery.

**Note:** a timeout or unknown result on a room (outcome not known) stays MANUAL_CHECK. Only a *definite* failure of a remaining room counts as partial.

### Steps

- [ ] **New status `PARTIAL`:**
  - Add it to the attempt status (`HotelBookingAttemptStatus`) and the effective PNR status (`HotelAllocationStatus`).
  - Booked rooms stay booked (their references are saved); failed rooms are recorded with their failure reason.
  - Partial is not counted as SUCCESS, and not shown as "Booking Failed".
- [ ] **Track rooms individually on the attempt:** per room, save the rate key, `partner_order_id`, status (booked / failed), price and failure reason, instead of only the joined reference list.
- [ ] **Automatic recovery, in order:**
  1. **Retry the missing room(s) at the same hotel** with the hotel's other rates (another room type or meal plan), keeping the rooms already booked. All rooms booked → SUCCESS.
  2. **If no other rate works:** cancel the already-booked room(s) with `/hotel/order/cancel/` (the provider already has `cancelBooking`), **only if the cancellation is free** (check the cancellation penalties from prebook). Then move the whole PNR to the next candidate hotel as usual.
  3. **If the cancellation isn't free or fails:** keep the PNR as PARTIAL and show it for a person to decide (keep the booked room and handle the rest manually, or cancel at a cost).
- [ ] **Pricing and totals:** flight totals and billing include only the rooms actually booked, and are refreshed after each room is booked or cancelled.
- [ ] **API and frontend:**
  - API `bookingStatus` gets a `PARTIAL` value, with per-room details (which rooms are booked, which failed).
  - Airline UI: show "Partially booked" with the booked hotel and rooms, plus the failure reason for the rest, on hover as today.
  - Voucher: only for the booked rooms, with the PNR's remaining guests clearly not covered.
  - Summary counts: add `partialPnrs`; `fullyBooked` stays false while any PNR is partial.
- [ ] **Re-runs:** re-running allocation retries the missing rooms of a PARTIAL PNR (step 1 first) and never re-books its already-booked rooms.
- [ ] **Sandbox test:**
  - A 4-adult PNR where room 2 fails (e.g. using RateHawk's `unknown_soldout` test suffix on the second room's order).
  - Confirm that room 1 stays booked and the PNR becomes PARTIAL, then that recovery books another rate at the same hotel or cancels and moves the PNR.
