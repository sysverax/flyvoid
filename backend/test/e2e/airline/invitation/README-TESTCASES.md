# Airline Invitation E2E Test Cases

This document lists all airline invitation E2E test cases extracted from the test specification files.

**Scope:**

- HTTP-only assertions via supertest
- Raw SQL seeding/cleanup via pg helpers
- No imports from src in test code

---

## Files

- [airline-invitations-create.e2e-spec.ts](../../e2e/airline/invitation/airline-invitations-create.e2e-spec.ts) : `POST /api/v1/airline/invitations`
- [airline-invitations-list.e2e-spec.ts](../../e2e/airline/invitation/airline-invitations-list.e2e-spec.ts) : `GET /api/v1/airline/invitations`
- [airline-invitation-resend.e2e-spec.ts](../../e2e/airline/invitation/airline-invitation-resend.e2e-spec.ts) : `POST /api/v1/airline/invitations/{invitationId}/resend`
- [airline-invitation-revoke.e2e-spec.ts](../../e2e/airline/invitation/airline-invitation-revoke.e2e-spec.ts) : `POST /api/v1/airline/invitations/{invitationId}/revoke`
- [airline-invitation-matrix.e2e-spec.ts](../../e2e/airline/invitation/airline-invitation-matrix.e2e-spec.ts) : `GET /api/v1/airline/invitations/matrix`
- [airline-invitation-detail.e2e-spec.ts](../../e2e/airline/invitation/airline-invitation-detail.e2e-spec.ts) : `GET /api/v1/airline/invitations/{invitationId}`

---

## Test Cases by Endpoint

### POST /api/v1/airline/invitations

#### Success Scenarios

- `TC_AIRLINE_INVITE_001`: Airline invitation by SUPER_ADMIN with valid payload, expected `201`
- `TC_AIRLINE_INVITE_002`: Airline invitation by STAFF with INVITES_ONBOARDING EDIT access, expected `201`
- `TC_AIRLINE_INVITE_003`: Invitation with minimum valid required fields only, expected `201`
- `TC_AIRLINE_INVITE_004`: Invitation with all optional fields populated, expected `201`
- `TC_AIRLINE_INVITE_005`: Invitation with creditLimit omitted, default value applied, expected `201`
- `TC_AIRLINE_INVITE_006`: Invitation with creditLimit set to zero, expected `201`
- `TC_AIRLINE_INVITE_007`: Invitation with valid positive creditLimit, expected `201`
- `TC_AIRLINE_INVITE_008`: Invitation with mixed-case adminEmail normalization, expected `201`
- `TC_AIRLINE_INVITE_009`: Invitation with lowercase airlineCode normalization, expected `201`
- `TC_AIRLINE_INVITE_010`: Invitation with lowercase countryCode normalization, expected `201`
- `TC_AIRLINE_INVITE_011`: Invitation with Unicode airline name, expected `201`

#### Response Contract Validation

- `TC_AIRLINE_INVITE_012`: Response contains invitationId field as number, expected `201`
- `TC_AIRLINE_INVITE_013`: Response contains airlineName field as string, expected `201`
- `TC_AIRLINE_INVITE_014`: Response contains airlineCode field as string, expected `201`
- `TC_AIRLINE_INVITE_015`: Response contains companyRegistrationNumber field as string, expected `201`
- `TC_AIRLINE_INVITE_016`: Response contains creditLimit field as number, expected `201`
- `TC_AIRLINE_INVITE_017`: Response contains onboardingLink field as string, expected `201`
- `TC_AIRLINE_INVITE_018`: Response contains expiresIn field as string, expected `201`
- `TC_AIRLINE_INVITE_019`: Response contains email field as string, expected `201`
- `TC_AIRLINE_INVITE_020`: Response onboardingLink contains valid token parameter, expected `201`

#### Authentication & Authorization

- `TC_AIRLINE_INVITE_022`: Invitation without access token, expected `401`
- `TC_AIRLINE_INVITE_023`: Invitation with invalid access token, expected `401`
- `TC_AIRLINE_INVITE_024`: Invitation with expired access token, expected `401`
- `TC_AIRLINE_INVITE_025`: Invitation by inactive platform admin, expected `403`
- `TC_AIRLINE_INVITE_026/027`: Invitation by STAFF without INVITES_ONBOARDING EDIT access, expected `403`
- `TC_AIRLINE_INVITE_028`: Invitation by airline user account, expected `403`

#### Conflict Validations

- `TC_AIRLINE_INVITE_029`: Duplicate airlineCode already exists in airlines table, expected `409`
- `TC_AIRLINE_INVITE_030`: Duplicate companyRegistrationNumber already exists in airlines table, expected `409`
- `TC_AIRLINE_INVITE_031`: adminEmail already registered as airline user, expected `409`

#### Active Pending Invitation Conflicts (Duplicate Checks)

- `TC_AIRLINE_INVITE_032`: Duplicate by adminEmail on active pending invitation, expected `409`
- `TC_AIRLINE_INVITE_033`: Duplicate by airlineCode on active pending invitation, expected `409`
- `TC_AIRLINE_INVITE_034`: Duplicate by companyRegistrationNumber on active pending invitation, expected `409`
- `TC_AIRLINE_INVITE_035`: Duplicate by lowercase airlineCode on active pending invitation, expected `409`
- `TC_AIRLINE_INVITE_036`: Duplicate by uppercase adminEmail on active pending invitation, expected `409`
- `TC_AIRLINE_INVITE_037`: Duplicate by lowercase companyRegistrationNumber (case-sensitive), expected `409` or `201`

#### Required Fields - Missing/Empty/Null Validation

- `TC_AIRLINE_INVITE_required_missing_*`: Missing required fields (13 fields tested), expected `400`
  - airlineName, airlineCode, countryCode, companyRegistrationNumber, contactEmail, contactPhone, timezone, address, currency, adminFirstName, adminLastName, adminEmail, jobTitle
- `TC_AIRLINE_INVITE_required_empty_*`: Empty string for required fields (13 fields tested), expected `400`
- `TC_AIRLINE_INVITE_required_null_*`: Null value for required fields (13 fields tested), expected `400`

#### Invalid Format Validation

- `TC_AIRLINE_INVITE_077`: Invalid adminEmail format, expected `400`
- `TC_AIRLINE_INVITE_078`: Invalid contactEmail format, expected `400`
- `TC_AIRLINE_INVITE_079`: Invalid website URL format (htp:/bad), expected `400`
- `TC_AIRLINE_INVITE_080`: Invalid logo URL format (htp:/bad), expected `400`
- `TC_AIRLINE_INVITE_081`: Invalid contactPhone format (abc), expected `400`
- `TC_AIRLINE_INVITE_082`: Invalid countryCode format (AAA), expected `400`
- `TC_AIRLINE_INVITE_083`: Invalid currency format (exceeds 10 chars), expected `400`
- `TC_AIRLINE_INVITE_084`: Empty timezone value, expected `400`
- `TC_AIRLINE_INVITE_085`: Invalid airlineCode with spaces (BAD CODE), expected `400`
- `TC_AIRLINE_INVITE_086`: Invalid companyRegistrationNumber format (@@@@@@), expected `400`

#### Deferred/TODO

- `TC_AIRLINE_INVITE_021`: Re-invite after expiration (requires deterministic manipulation)
- `TC_AIRLINE_INVITE_037`: Company registration casing (DB collation dependent)

---

### GET /api/v1/airline/invitations

#### Success Scenarios

- `TC_AIRLINE_INVITATION_LIST_001`: Get invitations as SUPER_ADMIN, expected `200`
- `TC_AIRLINE_INVITATION_LIST_002`: Get invitations as STAFF with VIEW access, expected `200`

#### Response Contract Validation (Pagination & Fields)

- `TC_AIRLINE_INVITATION_LIST_003`: Response includes total count as number, expected `200`
- `TC_AIRLINE_INVITATION_LIST_004`: Response includes currentPage as number, expected `200`
- `TC_AIRLINE_INVITATION_LIST_005`: Response includes limit as number, expected `200`
- `TC_AIRLINE_INVITATION_LIST_006`: Response includes invitations as array, expected `200`
- `TC_AIRLINE_INVITATION_LIST_007`: Each invitation includes invitationId field, expected `200`
- `TC_AIRLINE_INVITATION_LIST_008`: Each invitation includes airlineId field (nullable), expected `200`
- `TC_AIRLINE_INVITATION_LIST_009`: Each invitation includes airlineName field, expected `200`
- `TC_AIRLINE_INVITATION_LIST_010`: Each invitation includes airlineCode field, expected `200`
- `TC_AIRLINE_INVITATION_LIST_011`: Each invitation includes firstName field, expected `200`
- `TC_AIRLINE_INVITATION_LIST_012`: Each invitation includes lastName field, expected `200`
- `TC_AIRLINE_INVITATION_LIST_013`: Each invitation includes email field, expected `200`
- `TC_AIRLINE_INVITATION_LIST_014`: Each invitation includes jobTitle field, expected `200`
- `TC_AIRLINE_INVITATION_LIST_015`: Each invitation includes invitedByAdminId field, expected `200`

#### Authentication & Authorization

- `TC_AIRLINE_INVITATION_LIST_028`: Request without access token, expected `401`
- `TC_AIRLINE_INVITATION_LIST_029`: Request with invalid token, expected `401`

#### Query Parameter Validation

- `TC_AIRLINE_INVITATION_LIST_044`: Invalid page=0, expected `400`
- `TC_AIRLINE_INVITATION_LIST_045`: Invalid page=-1, expected `400`
- `TC_AIRLINE_INVITATION_LIST_046`: Invalid page=1.5 (float), expected `400`
- `TC_AIRLINE_INVITATION_LIST_047`: Invalid page=abc (non-numeric), expected `400`
- `TC_AIRLINE_INVITATION_LIST_048`: Invalid page=true (boolean), expected `400`
- `TC_AIRLINE_INVITATION_LIST_049`: Invalid limit=0, expected `400`
- `TC_AIRLINE_INVITATION_LIST_050`: Invalid limit=-1, expected `400`
- `TC_AIRLINE_INVITATION_LIST_051`: Invalid limit=1.5 (float), expected `400`
- `TC_AIRLINE_INVITATION_LIST_052`: Invalid limit=abc (non-numeric), expected `400`
- `TC_AIRLINE_INVITATION_LIST_053`: Invalid limit=true (boolean), expected `400`

#### Sorting & Data Integrity

- `TC_AIRLINE_INVITATION_LIST_056`: Sorted by latest createdAt first, expected `200`

#### Deferred/TODO

- `TC_AIRLINE_INVITATION_LIST_030-043`: Remaining authz/pagination variants
- `TC_AIRLINE_INVITATION_LIST_054-055`: Additional pagination edge cases
- `TC_AIRLINE_INVITATION_LIST_057-070`: Status/data-integrity and parser edge cases

---

### POST /api/v1/airline/invitations/{invitationId}/resend

#### Success Scenarios

- `TC_AIRLINE_INVITATION_RESEND_001`: Resend pending invitation by Super Admin, expected `200`
- `TC_AIRLINE_INVITATION_RESEND_002`: Resend pending invitation by Staff with EDIT access, expected `200`
- `TC_AIRLINE_INVITATION_RESEND_003`: Resend expired invitation, expected `200`
- `TC_AIRLINE_INVITATION_RESEND_004`: Resend revoked invitation, expected `200`

#### Authentication & Authorization

- `TC_AIRLINE_INVITATION_RESEND_005`: Missing access token, expected `401`
- `TC_AIRLINE_INVITATION_RESEND_006`: Invalid access token, expected `401`
- `TC_AIRLINE_INVITATION_RESEND_007`: Expired access token, expected `401`

#### Not Found & Conflict

- `TC_AIRLINE_INVITATION_RESEND_012`: Resend non-existing invitationId, expected `404`
- `TC_AIRLINE_INVITATION_RESEND_013`: Resend accepted invitation, expected `409`

#### Path Parameter Validation

- `TC_AIRLINE_INVITATION_RESEND_014`: Invalid invitationId=0, expected `400`
- `TC_AIRLINE_INVITATION_RESEND_015`: Invalid invitationId=-1, expected `400`
- `TC_AIRLINE_INVITATION_RESEND_016`: Invalid invitationId=abc (non-numeric), expected `400`
- `TC_AIRLINE_INVITATION_RESEND_017`: Invalid invitationId=1.5 (float), expected `400`

#### Response Contract & Token Rotation

- `TC_AIRLINE_INVITATION_RESEND_019`: Response includes invitationId field, expected `200`
- `TC_AIRLINE_INVITATION_RESEND_020`: Response includes expiresIn as string, expected `200`
- `TC_AIRLINE_INVITATION_RESEND_021`: Response includes onboardingLink with token parameter, expected `200`
- `TC_AIRLINE_INVITATION_RESEND_022`: Response onboardingLink contains "token=" query parameter, expected `200`
- `TC_AIRLINE_INVITATION_RESEND_023`: Second resend generates different token (token rotation), expected `200`
- `TC_AIRLINE_INVITATION_RESEND_024`: Token changes between resends (security validation), expected `200`
- `TC_AIRLINE_INVITATION_RESEND_025`: Token parameter URL decodable, expected `200`

#### Deferred/TODO

- `TC_AIRLINE_INVITATION_RESEND_008-011`: Remaining authorization matrix
- `TC_AIRLINE_INVITATION_RESEND_018`: Extremely large invitationId value not found, expected `404`
- `TC_AIRLINE_INVITATION_RESEND_026-037`: Business logic/security including concurrent resend
- `TC_AIRLINE_INVITATION_RESEND_038-041`: Audit metadata and exact message assertions

---

### POST /api/v1/airline/invitations/{invitationId}/revoke

#### Success Scenarios

- `TC_AIRLINE_INVITATION_REVOKE_001`: Revoke pending invitation by Super Admin, expected `200`
- `TC_AIRLINE_INVITATION_REVOKE_002`: Revoke pending by Staff with EDIT access, expected `200`
- `TC_AIRLINE_INVITATION_REVOKE_003`: Revoke already revoked invitation (idempotent), expected `200`
- `TC_AIRLINE_INVITATION_REVOKE_004`: Revoke expired invitation, expected `200`

#### Authentication & Authorization

- `TC_AIRLINE_INVITATION_REVOKE_005`: Missing access token, expected `401`
- `TC_AIRLINE_INVITATION_REVOKE_006`: Invalid access token, expected `401`
- `TC_AIRLINE_INVITATION_REVOKE_007`: Expired access token, expected `401`

#### Not Found & Conflict

- `TC_AIRLINE_INVITATION_REVOKE_012`: Revoke non-existing invitationId, expected `404`
- `TC_AIRLINE_INVITATION_REVOKE_013`: Revoke accepted invitation, expected `409`

#### Path Parameter Validation

- `TC_AIRLINE_INVITATION_REVOKE_014`: Invalid invitationId=0, expected `400`
- `TC_AIRLINE_INVITATION_REVOKE_015`: Invalid invitationId=-1, expected `400`
- `TC_AIRLINE_INVITATION_REVOKE_016`: Invalid invitationId=abc (non-numeric), expected `400`
- `TC_AIRLINE_INVITATION_REVOKE_017`: Invalid invitationId=1.5 (float), expected `400`
- `TC_AIRLINE_INVITATION_REVOKE_018`: Non-existing invitationId=999999999, expected `404`

#### Response Structure Validation

- `TC_AIRLINE_INVITATION_REVOKE_019`: Response includes invitationId field, expected `200`
- `TC_AIRLINE_INVITATION_REVOKE_020`: Response status field set to REVOKED, expected `200`
- `TC_AIRLINE_INVITATION_REVOKE_021`: Response success field is true, expected `200`
- `TC_AIRLINE_INVITATION_REVOKE_022`: Response includes requestId as string, expected `200`
- `TC_AIRLINE_INVITATION_REVOKE_023`: Response includes timestamp as string, expected `200`
- `TC_AIRLINE_INVITATION_REVOKE_024`: Response message confirms revocation, expected `200`
- `TC_AIRLINE_INVITATION_REVOKE_025`: Response structure validation complete, expected `200`
- `TC_AIRLINE_INVITATION_REVOKE_026`: Response metadata present and valid, expected `200`

#### Deferred/TODO

- `TC_AIRLINE_INVITATION_REVOKE_008-011`: Remaining authorization matrix
- `TC_AIRLINE_INVITATION_REVOKE_027-034`: Business logic deep checks, including resend-after-revoke
- `TC_AIRLINE_INVITATION_REVOKE_035-039`: SQLi/script/concurrency/method robustness
- `TC_AIRLINE_INVITATION_REVOKE_040-041`: Audit trail verification

---

### GET /api/v1/airline/invitations/matrix

#### Success Scenarios

- `TC_AIRLINE_INVITATION_MATRIX_001`: Fetch matrix by Super Admin, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_002`: Fetch by Staff with VIEW, expected `200`

#### Status Buckets Validation

- `TC_AIRLINE_INVITATION_MATRIX_003`: Matrix includes totalSent bucket count, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_004`: Matrix includes pending bucket count, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_005`: Matrix includes accepted bucket count, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_006`: Matrix includes expired bucket count, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_007`: Matrix includes revoked bucket count, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_008`: All status buckets have values > 0, expected `200`

#### Authentication & Authorization

- `TC_AIRLINE_INVITATION_MATRIX_009`: Missing access token, expected `401`
- `TC_AIRLINE_INVITATION_MATRIX_010`: Invalid access token, expected `401`
- `TC_AIRLINE_INVITATION_MATRIX_011`: Expired access token, expected `401`

#### Response Structure Validation

- `TC_AIRLINE_INVITATION_MATRIX_016`: Response totalSent is number, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_017`: Response accepted is number, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_018`: Response pending is number, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_019`: Response expired is number, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_020`: Response revoked is number, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_021`: Response success field is true, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_022`: Response includes requestId as string, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_023`: Response includes timestamp as string, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_024`: Response message confirms fetch success, expected `200`

#### Arithmetic & Data Integrity

- `TC_AIRLINE_INVITATION_MATRIX_025`: totalSent equals accepted + pending + expired + revoked, expected `200`

#### Non-Negative Integer Validation

- `TC_AIRLINE_INVITATION_MATRIX_035`: totalSent is non-negative integer, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_036`: accepted count is non-negative integer, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_037`: pending count is non-negative integer, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_038`: expired count is non-negative integer, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_039`: revoked count is non-negative integer, expected `200`
- `TC_AIRLINE_INVITATION_MATRIX_040`: All counts are integers (no floats), expected `200`

#### Deferred/TODO

- `TC_AIRLINE_INVITATION_MATRIX_012-015`: Remaining authorization matrix scenarios
- `TC_AIRLINE_INVITATION_MATRIX_026-034`: Dynamic lifecycle updates after create/accept/revoke/resend actions

---

### GET /api/v1/airline/invitations/{invitationId}

#### Success Scenarios

- `TC_AIRLINE_INVITATION_DETAIL_001`: Fetch by Super Admin, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_002`: Fetch by Staff with VIEW, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_003`: Fetch pending invitation, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_004`: Fetch accepted invitation, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_005`: Fetch expired invitation, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_006`: Fetch revoked invitation, expected `200`

#### Authentication & Authorization

- `TC_AIRLINE_INVITATION_DETAIL_007`: Missing access token, expected `401`
- `TC_AIRLINE_INVITATION_DETAIL_008`: Invalid access token, expected `401`
- `TC_AIRLINE_INVITATION_DETAIL_009`: Expired access token, expected `401`
- `TC_AIRLINE_INVITATION_DETAIL_010`: Unauthorized role/permission, expected `403`
- `TC_AIRLINE_INVITATION_DETAIL_011`: Staff without VIEW permission, expected `403`
- `TC_AIRLINE_INVITATION_DETAIL_012`: Airline user requesting other airline's invitation, expected `403`
- `TC_AIRLINE_INVITATION_DETAIL_013`: Cross-domain token attempting access, expected `401`/`403`

#### Not Found & Validation

- `TC_AIRLINE_INVITATION_DETAIL_014`: Non-existing invitationId, expected `404`
- `TC_AIRLINE_INVITATION_DETAIL_015`: Invalid invitationId=0 (numeric), expected `404`
- `TC_AIRLINE_INVITATION_DETAIL_016`: Invalid invitationId=-1 (numeric), expected `404`
- `TC_AIRLINE_INVITATION_DETAIL_017`: Invalid invitationId=abc (non-numeric), expected `400`
- `TC_AIRLINE_INVITATION_DETAIL_018`: Invalid invitationId=1.5 (float), expected `400`

#### Response Contract Validation

- `TC_AIRLINE_INVITATION_DETAIL_019`: Response includes invitationId field, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_020`: Response includes airlineId field (nullable), expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_021`: Response includes airlineName as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_022`: Response includes airlineCode as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_023`: Response includes companyRegistrationNumber as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_024`: Response includes firstName as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_025`: Response includes lastName as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_026`: Response includes email as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_027`: Response includes jobTitle as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_028`: Response includes invitedByAdminId as number, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_029`: Response includes status as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_030`: Response includes expiresAt as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_031`: Response includes createdAt as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_032`: Response includes updatedAt as string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_033`: Response includes history as array, expected `200`

#### History & Metadata Validation

- `TC_AIRLINE_INVITATION_DETAIL_034`: History events are ordered by createdAt (ascending), expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_035`: No duplicate history entries for same timestamp, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_036`: History includes event type and timestamp, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_037`: Metadata requestId is valid string, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_038`: Metadata timestamp is ISO 8601 format, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_039`: No sensitive fields like token_hash in response, expected `200`
- `TC_AIRLINE_INVITATION_DETAIL_040`: No password_hash in response (security check), expected `200`

#### Deferred/TODO

- `TC_AIRLINE_INVITATION_DETAIL_041-051`: Additional data integrity and audit checks

---

## Test Coverage Summary

| Endpoint | File                                   | Total Tests | Status                     |
| -------- | -------------------------------------- | ----------- | -------------------------- |
| Create   | airline-invitations-create.e2e-spec.ts | 110+        | 94 implemented, 2 deferred |
| List     | airline-invitations-list.e2e-spec.ts   | 70+         | 13 implemented, 4 deferred |
| Resend   | airline-invitation-resend.e2e-spec.ts  | 41+         | 13 implemented, 4 deferred |
| Revoke   | airline-invitation-revoke.e2e-spec.ts  | 41+         | 12 implemented, 4 deferred |
| Matrix   | airline-invitation-matrix.e2e-spec.ts  | 43+         | 13 implemented, 3 deferred |
| Detail   | airline-invitation-detail.e2e-spec.ts  | 51+         | 13 implemented, 3 deferred |

---

## Key Testing Patterns

1. **Enum Casting**: Admin role field properly cast to `admins_role_enum` in SQL
2. **Cleanup Ordering**: Invitations deleted before admins (FK constraints)
3. **Invalid ID Handling**: Numeric IDs return `404`; non-numeric return `400` (ParseIntPipe)
4. **Token Rotation**: Resend endpoints rotate tokens, return new onboarding links
5. **Idempotent Revoke**: Revoking already-revoked invitations returns `200`

---

## Environment Notes

- **Test Data**: Admin emails `%@e2e-airline.test`, invitation prefixes `E2E%`
- **Cleanup**: Deletion order - invitations first, then admins
- **Password**: `Password@123` for test admins
- **Deferred Tests**: Use `it.todo()` for deterministic time manipulation, collation-dependent, or concurrency scenarios
