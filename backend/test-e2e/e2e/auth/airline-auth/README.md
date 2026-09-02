# Airline Auth E2E Test Cases

This folder contains black-box E2E coverage for airline authentication endpoints, following the same style used by admin auth tests.

## Files

- `airline-onboard.e2e-spec.ts`
  - `POST /api/v1/auth/airline/onboard`
  - Covers invitation acceptance, invalid/reused/revoked/expired token handling, all 5 uniqueness conflicts from the spec (airline code, CRN, admin email), validation, and type coercion checks.

- `airline-signin.e2e-spec.ts`
  - `POST /api/v1/auth/airline/signin`
  - Covers direct signin success, bad credentials, inactive user, inactive airline, email case-insensitivity, validation errors, password-reset challenge, 2FA challenge path, and token expiry fields in response.

- `airline-signin-2fa-verify.e2e-spec.ts`
  - `POST /api/v1/auth/airline/signin/2fa/verify`
  - Covers challenge verification success/failure paths, token one-time-use semantics, response shape validation, and validation/security checks.

- `airline-signin-reset-password.e2e-spec.ts`
  - `POST /api/v1/auth/airline/signin/reset-password`
  - Covers initial reset challenge completion, invalid/reused token handling, password policy validation, missing fields, type coercion, and response shape.

- `airline-2fa-setup-enable.e2e-spec.ts`
  - `POST /api/v1/auth/airline/2fa/setup`
  - `POST /api/v1/auth/airline/2fa/enable`
  - Covers setup contract, 2FA-already-enabled conflict (409), enable success, wrong code/no-setup failures, auth failures, and payload validation.

- `airline-2fa-disable-recover.e2e-spec.ts`
  - `POST /api/v1/auth/airline/2fa/disable`
  - `POST /api/v1/auth/airline/2fa/recover`
  - Covers disable success/failure, missing fields, unknown field rejection, recovery-code one-time-use semantics, invalid credential paths, and validation checks.

- `airline-forgot-password.e2e-spec.ts`
  - `POST /api/v1/auth/airline/forgot-password/send-otp`
  - `POST /api/v1/auth/airline/forgot-password/verify-otp`
  - `POST /api/v1/auth/airline/forgot-password`
  - Covers OTP send/verify/reset happy paths, user-enumeration protection, unknown field rejection, missing field validation, core negative/security paths, and type coercion on reset.

- `airline-refresh-signout.e2e-spec.ts`
  - `POST /api/v1/auth/airline/refresh`
  - `POST /api/v1/auth/airline/signout`
  - Covers refresh rotation, token invalidation after password reset, revoked/invalid token handling, missing field validation, signout authorization constraints, accessToken-as-body-refreshToken rejection, and tampered JWT signature rejection.

## Test Cases by File

### airline-onboard.e2e-spec.ts

- `TC_AIRLINE_ONBOARD_001`: Onboard with valid invitation token and password, expected `200`
- `TC_AIRLINE_ONBOARD_002`: Invalid invitation token, expected `401`
- `TC_AIRLINE_ONBOARD_003`: Reusing accepted invitation token, expected `409`
- `TC_AIRLINE_ONBOARD_004`: Revoked invitation token, expected `401`
- `TC_AIRLINE_ONBOARD_005`: Expired invitation token, expected `401`
- `TC_AIRLINE_ONBOARD_006`: Conflict when airline code already exists, expected `409`
- `TC_AIRLINE_ONBOARD_007`: Conflict when admin email already exists, expected `409`
- `TC_AIRLINE_ONBOARD_008`: Validation errors for missing fields and weak password, expected `400`
- `TC_AIRLINE_ONBOARD_009`: Unknown field and malformed JSON, expected `400`
- `TC_AIRLINE_ONBOARD_010`: Conflict when company registration number already exists, expected `409`
- `TC_AIRLINE_ONBOARD_011`: Missing password field, expected `400`
- `TC_AIRLINE_ONBOARD_012`: Non-string invitationToken (numeric), expected `400`
- `TC_AIRLINE_ONBOARD_013`: Non-string password (boolean), expected `400`

Notes:
- `TC_AIRLINE_ONBOARD_010` covers the 4th uniqueness rule from the spec (CRN conflict) which was absent from the original test suite.

### airline-signin.e2e-spec.ts

- `TC_AIRLINE_SIGNIN_001`: Signin success with valid credentials, expected `200`
- `TC_AIRLINE_SIGNIN_002`: Invalid email/password/non-existing account, expected `401`
- `TC_AIRLINE_SIGNIN_003`: Inactive airline user signin, expected `401`
- `TC_AIRLINE_SIGNIN_004`: Validation for invalid format/missing fields/short password, expected `400`
- `TC_AIRLINE_SIGNIN_005`: RequiresPasswordReset challenge response, expected `200`
- `TC_AIRLINE_SIGNIN_006`: RequiresTwoFactor challenge response, expected `200`
- `TC_AIRLINE_SIGNIN_007`: Unknown fields and malformed JSON, expected `400`
- `TC_AIRLINE_SIGNIN_008`: Email case insensitivity (uppercase email), expected `200`
- `TC_AIRLINE_SIGNIN_009`: Successful response includes accessTokenExpiresIn and refreshTokenExpiresIn, expected `200`
- `TC_AIRLINE_SIGNIN_010`: Inactive airline (airline-level isActive=false) signin, expected `401`

Notes:
- `TC_AIRLINE_SIGNIN_003` seeds an inactive user directly via SQL. `TC_AIRLINE_SIGNIN_010` seeds an inactive airline entity — both paths should return `401`.

### airline-signin-2fa-verify.e2e-spec.ts

- `TC_AIRLINE_2FA_VERIFY_001`: Valid challenge token + valid TOTP, expected `200`
- `TC_AIRLINE_2FA_VERIFY_002`: Invalid or expired twoFactorToken, expected `401`
- `TC_AIRLINE_2FA_VERIFY_003`: Wrong twoFactorCode, expected `401`
- `TC_AIRLINE_2FA_VERIFY_004`: Non-2FA-enabled account attempt, expected `401`
- `TC_AIRLINE_2FA_VERIFY_005`: Validation missing fields/bad format, expected `400`
- `TC_AIRLINE_2FA_VERIFY_006`: Unknown field and malformed JSON, expected `400`
- `TC_AIRLINE_2FA_VERIFY_007`: twoFactorToken is single-use — reuse after successful verify, expected `401`
- `TC_AIRLINE_2FA_VERIFY_008`: Successful response includes accessToken and refreshToken, expected `200`

### airline-signin-reset-password.e2e-spec.ts

- `TC_AIRLINE_RESET_001`: Valid resetPasswordToken + strong password, expected `200`
- `TC_AIRLINE_RESET_002`: Invalid/expired reset token, expected `401`
- `TC_AIRLINE_RESET_003`: Weak newPassword, expected `400`
- `TC_AIRLINE_RESET_004`: Reuse of used reset token, expected `401`
- `TC_AIRLINE_RESET_005`: Unknown field and malformed JSON, expected `400`
- `TC_AIRLINE_RESET_006`: Missing resetPasswordToken field, expected `400`
- `TC_AIRLINE_RESET_007`: Missing newPassword field, expected `400`
- `TC_AIRLINE_RESET_008`: Non-string resetPasswordToken (numeric), expected `400`
- `TC_AIRLINE_RESET_009`: Non-string newPassword (boolean), expected `400`
- `TC_AIRLINE_RESET_010`: Successful reset response shape (accessToken/refreshToken when returned), expected `200`

### airline-2fa-setup-enable.e2e-spec.ts

- `TC_AIRLINE_2FA_SETUP_001`: Setup with valid bearer token, expected `200`
- `TC_AIRLINE_2FA_SETUP_002`: Setup without/invalid token, expected `401`
- `TC_AIRLINE_2FA_SETUP_003`: 2FA already enabled — repeat setup attempt, expected `409`
- `TC_AIRLINE_2FA_ENABLE_001`: Enable with valid TOTP after setup, expected `200`
- `TC_AIRLINE_2FA_ENABLE_002`: Wrong TOTP or no setup context, expected `401`
- `TC_AIRLINE_2FA_ENABLE_003`: Without/invalid bearer token, expected `401`
- `TC_AIRLINE_2FA_ENABLE_004`: Validation unknown fields/malformed JSON, expected `400`
- `TC_AIRLINE_2FA_ENABLE_005`: Missing twoFactorCode field, expected `400`
- `TC_AIRLINE_2FA_ENABLE_006`: Non-string twoFactorCode (numeric), expected `400`

Notes:
- `TC_AIRLINE_2FA_SETUP_003` covers the spec's business logic rule: "2FA must not already be enabled (409 Conflict)".

### airline-2fa-disable-recover.e2e-spec.ts

- `TC_AIRLINE_2FA_DISABLE_001`: Disable with valid bearer + valid TOTP, expected `200`
- `TC_AIRLINE_2FA_DISABLE_002`: Wrong TOTP or not-enabled state, expected `401`
- `TC_AIRLINE_2FA_DISABLE_003`: Without/invalid bearer token and malformed JSON, expected `401`/`400`
- `TC_AIRLINE_2FA_DISABLE_004`: Unknown field in disable payload, expected `400`
- `TC_AIRLINE_2FA_DISABLE_005`: Missing twoFactorCode field, expected `400`
- `TC_AIRLINE_2FA_RECOVER_001`: Valid email/password/recoveryCode disables 2FA, expected `200`
- `TC_AIRLINE_2FA_RECOVER_002`: Invalid credentials/recovery code/non-enabled, expected `401`
- `TC_AIRLINE_2FA_RECOVER_003`: Validation unknown fields/malformed JSON, expected `400`
- `TC_AIRLINE_2FA_RECOVER_004`: Recovery code is single-use — reuse after successful recovery, expected `401`
- `TC_AIRLINE_2FA_RECOVER_005`: Missing required fields (email or recoveryCode), expected `400`

Notes:
- `TC_AIRLINE_2FA_RECOVER_004` verifies the one-time-use property of recovery codes: a code used to recover access cannot be used again.

### airline-forgot-password.e2e-spec.ts

- `TC_AIRLINE_FORGOT_SEND_001`: send-otp for existing active account, expected `200`
- `TC_AIRLINE_FORGOT_SEND_002`: send-otp for unknown account remains generic, expected `200`
- `TC_AIRLINE_FORGOT_SEND_003`: send-otp validation and malformed JSON, expected `400`
- `TC_AIRLINE_FORGOT_SEND_004`: send-otp with unknown field, expected `400`
- `TC_AIRLINE_FORGOT_SEND_005`: send-otp missing email field, expected `400`
- `TC_AIRLINE_FORGOT_VERIFY_001`: verify-otp with valid static OTP, expected `200`
- `TC_AIRLINE_FORGOT_VERIFY_002`: invalid OTP/non-existing/no prior send, expected `401`
- `TC_AIRLINE_FORGOT_VERIFY_003`: verify-otp validation and malformed JSON, expected `400`
- `TC_AIRLINE_FORGOT_VERIFY_004`: verify-otp with unknown field, expected `400`
- `TC_AIRLINE_FORGOT_VERIFY_005`: verify-otp missing otp field, expected `400`
- `TC_AIRLINE_FORGOT_RESET_001`: valid reset token + strong password, expected `200`
- `TC_AIRLINE_FORGOT_RESET_002`: invalid/reused token and weak password, expected `401`/`400`
- `TC_AIRLINE_FORGOT_RESET_003`: unknown field and malformed JSON, expected `400`
- `TC_AIRLINE_FORGOT_RESET_004`: Missing required fields (token or password), expected `400`
- `TC_AIRLINE_FORGOT_RESET_005`: Type coercion — numeric resetPasswordToken, expected `400`

Notes:
- The reset endpoint is `POST /api/v1/auth/airline/forgot-password` (not `/forgot-password/reset`). Earlier tests that used `/reset` have been corrected to match the spec.
- OTP-related cases assume the non-production static OTP `444444` is configured in the test environment.

### airline-refresh-signout.e2e-spec.ts

- `TC_AIRLINE_REFRESH_001`: Valid refresh token rotation, expected `200`
- `TC_AIRLINE_REFRESH_002`: Invalid/expired/revoked refresh token, expected `401`
- `TC_AIRLINE_REFRESH_003`: Validation unknown fields/malformed JSON, expected `400`
- `TC_AIRLINE_REFRESH_004`: Refresh token invalidated after forgot-password reset, expected `401`
- `TC_AIRLINE_REFRESH_005`: Missing refreshToken field, expected `400`
- `TC_AIRLINE_SIGNOUT_001`: Valid bearer + valid refresh token, expected `200`
- `TC_AIRLINE_SIGNOUT_002`: Missing/invalid bearer token, expected `401`
- `TC_AIRLINE_SIGNOUT_003`: Token belongs to another user or revoked token, expected `401`
- `TC_AIRLINE_SIGNOUT_004`: Validation unknown fields/malformed JSON, expected `400`
- `TC_AIRLINE_SIGNOUT_005`: Using own accessToken as body refreshToken field, expected `401`
- `TC_AIRLINE_SIGNOUT_006`: Tampered refreshToken signature in body, expected `401`

Notes:
- `TC_AIRLINE_REFRESH_004` runs a full forgot-password flow (send-otp → verify-otp → reset) and then asserts that the refresh token obtained before the reset is rejected.
- `TC_AIRLINE_SIGNOUT_005` passes the access token in the body's `refreshToken` field — the service must reject it because it is not a refresh token.
- `TC_AIRLINE_SIGNOUT_006` corrupts the JWT signature segment; the server must reject the tampered token.

## Notes

- Tests use seeded invitation and auth data with e2e-specific email/code patterns (`%@e2e-airline-auth.test`, `E2E%`).
- Cleanup runs in `afterAll` and removes seeded records from invitation and auth tables.
- OTP-related cases assume non-production static OTP behavior configured in test environment (`444444`).
