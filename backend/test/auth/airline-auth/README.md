# Airline Auth E2E Test Cases

This document lists all Airline Auth API e2e test cases in this folder for quick review.

## Airline Signup (Onboard) API

- Spec file: `airline-signup.e2e-spec.ts`
- Endpoint: `POST /api/v1/auth/airline/onboard`

Test cases:

- `TC_AUTH_AIRLINE_SIGNUP_001`: Airline onboarding success, expected `200`
- `TC_AUTH_AIRLINE_SIGNUP_002`: Invalid invitation token, expected `401`
- `TC_AUTH_AIRLINE_SIGNUP_003`: Reused invitation token, expected `401`

## Airline Signin API

- Spec file: `airline-signin.e2e-spec.ts`
- Endpoint: `POST /api/v1/auth/airline/signin`

Test cases:

- `TC_AUTH_AIRLINE_SIGNIN_001`: Airline signin success, expected `200`
- `TC_AUTH_AIRLINE_SIGNIN_002`: Invalid password, expected `401`
- `TC_AUTH_AIRLINE_SIGNIN_003`: Inactive airline account, expected `401`
- `TC_AUTH_AIRLINE_SIGNIN_004`: Missing credentials, expected `400`

Notes:

- In external mode, `TC_AUTH_AIRLINE_SIGNIN_003` may be skipped due to in-process DB dependency for inactive-account seeding.

## Airline Forgot Password API

- Spec file: `forgot-password.e2e-spec.ts`
- Endpoints:
  - `POST /api/v1/auth/airline/forgot-password/send-otp`
  - `POST /api/v1/auth/airline/forgot-password/verify-otp`
  - `POST /api/v1/auth/airline/forgot-password`

Test cases:

- `TC_AUTH_AIRLINE_FORGOT_001`: Send airline forgot-password OTP, expected `200`
- `TC_AUTH_AIRLINE_FORGOT_002`: Verify airline OTP with invalid code, expected `401`
- `TC_AUTH_AIRLINE_FORGOT_003`: Reset airline password with invalid token, expected `401`

## Airline Session API

- Spec file: `session.e2e-spec.ts`
- Endpoints:
  - `POST /api/v1/auth/airline/refresh`
  - `POST /api/v1/auth/airline/signout`

Test cases:

- `TC_AUTH_AIRLINE_REFRESH_001`: Airline refresh success, expected `200`
- `TC_AUTH_AIRLINE_REFRESH_002`: Malformed refresh token, expected `401`
- `TC_AUTH_AIRLINE_SIGNOUT_001`: Airline signout success, expected `200`
- `TC_AUTH_AIRLINE_SIGNOUT_002`: Airline signout unauthorized, expected `401`
