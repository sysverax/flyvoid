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

- Covered: baseline happy paths, auth failures, key pagination validations, sorting, and unknown query behavior
- Deferred/TODO:
  - remaining per-case matrix from `TC_AIRLINE_INVITATION_LIST_030` to `TC_AIRLINE_INVITATION_LIST_070`

### Resend Invitation

- Covered: core success paths, auth failures, not-found, accepted conflict, invalid path params, response contract/rotation basics
- Deferred/TODO:
  - remaining authz matrix and deeper business/security/audit scenarios from `TC_AIRLINE_INVITATION_RESEND_008` onward

### Revoke Invitation

- Covered: core success/idempotency, auth failures, not-found, accepted conflict, invalid path params, response contract
- Deferred/TODO:
  - extended authz/business/security/audit scenarios from `TC_AIRLINE_INVITATION_REVOKE_008` onward

### Invitation Matrix

- Covered: success paths, auth failures, response structure, arithmetic consistency, non-negative integer checks
- Deferred/TODO:
  - remaining authz and lifecycle/concurrency/method-restriction cases from `TC_AIRLINE_INVITATION_MATRIX_012` onward

### Invitation Detail

- Covered: success/status variants, auth failures baseline, not-found/path validation, response contract, history ordering, metadata checks
- Deferred/TODO:
  - full authz matrix and advanced consistency/security/concurrency cases from `TC_AIRLINE_INVITATION_DETAIL_010` onward

## Notes

- Invitation test data uses `E2E` prefixes for airline code and company registration values.
- Admin and invitation records are cleaned by patterns:
  - admins: `%@e2e-airline.test`
  - invite-related entities: `E2E%`
- Some tests intentionally use `it.todo` where behavior depends on environment/parser/DB collation or requires deterministic time-based orchestration.
