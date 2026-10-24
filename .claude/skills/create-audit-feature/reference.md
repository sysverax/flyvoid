# Audit feature — code templates

Templates for Phase 1, plus usage examples for later phases. Adapt names to the
code you find; keep the behaviour.

## Migration

```sql
-- Audit log: who did what, to which record, when, and what changed.
-- Append-only. Retention: everything is kept for now (TODO).
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamp without time zone NOT NULL DEFAULT now(),
  module varchar(40) NOT NULL,
  action varchar(80) NOT NULL,
  outcome varchar(10) NOT NULL,
  actor_type varchar(20) NOT NULL,
  actor_id integer,
  actor_email varchar(255),
  airline_id integer,
  entity_type varchar(40),
  entity_id varchar(64),
  entity_label varchar(255),
  changes jsonb,            -- { "field": [before, after] }
  metadata jsonb,
  status_code integer,
  error_message text,
  request_id varchar(64),
  http_method varchar(10),
  path text,
  ip_address varchar(64),
  user_agent text,
  CONSTRAINT chk_audit_logs_outcome CHECK (outcome IN ('SUCCESS', 'FAILURE')),
  CONSTRAINT chk_audit_logs_actor_type
    CHECK (actor_type IN ('PLATFORM', 'AIRLINE', 'SYSTEM', 'ANONYMOUS'))
);
-- No foreign keys: audit rows must outlive the records they mention.

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON public.audit_logs (occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_occurred_at ON public.audit_logs (module, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_airline_occurred_at ON public.audit_logs (airline_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_type, actor_id);

CREATE OR REPLACE FUNCTION public.audit_logs_prevent_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_prevent_change();
```

The entity mirrors these columns (`id` as `bigint` → `string` in TS,
`occurredAt` as `@CreateDateColumn`, jsonb columns typed as records) and
declares the same five indexes with `@Index`.

## Constants (`audit.constants.ts`)

```ts
export enum AuditModule { AUTH = "AUTH", ADMIN_USERS = "ADMIN_USERS", AIRLINES = "AIRLINES",
  AIRLINE_USERS = "AIRLINE_USERS", AIRPORTS = "AIRPORTS", WALLET = "WALLET",
  CANCELLED_FLIGHTS = "CANCELLED_FLIGHTS", HOTEL_BOOKINGS = "HOTEL_BOOKINGS", SYSTEM = "SYSTEM" }

/** <ENTITY>_<PAST_TENSE_VERB>, grouped by module; grows phase by phase. */
export enum AuditAction {
  // AUTH
  ADMIN_SIGNED_IN = "ADMIN_SIGNED_IN",
  // AIRLINES
  AIRLINE_UPDATED = "AIRLINE_UPDATED", AIRLINE_ACTIVATED = "AIRLINE_ACTIVATED",
  AIRLINE_DEACTIVATED = "AIRLINE_DEACTIVATED", AIRLINE_SUSPENDED = "AIRLINE_SUSPENDED",
  AIRLINE_UNSUSPENDED = "AIRLINE_UNSUSPENDED",
  // WALLET
  WALLET_ADJUSTED = "WALLET_ADJUSTED",
}

export enum AuditEntityType { ADMIN_USER = "ADMIN_USER", AIRLINE = "AIRLINE",
  AIRLINE_USER = "AIRLINE_USER", AIRPORT = "AIRPORT", WALLET = "WALLET",
  CANCELLED_FLIGHT = "CANCELLED_FLIGHT", BOOKING = "BOOKING", HOTEL_BOOKING = "HOTEL_BOOKING" }

export enum AuditOutcome { SUCCESS = "SUCCESS", FAILURE = "FAILURE" }
export enum AuditActorType { PLATFORM = "PLATFORM", AIRLINE = "AIRLINE", SYSTEM = "SYSTEM", ANONYMOUS = "ANONYMOUS" }

export const AUDIT_REDACTED_KEY_PATTERN =
  /pass(word)?|token|secret|otp|recovery|2fa|totp|cvv|card[_-]?number|authorization/i;
```

## Context (`audit.context.ts`)

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface AuditContextStore {
  action?: string;
  actor?: { type: AuditActorType; id?: number | null; email?: string | null };
  airlineId?: number | null;
  entityType?: string;
  entityId?: string | number | null;
  entityLabel?: string | null;
  changes: Record<string, [unknown, unknown]>;
  metadata: Record<string, unknown>;
}

const storage = new AsyncLocalStorage<AuditContextStore>();

@Injectable()
export class AuditContext {
  static run<T>(store: AuditContextStore, fn: () => T): T { return storage.run(store, fn); }
  static createStore(): AuditContextStore { return { changes: {}, metadata: {} }; }

  // Every method is a no-op outside an audited request.
  setAction(action: string) { const s = storage.getStore(); if (s) s.action = action; }
  setActor(actor: AuditContextStore["actor"]) { const s = storage.getStore(); if (s) s.actor = actor; }
  setAirline(airlineId: number | null | undefined) { const s = storage.getStore(); if (s && airlineId !== undefined) s.airlineId = airlineId; }
  setEntity(type: string, id: string | number | null | undefined, label?: string | null) { /* set type, id, label */ }
  setLabel(label: string | null) { /* … */ }
  addChange(field: string, before: unknown, after: unknown) { /* skip when equal (numbers compared numerically: "7.00" == 7) */ }
  addChanges(before: Record<string, unknown> | null | undefined, after: Record<string, unknown>, prefix = "") {
    for (const [field, value] of Object.entries(after)) if (value !== undefined) this.addChange(`${prefix}${field}`, before?.[field], value);
  }
  addMetadata(values: Record<string, unknown>) { const s = storage.getStore(); if (s) Object.assign(s.metadata, values); }
}
```

## Decorator (`audit.decorator.ts`)

```ts
export const AUDIT_METADATA_KEY = "audit:options";

export interface AuditOptions {
  module: AuditModule;
  action: AuditAction;              // default; service may replace it
  entityType?: AuditEntityType;
  entityIdParam?: string;           // route param with the entity id
  entityIdFromResponse?: boolean;   // create endpoints: response data.id
  airlineIdParam?: string;          // route param with the airline id
  actorEmailBodyField?: string;     // unauthenticated endpoints (sign-in)
}

export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_METADATA_KEY, options);
```

## Service (`audit.service.ts`)

```ts
async record(entry: AuditEntry, manager?: EntityManager): Promise<void> {
  const row = { /* map entry → columns; redact(changes), redact(metadata); truncate texts to 2000;
                   entityId → String(...); empty changes/metadata → null */ };
  // jsonb columns are typed as records; TypeORM's insert type cannot express that.
  const values = row as QueryDeepPartialEntity<AuditLogEntity>;
  if (manager) {                                   // money events: part of the caller's transaction
    await manager.getRepository(AuditLogEntity).insert(values);
    return;
  }
  try { await this.auditRepository.insert(values); }
  catch (error) { this.logger.error("Failed to write audit log", this.context, entry.requestId, { … }); }
}
```

`buildHttpEntry(options, request, store, { body?, error? })`:
- **actor**: `store.actor` → else `request.user` (`PLATFORM` / `AIRLINE`, `sub`,
  `email`) → else `ANONYMOUS` with `body[actorEmailBodyField]` lower-cased.
- **entityId**: `store.entityId` → `paramOf(request, entityIdParam)` →
  `body.data.id` when `entityIdFromResponse`.
- **airlineId**: `store.airlineId` → `airlineIdParam` → airline user's
  `airlineId` → null.
- **action**: `store.action ?? options.action`.
- **failure**: `outcome FAILURE`, `statusCode` (`HttpException.getStatus()`, else
  `error.status`, else 500), `errorMessage` (HttpException body `message`,
  string or array joined with "; "), `changes: null`.
- **request**: `requestId`, `method`, path without query string, `ip`,
  `user-agent`.

```ts
/** A route param as a single string (Express types allow string[]). */
const paramOf = (request: AuthenticatedRequest, name: string) => {
  const value = (request.params as Record<string, string | string[] | undefined>)?.[name];
  return Array.isArray(value) ? value[0] : value;
};
```

`list(query)`: query builder on `log`, `andWhere` per filter (module, action,
outcome, actorType, actorId, airlineId, entityType, entityId, `search` ILIKE on
actorEmail/entityLabel, `occurredAt >= startDate` and `< endDate` via
`toUtcTimestampParam`), order `occurredAt DESC, id DESC`, paginate; respond
`{ auditLogs: [...], pagination: { currentPage, limit, totalCount } }` with
`actor { type, id, email }` and `entity { type, id, label }` objects.

## Interceptor (`audit.interceptor.ts`)

```ts
intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
  if (context.getType() !== "http") return next.handle();
  const options = this.reflector.get<AuditOptions | undefined>(AUDIT_METADATA_KEY, context.getHandler());
  if (!options) return next.handle();

  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  const store = AuditContext.createStore();

  // The handler runs on subscribe: subscribe inside the context.
  return new Observable((subscriber) =>
    AuditContext.run(store, () =>
      next.handle().pipe(
        tap((body) => void this.auditService.record(this.auditService.buildHttpEntry(options, request, store, { body }))),
        catchError((error: unknown) => {
          void this.auditService.record(this.auditService.buildHttpEntry(options, request, store, { error }));
          return throwError(() => error);
        }),
      ).subscribe(subscriber),
    ),
  );
}
```

## Guard hook (`auth/guards/rbac.guard.ts`)

```ts
constructor(private readonly reflector: Reflector, @Optional() private readonly auditService?: AuditService) {}

async canActivate(context: ExecutionContext): Promise<boolean> {
  try {
    return await this.checkAccess(context);          // the existing checks, moved unchanged
  } catch (error) {
    const options = this.reflector.get<AuditOptions | undefined>(AUDIT_METADATA_KEY, context.getHandler());
    if (options && this.auditService) {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      void this.auditService.record(this.auditService.buildHttpEntry(options, request, undefined, { error }));
    }
    throw error;
  }
}
```

## Module (`audit.module.ts`)

```ts
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity]), AuthModule],   // AuthModule: guards on AuditController
  controllers: [AuditController],
  providers: [AuditService, AuditContext, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService, AuditContext],
})
export class AuditLogModule {}
```

Import `AuditLogModule` in `app.module.ts` (after `LoggerModule`).

## Controller (`audit.controller.ts`)

`@Controller("audit-logs")`, `@UseGuards(JwtAuthGuard, RbacGuard)`,
`@RequireUserTypes(UserType.PLATFORM)`, and on `@Get()`
`@RequireAccessControl({ platform: { asset: PlatformAsset.AUDIT_LOGS, access: [AccessAction.VIEW] } })`.
Query DTO: `IntersectionType(PaginationQueryDto, TimestampRangeQueryDto)` plus
the filters above (enums validated with `@IsEnum`, ids with `@IsInt`, strings
trimmed with `@MaxLength`). Swagger: describe every filter and the
`changes` format.

## Usage examples

### Endpoint with route id (update / suspend)

```ts
@Patch(":airlineId")
@Audit({ module: AuditModule.AIRLINES, action: AuditAction.AIRLINE_UPDATED,
  entityType: AuditEntityType.AIRLINE, entityIdParam: "airlineId", airlineIdParam: "airlineId" })
async updateAirline(...) { ... }
```

```ts
// AirlineService.updateAirline — after loading `airline`, before writing
this.auditContext.setLabel(`${airline.name} (${airline.code})`);
// …build airlineUpdate / adminUpdate as today…
this.auditContext.addChanges(airline as unknown as Record<string, unknown>, airlineUpdate);
this.auditContext.addChanges(adminUser, adminUpdate, "admin.");
if (isSuspended changed) this.auditContext.setAction(next ? AuditAction.AIRLINE_SUSPENDED : AuditAction.AIRLINE_UNSUSPENDED);
else if (isActive changed) this.auditContext.setAction(next ? AuditAction.AIRLINE_ACTIVATED : AuditAction.AIRLINE_DEACTIVATED);
```

### Unauthenticated endpoint (sign-in)

```ts
@Audit({ module: AuditModule.AUTH, action: AuditAction.ADMIN_SIGNED_IN,
  entityType: AuditEntityType.ADMIN_USER, actorEmailBodyField: "email" })
async adminSignin(@Body() dto: AdminSigninRequestDto, ...) { ... }
```

```ts
// AuthService.signin
if (admin) {                                         // failed attempts on a real account are attributed to it
  this.auditContext.setActor({ type: AuditActorType.PLATFORM, id: admin.id, email: admin.email });
  this.auditContext.setEntity(AuditEntityType.ADMIN_USER, admin.id, admin.email);
}
// before each "Invalid credentials" throw:
this.auditContext.addMetadata({ reason: "unknown_email" | "account_inactive" | "wrong_password" });
// on each successful return:
this.auditContext.addMetadata({ result: "signed_in" | "two_factor_required" | "password_reset_required" });
```

### Create endpoint

```ts
@Post()
@Audit({ module: AuditModule.AIRPORTS, action: AuditAction.AIRPORT_CREATED,
  entityType: AuditEntityType.AIRPORT, entityIdFromResponse: true })
```

### Money event / background job (SYSTEM, same transaction)

```ts
await this.auditService.record({
  module: AuditModule.WALLET,
  action: AuditAction.WALLET_BOOKING_CHARGED,
  actorType: AuditActorType.SYSTEM,
  airlineId,
  entityType: AuditEntityType.HOTEL_BOOKING,
  entityId: hotelBookingId,
  entityLabel: description,
  metadata: { amount, estimate, balanceBefore, balanceAfter },
}, manager);                                         // rolls back with the charge
```
