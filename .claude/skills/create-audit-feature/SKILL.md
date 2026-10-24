---
name: create-audit-feature
description: Implement or extend the Flyverax audit log (who did what, to which record, when, what changed) in the NestJS backend. Use when building the audit foundation (Phase 1), adding audit events to a module (Phases 2–3), recording background/system events, or changing GET /audit-logs. Covers the agreed design, file layout, conventions and per-phase checklists.
---

# Create audit feature

The audit log is a permanent, append-only record of business events:
**who** did **what**, to **which record**, **when**, from **where**, and **what
changed**. It is not the application log (winston): that is for debugging and
rotates away; the audit log is stored in the database and searchable.

Work **one phase at a time**. Before starting a phase, confirm with the user
which phase, and follow its checklist below. Code templates are in
[reference.md](reference.md).

## Agreed decisions (do not change without asking)

| Topic | Decision |
|---|---|
| Storage | One table `audit_logs`, append-only (a trigger rejects UPDATE/DELETE), **no foreign keys** (rows outlive the records they mention) |
| Capture | **Hybrid**: `@Audit(...)` decorator on controller methods + a global `AuditInterceptor`; services enrich the record through `AuditContext`; background jobs call `AuditService.record()` directly as `SYSTEM` |
| Failed actions | **Recorded** (`outcome = FAILURE`): failed sign-ins, validation errors, not-found, business-rule errors, and permission rejections (403) on audited endpoints. Expired-token 401s are **not** recorded (too noisy) |
| Retention | **Keep everything** for now. Retention/archiving is a later TODO |
| Service filter | Every row has a `module` (service area); `GET /audit-logs` filters by it |
| Money events | Written **in the same DB transaction** as the change (pass the `EntityManager`), so a change can never exist without its audit row |
| Other events | Written after the request; a failed audit write is logged and never breaks the user's action |
| Secrets | Never stored: keys matching password/token/secret/OTP/2FA/recovery/card are replaced with `[REDACTED]`; passenger personal data is referenced by id, not copied |
| Time filters | `startDate`/`endDate` on `occurred_at` use `TimestampRangeQueryDto` (see `docs/guidelines/time-frame-apis.md`) |
| Who reads it | Platform users with **AUDIT_LOGS → View** (`PlatformAsset.AUDIT_LOGS` already exists). Airline-portal view is a later phase |
| Frontend | The current admin "Audit Logs" page is a placeholder with sample rows; it is rebuilt later on top of the API. Backend first |

## Modules (the `module` column)

| `AuditModule` | Covers |
|---|---|
| `AUTH` | sign-in (admin and airline), sign-out, password reset/change, 2FA setup/enable/disable/recover |
| `ADMIN_USERS` | platform admin users: create, update, delete, suspend, permission changes |
| `AIRLINES` | invites (send/resend/revoke), onboarding, airline details, activate/deactivate, suspend/unsuspend, platform fee |
| `AIRLINE_USERS` | airline users: create, update, delete, permission changes |
| `AIRPORTS` | airports create/update; airline airport assignments |
| `WALLET` | adjustments (top-up/deduction), credit limit; hold/charge/release (SYSTEM) |
| `CANCELLED_FLIGHTS` | flight create/update, bookings import/add/edit/delete, passenger confirmation, allocation start/retry, manual hotel booking, publish |
| `HOTEL_BOOKINGS` | confirmation PDF downloaded, confirmation email sent, supplier status updates |
| `SYSTEM` | background work: allocation crash-resume, post-run checks, supplier webhooks |

Add new modules only after asking the user.

## Conventions

- **Action names**: `<ENTITY>_<PAST_TENSE_VERB>`, e.g. `AIRLINE_SUSPENDED`,
  `WALLET_ADJUSTED`, `BOOKINGS_IMPORTED`. Add each new value to the
  `AuditAction` enum, grouped under its module.
- **One endpoint, several meanings**: keep a generic default on the decorator
  (`AIRLINE_UPDATED`) and let the service pick the specific one with
  `auditContext.setAction(...)` (e.g. a change of `isSuspended` →
  `AIRLINE_SUSPENDED` / `AIRLINE_UNSUSPENDED`).
- **Before/after**: call `auditContext.addChanges(before, update)` with the
  entity as loaded and the partial update actually written. Only changed fields
  are stored, as `field → [before, after]`. Prefix nested records
  (`"admin."`).
- **Labels**: `auditContext.setLabel(...)` with a human-readable name copied at
  the time ("Pacific Airways (PA)", "FV123 · 2026-10-25", the user's email).
  Set it right after loading the record so failures carry it too.
- **Airline**: every event about an airline must set `airlineId` (decorator
  `airlineIdParam`, or `auditContext.setAirline(...)`); airline users get it
  automatically from their token.
- **Ids**: `entityIdParam` for routes with the id; `entityIdFromResponse: true`
  for create endpoints (reads `data.id`); `auditContext.setEntity(...)`
  otherwise.
- **Unauthenticated endpoints** (sign-in, forgot password): set
  `actorEmailBodyField: "email"`; on a known account call
  `auditContext.setActor(...)` so failed attempts are attributed to it.
  Add the failure reason with `addMetadata({ reason: "wrong_password" })`.
- **Read-only endpoints** (GET) are not audited, except deliberate exports or
  document downloads listed in the phase checklist.
- Match the surrounding code style (comments, naming) of the file you change.

## Phases

### Phase 1 — Foundation

Goal: everything needed to record and read events, proven with a few events.

1. Migration `backend/src/database/migrations/<yyyymmdd>_create_audit_logs.sql`
   — table, indexes, append-only trigger ([reference.md § Migration](reference.md#migration)).
2. `backend/src/audit/`:
   - `audit.constants.ts` — `AuditModule`, `AuditAction`, `AuditEntityType`,
     `AuditOutcome`, `AuditActorType`, redaction pattern
   - `entities/audit-log.entity.ts`
   - `audit.context.ts` — `AuditContext` on `AsyncLocalStorage`
   - `audit.decorator.ts` — `@Audit(options)`
   - `audit.service.ts` — `record(entry, manager?)`, `buildHttpEntry(...)`, `list(query)`
   - `audit.interceptor.ts` — global, registered with `APP_INTERCEPTOR`
   - `dto/get-audit-logs-query.dto.ts`, `dto/audit-log-list-response.dto.ts`
   - `audit.controller.ts` — `GET /audit-logs`
   - `audit.module.ts` — `@Global()`, imported in `app.module.ts`
3. `auth/guards/rbac.guard.ts` — record 403s on `@Audit` endpoints
   (inject `AuditService` with `@Optional()`).
4. First events: admin sign-in (`AUTH`), airline update incl.
   suspend/activate (`AIRLINES`), wallet adjustment (`WALLET`).
5. Tests (see "Verifying" below).
6. Add the migration to the deploy notes; update
   `docs/configuration-switches.md` only if a switch is added.

### Phase 2 — Admin-side events

`AUTH` (all admin and airline auth endpoints), `ADMIN_USERS`, `AIRLINES`
(invites, onboarding, all airline updates, platform fee), `AIRPORTS`, `WALLET`
(credit limit changes).

For each controller: list its mutating endpoints, propose action names to the
user, then add `@Audit` + service enrichment.

### Phase 3 — Airline-side and system events

`AIRLINE_USERS`, `CANCELLED_FLIGHTS`, `HOTEL_BOOKINGS`, and `SYSTEM`:
wallet hold/charge/release (inside their transactions, in
`finance/repositories/wallet-hold.repository.ts`), allocation crash-resume,
post-run checks and supplier webhooks (`hotel-allocation.service.ts`,
`hotel-supplier-webhooks.controller.ts`).

### Later (TODO list)

- Admin "Audit Logs" page rebuilt on `GET /audit-logs` (module filter, date
  range, actor, outcome, changes viewer), CSV export (AUDIT_LOGS → Export).
- Airline-portal audit view (own airline only; hide platform-only fields).
- Per-record "History" tab (filter by `entityType` + `entityId`).
- Retention / archiving / monthly partitioning.

## Pitfalls

- **Interceptor and AsyncLocalStorage**: the handler runs when the observable is
  *subscribed*, so the interceptor must subscribe inside `AuditContext.run`
  (wrap in `new Observable(...)`), or services will not see the context.
- **Guards run before interceptors**: permission rejections never reach the
  interceptor — that is why `RbacGuard` records them.
- **Validation errors** (ValidationPipe) do reach the interceptor's
  `catchError`, so they are recorded as FAILURE.
- **Express params** may be typed `string | string[]`: read them through a
  helper that takes the first value.
- **TypeORM jsonb insert typing**: cast the row to
  `QueryDeepPartialEntity<AuditLogEntity>` when inserting.
- **Entities vs migrations**: automation-test mode builds the schema from
  entities, so declare the indexes on the entity too.
- Do not add an audit write inside a supplier HTTP call or a long transaction
  holding the wallet lock beyond what the wallet design already does.

## Verifying a phase

- `npx tsc --noEmit -p tsconfig.json` in `backend/`.
- Unit tests (`jest -c jest-unit.json`, `src/**/*.spec.ts`) for redaction,
  `AuditContext.addChanges`, and the interceptor (success row, failure row,
  error passed through unchanged).
- Integration check against a **throwaway local database** (never the shared
  staging DB in `.env.test`): create a temporary database on the local
  PostgreSQL, build the schema from entities, apply the migration, exercise the
  service/interceptor, then drop the database. Confirm: success and failure
  rows, failed sign-in without the password, before/after values, the
  transactional write rolls back with its change, the append-only trigger
  rejects UPDATE/DELETE, and every `GET /audit-logs` filter.
- Report to the user what was verified and what was not (e.g. not run in the
  browser).
