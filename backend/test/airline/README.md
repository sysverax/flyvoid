# Airline E2E Test Cases

This document lists all airline e2e API test cases in this folder for quick review.

## Airline Profile API

Spec file: `airline-profile.e2e-spec.ts`

Endpoints:

- `GET /api/v1/airline/user/profile`
- `GET /api/v1/airline/profile`

Test cases:

- `TC_AIRLINE_PROFILE_001`: Airline user profile success, expected `200`
- `TC_AIRLINE_PROFILE_002`: Airline profile success, expected `200`
- `TC_AIRLINE_PROFILE_003`: Airline profile unauthorized, expected `401`
