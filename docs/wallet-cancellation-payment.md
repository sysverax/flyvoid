# Wallet Payment for Cancelled-Flight Hotel Bookings

Status: **Implemented** (migration `20261023_wallet_holds_for_hotel_bookings.sql`)
Scope: backend only (`cancelled-flights`, `finance`)
Currency: **USD only** (no conversion)

---

## 1. Summary

When an airline runs hotel allocation for a cancelled flight
(`POST /api/v1/cancelled-flights/:id/hotel-allocations`), the background job
books a hotel for every PNR with the supplier. Today no money moves: the
wallet is never checked, locked or charged.

This design adds wallet payment to that background job:

1. **Estimate** the cost of the PNRs about to be booked (hotel cost + platform fee).
2. **Check and lock** that amount in the airline's wallet, atomically, before any booking.
3. **Charge** the wallet for each PNR as soon as the supplier confirms its hotel,
   and write a wallet transaction.
4. **Release** the locked share of every PNR that does not get booked.

The existing request/response flow of the API does **not** change: the
endpoint still returns `202 Accepted` at once, and all wallet work happens in
the background job.

---

## 2. Background: how things work today

### 2.1 Hotel allocation job

`POST /cancelled-flights/:id/hotel-allocations` → `HotelAllocationService.startHotelAllocation`

1. Validates the flight, claims an allocation run (`claimFlightAllocationRun`), returns `202`.
2. In the background, `executeAllocationRun`:
   1. `planPendingBookings` – searches supplier availability once for the whole flight,
      chooses a room split per PNR, shares rooms across PNRs (150 % supply buffer)
      and saves a ranked candidate list per PNR. Each candidate has an
      **`estimatedPrice`** = total supplier price for all rooms of that PNR at that hotel
      (`hotel_allocation_options.estimated_price`).
   2. `bookPlannedBookings` – books PNRs live with the supplier: cabin classes in order
      (First → Business → Premium Economy → Economy), PNRs of one class in parallel,
      fallback hotels per PNR one at a time.
   3. `runRecoveryPass` – one more try for FAILED PNRs.
   4. `completeFlightAllocationRun` – sets the flight to `ALLOCATED` if every PNR is
      booked, otherwise back to `PASSENGERS_BOOKING_CONFIRMED` so it can be retried.

A PNR's supplier outcome can arrive on three paths:

| Path | Code |
|---|---|
| Live booking response | `attemptHotelBooking` → `finishBookingAttempt` |
| Supplier webhook | `handleSupplierBookingStatus` / `confirmAttemptFromWebhook` |
| Later status checks for unknown outcomes | `reconcileManualChecks` (post-run checks) |

Unknown outcomes become `MANUAL_CHECK` and are never rebooked automatically.

### 2.2 Pricing of a booked PNR

`calculatePricing` in `hotel-allocation.service.ts`, called with commission = 0 and tax = 0:

```
hotelCost   = supplier price for all rooms of the PNR
platformFee = hotelCost × platformFeePercentage / 100
totalPrice  = hotelCost + platformFee
```

Stored on `hotel_bookings` (`actual_price`, `platform_fee`, `total_price`, …).
`platformFeePercentage` = the user's value, or `config.platformFeePercentage`; it is
stored on the flight when the run starts.

### 2.3 Wallet

`wallets` – one row per airline (`airline_id` unique):

| Column | Meaning |
|---|---|
| `balance` | Money the airline has. May become negative (see §6). |
| `credit_limit` | How far the airline may go below zero. |
| `locked_amount` | Money reserved for in-progress processes. Exists today but nothing sets it yet. |
| `currency` | Always `USD`. |

Already in place:

- Manual debits refuse to eat into `locked_amount` (`WalletService.createAdjustment`).
- The admin wallet summary counts `locked_amount - balance` (when positive) as credit used.
- `WalletRepository.lockWalletByAirlineId` takes a `SELECT … FOR UPDATE` row lock.
- `wallet_transactions` with `type` (`CREDIT`/`DEBIT`), `reference_type`
  (`BOOKING`/`PAYMENT`/`ADJUSTMENT`), `reference_id`, `amount`,
  `balance_before`, `balance_after`, `description`, `created_by`.

`CancelledFlightsService.processPayment` currently only sets the flight to `PAID`;
it does not touch the wallet.

---

## 3. Key definitions

```
available = balance + creditLimit - lockedAmount
```

- **Hold** – the amount locked for one allocation run of one flight.
- **Hold item** – the share of a hold that belongs to one PNR (its estimate).
- **Estimate of a PNR** – hotel cost + platform fee of its first-choice candidate.
- **Actual cost of a PNR** – `hotel_bookings.total_price` once the supplier confirms.

---

## 4. The estimate

Computed in the background job inside `bookPlannedBookings`, **right before the
first PNR is booked** (`HotelAllocationService.reserveWalletFunds`), for exactly
the PNRs that pass will book. This covers the main pass and the recovery pass
(which books FAILED PNRs again from a new plan). Confirmed and manual-check PNRs
are not booked, so they are not estimated.

```
for each PNR to book in this run:
    hotelCost_i   = estimatedPrice of its first candidate (candidate_order = 1)
    platformFee_i = round(hotelCost_i × pct / 100)
    estimate_i    = round(hotelCost_i + platformFee_i)

estimate = Σ estimate_i
```

- Rounded **per PNR**, then summed, to match how real bookings are rounded.
- Uses the same planner the booking uses, so it already accounts for rooms being
  shared between PNRs.
- PNRs without any candidate are not booked, so they get no hold item.

The estimate can differ from the actual cost because rates are re-checked before
booking, and a PNR may move to a fallback hotel. That is handled in §6.

---

## 5. Data model changes

### 5.1 New table `wallet_holds` – one row per allocation run

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `wallet_id` | int FK → `wallets.id` | |
| `cancelled_flight_id` | int FK → `cancelled_flights.id` | |
| `run_id` | varchar(64) | `hotel_allocation_run_id` of the run; unique |
| `initial_amount` | numeric(12,2) | Σ of item amounts when the hold was created |
| `remaining_amount` | numeric(12,2) | Σ of items still `HELD` |
| `status` | varchar(20) | `OPEN` / `CLOSED` |
| `created_at`, `updated_at` | timestamp | |

Invariant: `remaining_amount = Σ amount of items with status HELD`.

### 5.2 New table `wallet_hold_items` – one row per PNR in a hold

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `hold_id` | int FK → `wallet_holds.id` | |
| `booking_id` | int FK → `bookings.id` (the PNR) | unique per hold |
| `amount` | numeric(12,2) | the PNR's estimate |
| `status` | varchar(20) | `HELD` / `CHARGED` / `RELEASED` |
| `hotel_booking_id` | int FK → `hotel_bookings.id`, nullable | set when charged |
| `created_at`, `updated_at` | timestamp | |

A partial unique index (`booking_id WHERE status = 'HELD'`) guarantees a PNR has
at most one HELD share at a time, across all holds of its flight.

### 5.3 `hotel_bookings` – new columns

| Column | Type | Notes |
|---|---|---|
| `payment_status` | varchar(20), default `PENDING` | `PENDING` / `PAID` / `FAILED` |
| `paid_at` | timestamp, nullable | when the wallet was charged |

- `PAID` – the supplier confirmed and the wallet was charged.
- `FAILED` – the supplier booking failed; nothing charged.
- A `MANUAL_CHECK` booking stays `PENDING` until it is resolved.

> **To confirm:** this design reads "PAID / FAILED" as a payment status per hotel
> booking (per PNR), not the flight status. The flight's own `PAID` status and
> `processPayment` are left unchanged for now (§12).

### 5.4 `wallet_transactions` – new unique index

```sql
CREATE UNIQUE INDEX uq_wallet_tx_booking_debit
  ON wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'BOOKING' AND type = 'DEBIT';
```

Guarantees each hotel booking is charged at most once, whichever path confirms it.

### 5.5 Migrations

One SQL migration in `backend/src/database/migrations/` creating the two tables,
the two columns and the index. Existing `hotel_bookings` rows get
`payment_status = 'PENDING'`.

---

## 6. The money flow

### 6.1 Lock (after planning, before booking)

One DB transaction:

```
lock wallet row (SELECT … FOR UPDATE)
if balance + creditLimit - lockedAmount - estimate < 0:
    rollback → stop the run before any booking
lockedAmount += estimate
insert wallet_holds (initial_amount = remaining_amount = estimate, status OPEN)
insert one wallet_hold_items row per PNR (status HELD)
commit
```

- The condition is `>= 0`, so an airline with exactly enough is allowed.
- PNRs that already have a HELD share (for example from an interrupted run) are
  skipped, so nothing is locked twice.
- If the check fails in the main pass, nothing is booked. The run ends with
  `lastRunError = "Insufficient wallet balance: X available, Y required …"`,
  visible through `GET /cancelled-flights/:id/hotel-allocations`. The run never
  sent a request to the supplier, so it does not use up a retry.
- If it fails in the recovery pass, only the recovery bookings are skipped (logged).
- If `estimate = 0` (nothing to book), no hold is created.

### 6.2 Charge (a PNR is confirmed)

Runs **inside the same transaction** that marks the hotel booking `SUCCESS`
(`finishBookingAttempt`), on every path (live, webhook, manual-check resolution):

```
update item set status = CHARGED, hotel_booking_id = :hb
    where booking_id = :pnr and hold is the run's hold and status = HELD
    returning amount                    -- 0 rows → already settled, skip lock release
lock wallet row
balance       -= actualCost             -- hotel cost + platform fee; no balance check
lockedAmount  -= item.amount            -- release THIS PNR's share only
hold.remaining_amount -= item.amount
hotel_bookings.payment_status = PAID, paid_at = now()
insert wallet transaction (§7)
```

- The charge is **always allowed**, even if `balance` goes negative or below
  `-creditLimit`. The supplier has already booked the hotel; it cannot be undone
  here. The only point where we can refuse is the lock (§6.1).
- A warning is logged when a charge leaves `available < 0`.
- A flight that has **no hold at all** (allocated before wallet payment existed)
  is not charged; its bookings stay `payment_status = PENDING`.
- A PNR whose share was already released (for example a manual booking of a
  failed PNR) is still charged in full; there is just no lock to release.

### 6.3 Fail (the supplier says the booking failed)

Every failed booking attempt gets `hotel_bookings.payment_status = FAILED`.

A PNR may try several hotels; failed attempts in between do not release anything.
Only the PNR's final failure (`markPnrFailed`: no fallback hotel left / retries
done) releases its share:

```
update item set status = RELEASED where … and status = HELD returning amount
lockedAmount          -= item.amount
hold.remaining_amount -= item.amount
```

### 6.4 End of run

In `completeFlightAllocationRun` (same transaction, after the flight row lock):

```
for each HELD item of the flight (any of its holds)
        whose PNR is not MANUAL_CHECK or IN_PROGRESS:
    lockedAmount -= item.amount, item → RELEASED
MANUAL_CHECK items stay HELD
if no HELD items left → hold.status = CLOSED
```

The release covers all holds of the flight, not only the current run's: a crash
resume and the post-run checks start with a new `run_id`, and the shares left by
an interrupted run must still be released.

### 6.5 Manual check resolved (later, after the run)

| Outcome | Action |
|---|---|
| Confirmed | same as §6.2 (charge) |
| Failed | same as §6.3 (release that PNR's item) |

When the last HELD item of a hold is settled, the hold becomes `CLOSED`.

### 6.6 Why each PNR releases its own share (not `min(cost, remaining)`)

The lock is a reservation **per PNR**. Once a PNR is settled its reservation is no
longer needed, whatever the real price was:

- `balance` goes down by the **actual cost** (what really leaves the wallet).
- `lockedAmount` goes down by **that PNR's share** (the reservation no longer needed).

Example – PNR A estimate 500, PNR B estimate 500, hold 1000:

| A's actual cost | Rule | After A | B's reservation |
|---|---|---|---|
| 600 (over) | release A's share (−500) | locked 500 | 500, intact |
| 600 (over) | `min(cost, remaining)` (−600) | locked 400 | 400, **100 short** |
| 400 (under) | release A's share (−500) | locked 500 | A's unused 100 freed now |
| 400 (under) | `min(cost, remaining)` (−400) | locked 600 | 100 stays locked until end of run |

Releasing the PNR's own share:

1. keeps PNRs independent – one PNR's overspend never reduces another's reservation;
2. never goes negative and needs no clamping;
3. never releases more than this flight locked, so other flights' locks are safe;
4. keeps `remaining_amount = Σ HELD items` at all times;
5. makes manual-check release exact.

### 6.7 Worked example – two cancellations, overspend allowed

Wallet: balance 3100, credit limit 0, locked 0.

| Event | balance | locked | available |
|---|---|---|---|
| C1 locks 1000 | 3100 | 1000 | 2100 |
| C2 locks 2000 | 3100 | 3000 | 100 |
| C1 all PNRs booked, actual 1050 (shares 1000 released) | 2050 | 2000 | 50 |
| C2 n−1 PNRs booked, actual 2000 (shares e.g. 1900 released) | 50 | 100 | −50 |
| C2 last PNR, actual 100 (share 100 released) | **−50** | 0 | **−50** |

- The last charge is allowed: the cancellation was already accepted.
- The next cancellation's lock fails (available < 0) until the airline tops up,
  so the system corrects itself.

### 6.8 Example with manual check

Hold 1000 = A 300 + B 300 + C 400.

| Event | locked change | Items |
|---|---|---|
| Lock | +1000 | A, B, C HELD |
| A confirmed, actual 320 | −300 (balance −320) | A CHARGED |
| B failed | −300 | B RELEASED |
| Run ends, C is MANUAL_CHECK | 0 | C stays HELD (400 still locked) |
| Later C confirmed, actual 390 | −400 (balance −390) | C CHARGED → hold CLOSED |

Same result as `release at end of run = remaining − Σ manual-check estimates`,
but worked out item by item.

---

## 7. Wallet transaction for each charge

| Field | Value |
|---|---|
| `type` | `DEBIT` |
| `reference_type` | `BOOKING` |
| `reference_id` | `hotel_bookings.id` |
| `amount` | `hotel_bookings.total_price` (hotel cost + platform fee) |
| `balance_before` / `balance_after` | read and written under the wallet row lock |
| `description` | `Cancellation #<flightId> - Flight <flightNumber> - PNR <pnr> - Hotel booking #<hotelBookingId>` |
| `created_by` | `null` (system) or the user who started the run |

Example: `Cancellation #12 - Flight FV123 - PNR ABC123 - Hotel booking #456`

Locks and releases are not wallet transactions (they don't change `balance`);
they are recorded in `wallet_holds` / `wallet_hold_items`.

---

## 8. Atomicity and idempotency

### 8.1 Atomic steps

Every step that changes the wallet is **one DB transaction with a row lock on the
wallet** (`SELECT … FOR UPDATE`), so nothing can change the wallet between the
check and the update:

| Step | In the same transaction |
|---|---|
| Lock | check + `locked_amount` update + hold + items |
| Charge | booking marked SUCCESS + item CHARGED + balance/locked update + `payment_status`/`paid_at` + wallet transaction |
| Fail / release | item RELEASED + locked update + hold remaining |

So there is never a booking marked SUCCESS but not charged, or charged but not
marked SUCCESS.

### 8.2 No double locking / charging / releasing

| Risk | Protection |
|---|---|
| A re-run locks again | re-runs only book PNRs still pending; PNRs with a HELD share are skipped; unique index on HELD items per PNR |
| Crash resume (`resumeInterruptedRuns`) | starts a new `run_id`; PNRs still HELD from the interrupted run are skipped and released at the end of the resumed run |
| Same PNR confirmed by live + webhook + check | item update `WHERE status = 'HELD'` + unique index on booking debits |
| Release after charge, or twice | item update `WHERE status = 'HELD'`; 0 rows → do nothing |

Any step can therefore be retried safely.

---

## 9. Concurrency and deadlocks

### 9.1 Rows that get locked

| Row | Locked by |
|---|---|
| Flight | `claimFlightAllocationRun`, `refreshFlightTotals`, `completeFlightAllocationRun`, `promoteFlightAfterLateConfirmation` |
| PNR booking | `finishBookingAttempt`, `markPnrFailed`, … (`lockBooking`) |
| Wallet | `createAdjustment` (today); lock, charge, release (new) |

The wallet row is the busiest: shared by all flights of the airline and by admin
adjustments.

### 9.2 How a deadlock would happen

```
T1 (charge PNR 7):   lock booking 7 ──► waits for wallet
T2 (bad new code):   lock wallet    ──► waits for booking 7
```

PostgreSQL kills one of them with `40P01 deadlock detected`.

### 9.3 Rules

1. **Fixed lock order everywhere:** `flight → PNR booking → hold items → wallet → holds`.
   After locking the wallet, never lock a flight, booking or item. Hold rows are
   only updated while the wallet is locked, so the wallet lock serializes them.
   Several items in one transaction are locked in ascending id order.

   | Step | Lock order |
   |---|---|
   | Lock | wallet only (+ insert hold) |
   | Charge | booking → item → wallet |
   | Fail | booking → item → wallet |
   | End-of-run release | flight → items (by id) → wallet |
   | Admin adjustment | wallet only (unchanged) |

2. **Short wallet locks:** never hold a DB lock during a supplier HTTP call (the
   supplier is already called before `finishBookingAttempt` opens its transaction).
   Lock, update once, commit.
3. **Idempotent updates** (§8.2) so retries are safe.
4. **Safety net:** retry the charge/release transaction up to 3 times with a short
   random delay on `40P01` (deadlock) and `55P03` (lock timeout); set
   `SET LOCAL lock_timeout = '5s'` in these transactions.

Parallel charges of PNRs in the same cabin class each lock the wallet row in their
own short transaction, so they simply queue one after another.

---

## 10. Where the code changes

| File | Change |
|---|---|
| `database/migrations/20261023_wallet_holds_for_hotel_bookings.sql` | tables `wallet_holds`, `wallet_hold_items`; `hotel_bookings.payment_status`, `paid_at`; unique index on booking debits |
| `finance/entities/wallet-hold.entity.ts`, `wallet-hold-item.entity.ts` | new entities |
| `finance/entities/wallet-transaction.entity.ts` | declares the booking-debit unique index |
| `finance/constants/wallet-hold.enum.ts` | `WALLET_HOLD_STATUSES`, `WALLET_HOLD_ITEM_STATUSES` |
| `finance/repositories/wallet-hold.repository.ts` | `reserveForRun`, `chargeBooking`, `releaseBookings`, `findHeldBookingIds`; all run in the caller's transaction; `InsufficientWalletBalanceError` |
| `common/utils/lock-retry.util.ts` | `retryOnLockConflict` (deadlock / lock timeout) |
| `cancelled-flights/hotel-allocation.service.ts` | `reserveWalletFunds` before booking in `bookPlannedBookings` |
| `cancelled-flights/cancelled-flights.repository.ts` | `reserveWalletForRun`; `finishBookingAttempt` charges on SUCCESS (every path: live, webhook, manual-check checks) and sets `FAILED`; `markPnrFailed` releases; `completeFlightAllocationRun` releases unbooked shares; retries on lock conflicts |
| `cancelled-flights/entities/hotel-booking.entity.ts`, `enums.ts` | `paymentStatus`, `paidAt`, `HotelBookingPaymentStatus` |
| Hotel booking detail responses | expose `paymentStatus`, `paidAt` |

---

## 11. Tests

- Lock succeeds when `available >= estimate`, fails when it isn't, and nothing is
  booked on failure.
- Charge: balance down by actual cost, locked down by the item amount, one wallet
  transaction with the right description, `payment_status = PAID`, `paid_at` set.
- Overspend: actual > estimate is charged in full; balance may go negative.
- Fail and end-of-run release; manual-check item kept, then charged or released later.
- Idempotency: confirming the same booking twice charges once; re-run and crash
  resume never lock twice.
- Concurrency: several PNRs of one airline charged in parallel while an admin
  adjustment runs on the same wallet – no errors; afterwards
  `locked_amount = Σ HELD items` and `balance` matches the wallet transactions.
- The two-cancellation example in §6.7 end to end.

---

## 12. Decisions

| Topic | Decision |
|---|---|
| Atomicity | Row lock + transaction (`SELECT … FOR UPDATE`) |
| Lock condition | `balance + creditLimit - lockedAmount - estimate >= 0` |
| Re-runs | never lock twice; one hold per run, only pending PNRs |
| Actual > estimate | allowed; charge in full; balance may go negative |
| Lock release on charge | release the PNR's own share (`item.amount`) |
| Manual check | keep its share locked until resolved, then charge or release |
| Payment status | per hotel booking: `PAID` on supplier success (with `paid_at`), `FAILED` on supplier failure *(to confirm, §5.3)* |
| Wallet transaction | one `DEBIT` per hotel booking, referencing it, with the description in §7 |
| Currency | USD only |

### Open

1. **`processPayment` and the flight's `PAID` status** – to be discussed later.
   Once each PNR is charged on its own, `processPayment` must not move money again.
2. **Reading of "PAID / FAILED"** (§5.3) – implemented per hotel booking, as assumed here.
