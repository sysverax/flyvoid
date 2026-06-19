# Airline Auth E2E Test Cases

This folder contains black-box E2E coverage for airline authentication endpoints, following the same style used by admin auth tests.

## Files

- `airline-onboard.e2e-spec.ts`
  - `POST /api/v1/auth/airline/onboard`
  - Covers invitation acceptance, invalid/reused/revoked/expired token handling, uniqueness conflicts, and validation/security checks.

- `airline-signin.e2e-spec.ts`
  - `POST /api/v1/auth/airline/signin`
  - Covers direct signin success, bad credentials, inactive user, validation errors, password-reset challenge, and 2FA challenge path.

- `airline-signin-2fa-verify.e2e-spec.ts`
  - `POST /api/v1/auth/airline/signin/2fa/verify`
  - Covers challenge verification success/failure paths and validation/security checks.

- `airline-signin-reset-password.e2e-spec.ts`
  - `POST /api/v1/auth/airline/signin/reset-password`
  - Covers initial reset challenge completion, invalid/reused token handling, and password policy validation.

- `airline-2fa-setup-enable.e2e-spec.ts`
  - `POST /api/v1/auth/airline/2fa/setup`
  - `POST /api/v1/auth/airline/2fa/enable`
  - Covers setup contract, enable success, wrong code/no-setup failures, auth failures, and payload validation.

- `airline-2fa-disable-recover.e2e-spec.ts`
  - `POST /api/v1/auth/airline/2fa/disable`
  - `POST /api/v1/auth/airline/2fa/recover`
  - Covers disable success/failure, recovery-code flow, invalid credential paths, and validation checks.

- `airline-forgot-password.e2e-spec.ts`
  - `POST /api/v1/auth/airline/forgot-password/send-otp`
  - `POST /api/v1/auth/airline/forgot-password/verify-otp`
  - `POST /api/v1/auth/airline/forgot-password/reset`
  - Covers OTP send/verify/reset happy paths and core negative/security validation paths.

- `airline-refresh-signout.e2e-spec.ts`
  - `POST /api/v1/auth/airline/refresh`
  - `POST /api/v1/auth/airline/signout`
  - Covers refresh rotation, revoked/invalid token handling, signout authorization constraints, and validation checks.

## Notes

- Tests use seeded invitation and auth data with e2e-specific email/code patterns.
- Cleanup runs in `afterAll` and removes seeded records from invitation and auth tables.
- OTP-related cases assume non-production static OTP behavior configured in test environment (`444444`).
