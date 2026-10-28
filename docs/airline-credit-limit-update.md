# Update an Airline's Credit Limit and Platform Fee (Admin)

Status: implemented (backend + admin portal).

## Today

- The credit limit is set once, from the invite, when the airline finishes
  onboarding (`airline-auth.service.ts`), with a first
  `wallet_credit_limit_history` row ("Initial credit limit set at airline
  onboarding").
- After that nothing can change it: `PATCH /airline/:id` has no `creditLimit`,
  and `WalletRepository.updateCreditLimit()` is never called.
- The admin Edit Airline modal shows a Credit Limit field, but the save payload
  does not send it, so edits are silently dropped. (Same for Platform Fee.)

## Decisions

| Topic | Decision |
|---|---|
| Endpoint | Separate `PATCH /wallets/:airlineId/credit-limit` (financial change, own history) |
| Permission | **AIRLINES EDIT** (can be given to other admins; PAYMENTS is hidden while `PAYMENTS_ENABLED = false`) |
| Values | Any amount ≥ 0, including 0 |
| Below what is used | **Allowed.** Available (`balance + creditLimit − locked`) can go negative; the airline is then blocked from new allocations until it tops up |
| Runs in progress | Not affected: their locked estimate stays, per-PNR charges continue (charges are always allowed) |
| Audit | One `wallet_credit_limit_history` row per change: previous, new, reason, admin, time |
| Reason | Required |
| Wallet transaction | None (not a balance movement) |

## Backend

### Endpoint

`PATCH /wallets/:airlineId/credit-limit`, platform users only.

Permission: `RequireAccessControl({ platform: { asset: AIRLINES, access: [EDIT] } })`.

Body (`UpdateCreditLimitRequestDto`):

| Field | Rules |
|---|---|
| `creditLimit` | number ≥ 0, up to 2 decimals, max 99,999,999.99 (column is `decimal(12,2)`) |
| `reason` | required, trimmed, 3–500 characters |

### Flow (one transaction)

1. Lock the airline's wallet row (`SELECT … FOR UPDATE`) so the change cannot
   interleave with a wallet lock, charge or adjustment.
2. 404 when the airline or wallet does not exist.
3. Same value as now → 400 "Credit limit is already X" (no history row).
4. Update `wallets.credit_limit`.
5. Insert `wallet_credit_limit_history` (previous, new, reason,
   `changed_by_admin_id` = current admin).
6. Log: airline, wallet, previous, new, admin, balance, locked, available
   before/after; a **warning** when available becomes negative.

### Response

```json
{
  "airlineId": 5,
  "walletId": 5,
  "previousCreditLimit": 10000,
  "creditLimit": 0,
  "balance": -1983.52,
  "lockedAmount": 3220,
  "availableBalance": -5203.52,
  "currency": "USD",
  "changedAt": "2026-10-29T09:10:00.000Z"
}
```

### History

`GET /wallets/:airlineId/credit-limit/history` (AIRLINES VIEW):
previous, new, reason, admin name/email, time; newest first. The repository
method `findCreditLimitHistoryByWalletId` already exists.

### Effect on allocation

Nothing changes in allocation code. The next run's wallet lock
(`balance + credit_limit − locked_amount − estimate ≥ 0`) sees the new limit;
a run already holding its lock carries on.

## Admin portal

- Edit Airline modal: Credit Limit becomes read-only with an **Update credit
  limit** action (the modal's save stays for profile fields).
- Update credit limit dialog: current limit, balance, locked, available; new
  limit input; required reason; live preview "Available will become X". When
  X < 0, warning: "Available will be negative; new hotel allocations for this
  airline will be blocked until the wallet is topped up."
- Credit limit history list in the airline's wallet/financial section.

## Platform fee

### Decisions

| Topic | Decision |
|---|---|
| Where | Stays in the Edit Airline save (`PATCH /airline/:id`, already accepts `platformFeePercentage`); the admin portal must start sending it |
| Separate endpoint / reason | Not needed |
| History | Not needed |
| 0% | **Allowed**: 0 ≤ fee < 100, up to 2 decimals |
| Run in progress | Keeps the fee it started with |
| Confirmed bookings | Keep their own fee (stored per hotel booking) |
| Crash resume | Uses the fee saved on the flight |
| Fee per cancellation | **Frozen at the flight's first allocation run** (option b): later runs and retries of that flight reuse it, even if the airline's fee changed |

### Changes

- Validation 0 ≤ fee < 100 (was > 0) in `update-airline-request.dto.ts`,
  `admin-invite-airline-admin-request.dto.ts`,
  `update-airline-invitation-request.dto.ts`, and the admin portal's
  Edit Airline / invite validation.
- Admin portal: send `platformFeePercentage` in the Edit Airline payload
  (`app/airlines/page.tsx`); today it is shown but dropped.
- Freeze: `cancelled_flights.platform_fee_percentage` defaults to 0, which can
  no longer mean "not set" once 0% is allowed. Add
  `cancelled_flights.platform_fee_locked_at timestamptz NULL`:
  - first allocation run: copy the airline's fee to the flight and set
    `platform_fee_locked_at = now()` (in the run claim transaction);
  - later runs/retries/resume: use the flight's fee when locked;
  - completing a run writes back the run's fee, which is the frozen fee;
  - manual bookings and the allocation status screen use the frozen fee too.
  - Migration backfill: flights with any hotel booking attempt get
    `platform_fee_locked_at` = their first attempt's time (their current
    fee is kept); flights never allocated stay unlocked.
- Changing an airline's fee therefore affects only cancellations whose
  allocation has not started yet.
