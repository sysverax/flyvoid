# Airline Invitation E2E Test Cases

This document lists the black-box E2E test suites for airline invitation APIs.

Scope:

- HTTP-only assertions via supertest
- Raw SQL seeding/cleanup via pg helpers
- No imports from src in test code

## Files

- [airline-invitations-create.e2e-spec.ts](airline-invitations-create.e2e-spec.ts)
  : `POST /api/v1/airline/invitations`
- [airline-invitations-list.e2e-spec.ts](airline-invitations-list.e2e-spec.ts)
  : `GET /api/v1/airline/invitations`
- [airline-invitation-resend.e2e-spec.ts](airline-invitation-resend.e2e-spec.ts)
  : `POST /api/v1/airline/invitations/{invitationId}/resend`
- [airline-invitation-revoke.e2e-spec.ts](airline-invitation-revoke.e2e-spec.ts)
  : `POST /api/v1/airline/invitations/{invitationId}/revoke`
- [airline-invitation-matrix.e2e-spec.ts](airline-invitation-matrix.e2e-spec.ts)
  : `GET /api/v1/airline/invitations/matrix`
- [airline-invitation-detail.e2e-spec.ts](airline-invitation-detail.e2e-spec.ts)
  : `GET /api/v1/airline/invitations/{invitationId}`

## Coverage Map

### Create Invitation

- Covered: `TC_AIRLINE_INVITE_001` to `TC_AIRLINE_INVITE_036`, `TC_AIRLINE_INVITE_038` to `TC_AIRLINE_INVITE_110`
- Deferred/TODO:
  - `TC_AIRLINE_INVITE_021` (reinvite-after-expiry deterministic same-identity flow)
  - `TC_AIRLINE_INVITE_037` (companyRegistrationNumber casing conflict depends on DB collation/normalization)

### List Invitations

- Covered: SUPER_ADMIN/STAFF-VIEW happy paths, expired-JWT/inactive-admin/EDIT-only/no-perm auth matrix, pagination structure (page, limit, total, currentPage, totalPages), out-of-range page → empty array, count consistency, count delta after new invite, status data integrity (ACCEPTED/REVOKED/expired), duplicate-ID guard, no sensitive fields, SQL injection in page → 400, duplicate query keys gracefully handled, unknown query param accepted
- Deferred/TODO:
  - `TC_AIRLINE_INVITATION_LIST_069/070`: Duplicate query key and uppercase status filter behaviour (implementation-specific; tested with `[200, 400]` assertion)

### Resend Invitation

- Covered: pending/expired/revoked success paths, full auth matrix (inactive/VIEW-only/no-perm/super), large invitationId edge case, token rotation + old-token invalidation, revoked-to-PENDING transition, expiresAt refresh, SQL injection, script injection, wrong HTTP method, malformed Authorization header, STAFF-EDIT cross-authorization, response metadata fields
- Deferred/TODO:
  - `TC_AIRLINE_INVITATION_RESEND_036-037` (concurrent resend edge cases)

### Revoke Invitation

- Covered: pending/expired/already-revoked success paths, full auth matrix (inactive/VIEW-only/no-perm/super), revoked-token-prevents-onboard, resend-after-revoke, status-REVOKED assertion, idempotent revoke, expired-invitation revoke, SQL injection, script injection, wrong HTTP method, audit trail — history REVOKED event with ISO timestamp
- Deferred/TODO:
  - `TC_AIRLINE_INVITATION_REVOKE_038-039` (concurrent revoke edge cases)

### Invitation Matrix

- Covered: SUPER_ADMIN/STAFF-VIEW success, full auth matrix (inactive/EDIT-only/no-perm/super), lifecycle delta tests (create→pending+1, revoke→revoked+1/pending−1, accept→accepted+1, expire→expired↑), arithmetic invariant at every delta snapshot, non-negative integer checks, malformed auth header, wrong HTTP method
- Deferred/TODO:
  - `TC_AIRLINE_INVITATION_MATRIX_042` (concurrent matrix reads)

### Invitation Detail

- Covered: all status variants, full auth matrix (inactive/EDIT-only/no-perm/super), not-found/path validation, response contract, history ordering, status-enum validity, acceptedAt null-for-non-accepted, REVOKED-status matches last history event, consistency with list endpoint, SQL injection, script injection, overflow numeric path param
- Deferred/TODO:
  - `TC_AIRLINE_INVITATION_DETAIL_047` (concurrent detail reads)

## Notes

- Invitation test data uses `E2E` prefixes for airline code and company registration values.
- Admin and invitation records are cleaned by patterns:
  - admins: `%@e2e-airline.test`
  - invite-related entities: `E2E%`
- **Auth matrix pattern**: For inactive-admin tests, a valid token is obtained before the admin is deactivated via SQL, ensuring the JWT is cryptographically valid but rejected by the server's `is_active` guard.
- **Read (GET) endpoints** require `VIEW` permission; **write (POST) resend/revoke** endpoints require `EDIT` permission.
- Some tests intentionally use `it.todo` where behaviour depends on timing, concurrency, parser specifics, or DB collation.
