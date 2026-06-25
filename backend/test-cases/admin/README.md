# Admin E2E Test Cases

This document lists all admin e2e API test cases in this folder for quick review.

## Admin Users APIs

Spec file: `admin-users.e2e-spec.ts`

Endpoints:

- `POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id`
- `GET /api/v1/admin/users?page=1&limit=2`

Test cases:

- `TC_ADMIN_USERS_001`: Invite admin user success with access controls, expected `201`
- `TC_ADMIN_USERS_002`: Invite admin validation failure without access controls, expected `400`
- `TC_ADMIN_USERS_003`: Update admin user success with access controls, expected `200`
- `TC_ADMIN_USERS_004`: List admin users with pagination metadata, expected `200`

## Admin Profile API

Spec file: `admin-profile.e2e-spec.ts`

Endpoint:

- `GET /api/v1/admin/profile`

Test cases:

- `TC_ADMIN_PROFILE_001`: Admin profile success, expected `200`
- `TC_ADMIN_PROFILE_002`: Admin profile unauthorized, expected `401`
