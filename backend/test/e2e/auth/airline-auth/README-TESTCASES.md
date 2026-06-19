# Airline Auth E2E Test Cases

This document lists all Airline Auth E2E test cases extracted from the specification files.

**Scope:**

- HTTP-only assertions via supertest
- Raw SQL seeding/cleanup via pg helpers (where applicable)
- No imports from src in test code

---

## Files

- [airline-2fa-disable-recover.e2e-spec.ts](./airline-2fa-disable-recover.e2e-spec.ts)
- [airline-2fa-setup-enable.e2e-spec.ts](./airline-2fa-setup-enable.e2e-spec.ts)
- [airline-forgot-password.e2e-spec.ts](./airline-forgot-password.e2e-spec.ts)
- [airline-onboard.e2e-spec.ts](./airline-onboard.e2e-spec.ts)
- [airline-refresh-signout.e2e-spec.ts](./airline-refresh-signout.e2e-spec.ts)
- [airline-signin.e2e-spec.ts](./airline-signin.e2e-spec.ts)
- [airline-signin-2fa-verify.e2e-spec.ts](./airline-signin-2fa-verify.e2e-spec.ts)
- [airline-signin-reset-password.e2e-spec.ts](./airline-signin-reset-password.e2e-spec.ts)

---

## Test Cases by Spec File

### airline-2fa-disable-recover.e2e-spec

- Spec file: airline-2fa-disable-recover.e2e-spec.ts
- Context: POST /api/v1/auth/airline/2fa/disable & /2fa/recover

Test cases:

- TC_AIRLINE_2FA_DISABLE_001: Disable with valid bearer + valid TOTP -> 200
- TC_AIRLINE_2FA_DISABLE_002: Wrong TOTP or not-enabled state -> 401
- TC_AIRLINE_2FA_DISABLE_003: Without/invalid bearer token and malformed JSON -> 401/400
- TC_AIRLINE_2FA_RECOVER_001: Valid email/password/recoveryCode disables 2FA -> 200
- TC_AIRLINE_2FA_RECOVER_002: Invalid credentials/recovery code/non-enabled -> 401
- TC_AIRLINE_2FA_RECOVER_003: Validation unknown fields/malformed JSON -> 400

### airline-2fa-setup-enable.e2e-spec

- Spec file: airline-2fa-setup-enable.e2e-spec.ts
- Context: POST /api/v1/auth/airline/2fa/setup & /2fa/enable

Test cases:

- TC_AIRLINE_2FA_SETUP_001: Setup with valid bearer token -> 200
- TC_AIRLINE_2FA_SETUP_002: Setup without/invalid token -> 401
- TC_AIRLINE_2FA_ENABLE_001: Enable with valid TOTP after setup -> 200
- TC_AIRLINE_2FA_ENABLE_002: Wrong TOTP or no setup context -> 401
- TC_AIRLINE_2FA_ENABLE_003: Without/invalid bearer token -> 401
- TC_AIRLINE_2FA_ENABLE_004: Validation unknown fields/malformed JSON -> 400

### airline-forgot-password.e2e-spec

- Spec file: airline-forgot-password.e2e-spec.ts
- Context: Airline forgot password flow

Test cases:

- TC_AIRLINE_FORGOT_SEND_001: send-otp for existing active account -> 200
- TC_AIRLINE_FORGOT_SEND_002: send-otp for unknown account remains generic -> 200
- TC_AIRLINE_FORGOT_SEND_003: send-otp validation and malformed JSON -> 400
- TC_AIRLINE_FORGOT_VERIFY_001: verify-otp with valid static OTP -> 200
- TC_AIRLINE_FORGOT_VERIFY_002: invalid OTP/non-existing/no prior send -> 401
- TC_AIRLINE_FORGOT_VERIFY_003: verify-otp validation and malformed JSON -> 400
- TC_AIRLINE_FORGOT_RESET_001: valid reset token + strong password -> 200
- TC_AIRLINE_FORGOT_RESET_002: invalid/reused token and weak password -> 401/400
- TC_AIRLINE_FORGOT_RESET_003: unknown field and malformed JSON -> 400

### airline-onboard.e2e-spec

- Spec file: airline-onboard.e2e-spec.ts
- Context: POST /api/v1/auth/airline/onboard

Test cases:

- TC_AIRLINE_ONBOARD_001: Onboard with valid invitation token and password -> 200
- TC_AIRLINE_ONBOARD_002: Invalid invitation token -> 401
- TC_AIRLINE_ONBOARD_003: Reusing accepted invitation token -> 409
- TC_AIRLINE_ONBOARD_004: Revoked invitation token -> 401
- TC_AIRLINE_ONBOARD_005: Expired invitation token -> 401
- TC_AIRLINE_ONBOARD_006: Conflict when airline code already exists -> 409
- TC_AIRLINE_ONBOARD_007: Conflict when admin email already exists -> 409
- TC_AIRLINE_ONBOARD_008: Validation errors for missing fields and weak password -> 400
- TC_AIRLINE_ONBOARD_009: Unknown field and malformed JSON -> 400

### airline-refresh-signout.e2e-spec

- Spec file: airline-refresh-signout.e2e-spec.ts
- Context: Airline refresh and signout

Test cases:

- TC_AIRLINE_REFRESH_001: valid refresh token rotation -> 200
- TC_AIRLINE_REFRESH_002: invalid/expired/revoked refresh token -> 401
- TC_AIRLINE_REFRESH_003: validation unknown fields/malformed JSON -> 400
- TC_AIRLINE_SIGNOUT_001: valid bearer + valid refresh token -> 200
- TC_AIRLINE_SIGNOUT_002: missing/invalid bearer token -> 401
- TC_AIRLINE_SIGNOUT_003: token belongs to another user or revoked token -> 401
- TC_AIRLINE_SIGNOUT_004: validation unknown fields/malformed JSON -> 400

### airline-signin.e2e-spec

- Spec file: airline-signin.e2e-spec.ts
- Context: POST /api/v1/auth/airline/signin

Test cases:

- TC_AIRLINE_SIGNIN_001: Signin success with valid credentials -> 200
- TC_AIRLINE_SIGNIN_002: Invalid email/password/non-existing account -> 401
- TC_AIRLINE_SIGNIN_003: Inactive airline account signin -> 401
- TC_AIRLINE_SIGNIN_004: Validation for invalid format/missing fields/short password -> 400
- TC_AIRLINE_SIGNIN_005: RequiresPasswordReset challenge response -> 200
- TC_AIRLINE_SIGNIN_006: RequiresTwoFactor challenge response -> 200
- TC_AIRLINE_SIGNIN_007: Unknown fields and malformed JSON -> 400

### airline-signin-2fa-verify.e2e-spec

- Spec file: airline-signin-2fa-verify.e2e-spec.ts
- Context: POST /api/v1/auth/airline/signin/2fa/verify

Test cases:

- TC_AIRLINE_2FA_VERIFY_001: Valid challenge token + valid TOTP -> 200
- TC_AIRLINE_2FA_VERIFY_002: Invalid or expired twoFactorToken -> 401
- TC_AIRLINE_2FA_VERIFY_003: Wrong twoFactorCode -> 401
- TC_AIRLINE_2FA_VERIFY_004: Non-2FA-enabled account attempt -> 401
- TC_AIRLINE_2FA_VERIFY_005: Validation missing fields/bad format -> 400
- TC_AIRLINE_2FA_VERIFY_006: Unknown field and malformed JSON -> 400

### airline-signin-reset-password.e2e-spec

- Spec file: airline-signin-reset-password.e2e-spec.ts
- Context: POST /api/v1/auth/airline/signin/reset-password

Test cases:

- TC_AIRLINE_RESET_001: Valid resetPasswordToken + strong password -> 200
- TC_AIRLINE_RESET_002: Invalid/expired reset token -> 401
- TC_AIRLINE_RESET_003: Weak newPassword -> 400
- TC_AIRLINE_RESET_004: Reuse of used reset token -> 401
- TC_AIRLINE_RESET_005: Unknown field and malformed JSON -> 400

