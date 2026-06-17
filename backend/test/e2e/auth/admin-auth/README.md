# Admin Auth E2E Test Cases

This document lists all Admin Auth API e2e test cases in this folder for
quick review. TC IDs in this file and the `it()` comment above each test
case in the corresponding spec file are kept in sync.

---

## Admin Signup API

- Spec file: `admin-signup.e2e-spec.ts`
- Endpoint: `POST /api/v1/auth/admin/signup`

Test cases:

- `TC_AUTH_ADMIN_SIGNUP_001`: Admin signup success, expected `201`
- `TC_AUTH_ADMIN_SIGNUP_002`: Duplicate admin email, expected `409`
- `TC_AUTH_ADMIN_SIGNUP_003`: Invalid email format, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_004`: Password shorter than 8 characters, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_005`: Password without uppercase letter, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_006`: Password without lowercase letter, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_007`: Password without numeric character, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_008`: Password without special character, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_009`: Missing firstName field, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_010`: Missing lastName field, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_011`: Missing email field, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_012`: Missing password field, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_013`: firstName shorter than minimum length, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_014`: lastName shorter than minimum length, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_015`: firstName exceeds maximum length, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_016`: lastName exceeds maximum length, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_017`: Email automatically normalized to lowercase, expected `201`
- `TC_AUTH_ADMIN_SIGNUP_018`: Signup with leading/trailing spaces in email, expected `201`
- `TC_AUTH_ADMIN_SIGNUP_019`: Signup with empty firstName string, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_020`: Signup with empty lastName string, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_021`: Signup with empty email string, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_022`: Signup with empty password string, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_023`: Signup with null firstName, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_024`: Signup with null lastName, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_025`: Signup with null email, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_026`: Signup with null password, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_027`: Signup with numeric firstName, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_028`: Signup with numeric lastName, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_029`: Signup with special characters only in firstName, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_030`: Signup with special characters only in lastName, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_031`: Signup with multiple validation errors, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_032`: Signup with already existing email in different letter case, expected `409`
- `TC_AUTH_ADMIN_SIGNUP_033`: Signup with valid boundary firstName length (2 chars), expected `201`
- `TC_AUTH_ADMIN_SIGNUP_034`: Signup with valid boundary lastName length (2 chars), expected `201`
- `TC_AUTH_ADMIN_SIGNUP_035`: Signup with valid boundary password length (8 chars), expected `201`
- `TC_AUTH_ADMIN_SIGNUP_036`: Signup with valid maximum firstName length (100 chars), expected `201`
- `TC_AUTH_ADMIN_SIGNUP_037`: Signup with valid maximum lastName length (100 chars), expected `201`
- `TC_AUTH_ADMIN_SIGNUP_038`: Signup request with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_039`: Signup with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_040`: Signup with SQL injection attempt in email field, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_041`: Signup with script injection attempt in firstName, expected `400`
- `TC_AUTH_ADMIN_SIGNUP_042`: Signup with Unicode characters in firstName and lastName, expected `201`

Notes:

- TC_001 through TC_042 clean up by email pattern `%@e2e.test` in `afterAll`.
- TC_017 verifies that `data.email` in the response is lowercased regardless of input case.
- TC_032 requires a pre-seeded admin created via signup in `beforeAll`; uses the same email in uppercase to trigger the 409.
- TC_039 (malformed JSON) sends a raw string with `Content-Type: application/json`; NestJS body parser returns 400.
- TC_040 (SQL injection) is rejected by `@IsEmail()` DTO validation before reaching the DB layer.
- TC_041 (script injection) is rejected by the `@Matches(/^[\p{L}][\p{L}\p{M}\s'-]*$/u)` regex on `firstName`.

---

## Admin Signin API

- Spec file: `admin-signin.e2e-spec.ts`
- Endpoint: `POST /api/v1/auth/admin/signin`

Test cases:

- `TC_AUTH_ADMIN_SIGNIN_001`: Super Admin signin success with valid credentials, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_002`: Staff Admin signin success with valid credentials, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_003`: Signin with invalid email, expected `401`
- `TC_AUTH_ADMIN_SIGNIN_004`: Signin with invalid password, expected `401`
- `TC_AUTH_ADMIN_SIGNIN_005`: Signin with non-existing email, expected `401`
- `TC_AUTH_ADMIN_SIGNIN_006`: Signin with invalid email format, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_007`: Password shorter than 8 characters, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_008`: Missing email field, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_009`: Missing password field, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_010`: Empty email string, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_011`: Empty password string, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_012`: Null email value, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_013`: Null password value, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_014`: Signin with uppercase email should normalize and succeed, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_015`: Signin with leading and trailing spaces in email, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_016`: Inactive admin signin attempt, expected `401`
- `TC_AUTH_ADMIN_SIGNIN_017`: Inactive staff admin signin attempt, expected `401`
- `TC_AUTH_ADMIN_SIGNIN_018`: Deleted admin signin attempt, expected `401`
- `TC_AUTH_ADMIN_SIGNIN_019`: Multiple failed signin attempts handling, expected `401`
- `TC_AUTH_ADMIN_SIGNIN_020`: Successful SUPER_ADMIN signin returns complete response with tokens and profile data, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_021`: Successful STAFF signin returns complete response with tokens and profile data, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_029`: Signin requiring two-factor authentication challenge, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_030`: Two-factor signin response contains requiresTwoFactor=true, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_031`: Two-factor signin response contains twoFactorToken, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_032`: Two-factor signin response contains twoFactorTokenExpiresIn, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_033`: Signin requiring initial password reset challenge, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_034`: Password reset challenge response contains requiresPasswordReset=true, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_035`: Password reset challenge response contains resetPasswordToken, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_036`: Password reset challenge response contains resetPasswordTokenExpiresIn, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_037`: Signin request with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_038`: Signin request with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_039`: SQL injection attempt in email field, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_040`: Script injection attempt in password field, expected `401`
- `TC_AUTH_ADMIN_SIGNIN_041`: Signin response contains correct admin email, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_042`: Signin response contains correct admin role, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_043`: Signin response tokens should not be empty, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_044`: Signin response should not expose password field, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_045`: Concurrent signin requests with same credentials, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_046`: Signin with Unicode characters in email field, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_047`: Signin with whitespace-only password, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_048`: Signin with whitespace-only email, expected `400`

Notes:

- `TC_AUTH_ADMIN_SIGNIN_018` requires a DELETE from `admins` via raw SQL (seeder). The API does not expose a delete endpoint.
- `TC_AUTH_ADMIN_SIGNIN_026`, `TC_AUTH_ADMIN_SIGNIN_027`, and `TC_AUTH_ADMIN_SIGNIN_028` are omitted — they reference legacy platform role labels not present in the current `AdminRole` enum (SUPER_ADMIN | STAFF).
- `TC_AUTH_ADMIN_SIGNIN_040` (script injection in password) returns `401` rather than `400` because the password field has no regex constraint at DTO level — validation passes but credentials are wrong.

---

## Admin 2FA Setup / Enable / Disable API

- Spec file: `admin-two-factor.e2e-spec.ts`
- Endpoints:
  - `POST /api/v1/auth/admin/2fa/setup`
  - `POST /api/v1/auth/admin/2fa/enable`
  - `POST /api/v1/auth/admin/2fa/disable`
  - `POST /api/v1/auth/admin/signin/2fa/verify`

Test cases:

- `TC_AUTH_ADMIN_2FA_SETUP_001`: 2FA setup success returns manualEntryKey and qrCodeDataUrl, expected `200`
- `TC_AUTH_ADMIN_2FA_SETUP_002`: 2FA setup without access token, expected `401`
- `TC_AUTH_ADMIN_2FA_SETUP_003`: 2FA setup with invalid access token, expected `401`
- `TC_AUTH_ADMIN_2FA_SETUP_004`: 2FA setup when 2FA already enabled, expected `409`
- `TC_AUTH_ADMIN_2FA_SETUP_005`: 2FA setup response contains non-empty manualEntryKey, expected `200`
- `TC_AUTH_ADMIN_2FA_SETUP_006`: 2FA setup response contains non-empty qrCodeDataUrl, expected `200`
- `TC_AUTH_ADMIN_2FA_SETUP_007`: 2FA setup with airline access token (wrong userType), expected `403`

- `TC_AUTH_ADMIN_2FA_ENABLE_001`: 2FA enable with valid TOTP code succeeds, expected `200`
- `TC_AUTH_ADMIN_2FA_ENABLE_002`: 2FA enable response contains recoveryCodes array, expected `200`
- `TC_AUTH_ADMIN_2FA_ENABLE_003`: 2FA enable response recoveryCodes array is non-empty, expected `200`
- `TC_AUTH_ADMIN_2FA_ENABLE_004`: 2FA enable with invalid TOTP code, expected `401`
- `TC_AUTH_ADMIN_2FA_ENABLE_005`: 2FA enable without twoFactorCode field, expected `400`
- `TC_AUTH_ADMIN_2FA_ENABLE_006`: 2FA enable with empty twoFactorCode, expected `400`
- `TC_AUTH_ADMIN_2FA_ENABLE_007`: 2FA enable with 5-digit code (too short), expected `400`
- `TC_AUTH_ADMIN_2FA_ENABLE_008`: 2FA enable with 7-digit code (too long), expected `400`
- `TC_AUTH_ADMIN_2FA_ENABLE_009`: 2FA enable with non-numeric code, expected `400`
- `TC_AUTH_ADMIN_2FA_ENABLE_010`: 2FA enable without access token, expected `401`
- `TC_AUTH_ADMIN_2FA_ENABLE_011`: 2FA enable when setup has not been called first, expected `400`
- `TC_AUTH_ADMIN_2FA_ENABLE_012`: 2FA enable with unknown fields in request body, expected `400`

- `TC_AUTH_ADMIN_2FA_DISABLE_001`: 2FA disable with valid TOTP code succeeds, expected `200`
- `TC_AUTH_ADMIN_2FA_DISABLE_002`: 2FA disable response data is null, expected `200`
- `TC_AUTH_ADMIN_2FA_DISABLE_003`: 2FA disable with invalid TOTP code, expected `401`
- `TC_AUTH_ADMIN_2FA_DISABLE_004`: 2FA disable when 2FA is not enabled, expected `400`
- `TC_AUTH_ADMIN_2FA_DISABLE_005`: 2FA disable without twoFactorCode field, expected `400`
- `TC_AUTH_ADMIN_2FA_DISABLE_006`: 2FA disable with empty twoFactorCode, expected `400`
- `TC_AUTH_ADMIN_2FA_DISABLE_007`: 2FA disable with non-numeric code, expected `400`
- `TC_AUTH_ADMIN_2FA_DISABLE_008`: 2FA disable without access token, expected `401`
- `TC_AUTH_ADMIN_2FA_DISABLE_009`: 2FA disable with unknown fields in request body, expected `400`

- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_001`: Signin 2FA verify with valid token and TOTP code, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_002`: Signin 2FA verify response contains accessToken and refreshToken, expected `200`
- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_003`: Signin 2FA verify with invalid twoFactorToken, expected `401`
- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_004`: Signin 2FA verify with invalid TOTP code, expected `401`
- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_005`: Signin 2FA verify with missing twoFactorToken field, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_006`: Signin 2FA verify with missing twoFactorCode field, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_007`: Signin 2FA verify with non-numeric twoFactorCode, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_008`: Signin 2FA verify with 5-digit twoFactorCode, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_009`: Signin 2FA verify with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_010`: Signin 2FA verify with unknown fields in request body, expected `400`
- `TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_011`: Signin 2FA verify response should not expose password field, expected `200`

Notes:

- TOTP codes are generated with `speakeasy.totp({ secret: manualEntryKey, encoding: 'base32' })`. The backend accepts ±1 window (`TWO_FACTOR_OTP_WINDOW=1`), giving a 90-second grace period.
- `TC_AUTH_ADMIN_2FA_SETUP_007` is a compatibility placeholder; in the current test environment there is no airline JWT issuer to mint an airline access token, so this test may be skipped.
- `TC_AUTH_ADMIN_2FA_ENABLE_011` requires an admin that has NOT called setup. This is tested using a fresh admin with no 2FA temp secret.

---

## Admin 2FA Recover API

- Spec file: `admin-two-factor-recover.e2e-spec.ts`
- Endpoint: `POST /api/v1/auth/admin/2fa/recover`

Test cases:

- `TC_AUTH_ADMIN_2FA_RECOVER_001`: 2FA recovery with valid email, password, and recovery code, expected `200`
- `TC_AUTH_ADMIN_2FA_RECOVER_002`: 2FA recovery response data is null, expected `200`
- `TC_AUTH_ADMIN_2FA_RECOVER_003`: 2FA recovery response success is true, expected `200`
- `TC_AUTH_ADMIN_2FA_RECOVER_004`: 2FA recovery disables 2FA for the admin, expected `200`
- `TC_AUTH_ADMIN_2FA_RECOVER_005`: 2FA recovery with invalid password, expected `401`
- `TC_AUTH_ADMIN_2FA_RECOVER_006`: 2FA recovery with non-existing email, expected `401`
- `TC_AUTH_ADMIN_2FA_RECOVER_007`: 2FA recovery with invalid recovery code, expected `401`
- `TC_AUTH_ADMIN_2FA_RECOVER_008`: 2FA recovery with already-used recovery code, expected `401`
- `TC_AUTH_ADMIN_2FA_RECOVER_009`: 2FA recovery with missing email field, expected `400`
- `TC_AUTH_ADMIN_2FA_RECOVER_010`: 2FA recovery with missing password field, expected `400`
- `TC_AUTH_ADMIN_2FA_RECOVER_011`: 2FA recovery with missing recoveryCode field, expected `400`
- `TC_AUTH_ADMIN_2FA_RECOVER_012`: 2FA recovery with empty email, expected `400`
- `TC_AUTH_ADMIN_2FA_RECOVER_013`: 2FA recovery with empty password, expected `400`
- `TC_AUTH_ADMIN_2FA_RECOVER_014`: 2FA recovery with empty recoveryCode, expected `400`
- `TC_AUTH_ADMIN_2FA_RECOVER_015`: 2FA recovery with invalid email format, expected `400`
- `TC_AUTH_ADMIN_2FA_RECOVER_016`: 2FA recovery with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_2FA_RECOVER_017`: 2FA recovery with unknown fields in request body, expected `400`
- `TC_AUTH_ADMIN_2FA_RECOVER_018`: After recovery, signing in no longer triggers 2FA challenge, expected `200`

Notes:

- The admin under test has 2FA enabled via the full API flow (signup → signin → 2fa/setup → 2fa/enable). Recovery codes come from the 2fa/enable response.
- `TC_AUTH_ADMIN_2FA_RECOVER_008` (reuse of a spent recovery code) is tested by calling recover twice with the same code; the second call must return `401`.
- `TC_AUTH_ADMIN_2FA_RECOVER_004` verifies that the subsequent signin after recovery returns tokens directly (not a 2FA challenge).

---

## Admin Forgot Password API

- Spec file: `forgot-password.e2e-spec.ts`
- Endpoints:
  - `POST /api/v1/auth/admin/forgot-password/send-otp`
  - `POST /api/v1/auth/admin/forgot-password/verify-otp`
  - `POST /api/v1/auth/admin/forgot-password`

Test cases:

- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_001`: Send OTP with valid registered email, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_002`: Send OTP with non-existing email should return generic success response, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_003`: Send OTP with invalid email format, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_004`: Send OTP with missing email field, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_005`: Send OTP with empty email value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_006`: Send OTP with null email value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_007`: Send OTP with whitespace-only email, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_008`: Send OTP with uppercase email normalization, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_009`: Send OTP with leading/trailing spaces in email, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_010`: Send OTP request exceeding maximum 3 requests within 10 minutes, expected `429`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_011`: Send OTP request after rate limit window expires, expected `200` (skipped — requires time manipulation)
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_012`: Send OTP for inactive admin account, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_013`: Send OTP for deleted admin account, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_014`: Send OTP request with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_015`: Send OTP request with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_016`: Send OTP response should not expose account existence, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_017`: Send OTP in local/dev/test environment uses static OTP 444444, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_019`: Send OTP request with SQL injection attempt in email field, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_020`: Send OTP request with Unicode email characters, expected `400`

- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_001`: Verify OTP with valid email and OTP, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_002`: Verify OTP with invalid OTP, expected `401`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_003`: Verify OTP with expired OTP, expected `401`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_004`: Verify OTP with non-existing email, expected `401`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_005`: Verify OTP with invalid email format, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_006`: Verify OTP with OTP shorter than 6 digits, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_007`: Verify OTP with OTP longer than 6 digits, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_008`: Verify OTP with non-numeric OTP, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_009`: Verify OTP with missing email field, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_010`: Verify OTP with missing otp field, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_011`: Verify OTP with empty email value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_012`: Verify OTP with empty otp value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_013`: Verify OTP with null email value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_014`: Verify OTP with null otp value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_015`: Verify OTP after maximum 5 failed attempts, expected `403`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_016`: Verify OTP after OTP invalidation due to failed attempts, expected `403`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_017`: Verify OTP response contains resetPasswordToken, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_018`: Verify OTP response contains resetPasswordTokenExpiresIn, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_019`: Verify OTP response token should not be empty, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_020`: Verify OTP request with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_021`: Verify OTP request with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_022`: Verify OTP with leading/trailing spaces in OTP value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_023`: Verify OTP with static OTP 444444 in local/dev/test environment, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_024`: Verify OTP with SQL injection attempt in OTP field, expected `400`

- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_001`: Reset password with valid resetPasswordToken and valid newPassword, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_002`: Reset password with invalid resetPasswordToken, expected `401`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_003`: Reset password with expired resetPasswordToken, expected `401` (skipped in external mode — requires time manipulation)
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_004`: Reset password with missing resetPasswordToken field, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_005`: Reset password with missing newPassword field, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_006`: Reset password with empty resetPasswordToken value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_007`: Reset password with empty newPassword value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_008`: Reset password with null resetPasswordToken value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_009`: Reset password with null newPassword value, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_010`: Reset password with password shorter than 8 characters, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_011`: Reset password without uppercase character, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_012`: Reset password without lowercase character, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_013`: Reset password without numeric character, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_014`: Reset password without special character, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_015`: Reset password with previously used password, expected `400` (compatibility — not enforced, test documents behavior)
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_016`: Reset password success should allow signin with new password, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_017`: Reset password success should reject old password signin, expected `401`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_018`: Reset password token reuse attempt after successful reset, expected `401`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_019`: Reset password request with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_020`: Reset password request with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_021`: Reset password with whitespace-only password, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_022`: Reset password with SQL injection attempt in token field, expected `401`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_023`: Reset password response should not expose sensitive information, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_024`: Reset password should invalidate existing active sessions, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_025`: Reset password with Unicode password characters, expected `200`

Notes:

- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_010` documents a known behavior gap: the service currently returns generic `200` instead of `429` when the OTP send limit is reached. The test is marked with `todo` until the behavior is corrected.
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_011` is skipped in external mode — time window manipulation is not possible without in-process access.
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_013` passes because the endpoint always returns `200` regardless of whether the email exists.
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_015`/`016` drive the max-attempts scenario by making 5 consecutive invalid OTP calls; the 5th call changes the status to `403 Forbidden` (maximum attempts exceeded).
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_003` is skipped in external mode (expiry requires time manipulation).
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_015` documents a compatibility behavior: password history validation is not currently enforced.

---

## Admin Refresh Token API

- Spec file: `refresh-token.e2e-spec.ts`
- Endpoint: `POST /api/v1/auth/admin/refresh`

Test cases:

- `TC_AUTH_ADMIN_REFRESH_TOKEN_001`: Refresh token success with valid refresh token, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_002`: Refresh token with invalid token, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_003`: Refresh token with expired token, expected `401` (skipped in external mode)
- `TC_AUTH_ADMIN_REFRESH_TOKEN_004`: Refresh token with malformed JWT token, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_005`: Refresh token with tampered signature, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_006`: Refresh token with missing refreshToken field, expected `400`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_007`: Refresh token with empty refreshToken value, expected `400`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_008`: Refresh token with null refreshToken value, expected `400`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_009`: Refresh token with whitespace-only refreshToken value, expected `400`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_010`: Refresh token request with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_011`: Refresh token request with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_012`: Refresh token using access token instead of refresh token, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_013`: Refresh token for inactive admin account, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_016`: Refresh token after logout/session revocation, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_017`: Refresh token response contains new accessToken, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_018`: Refresh token response contains new refreshToken, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_019`: Refresh token response contains accessTokenExpiresIn, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_020`: Refresh token response contains refreshTokenExpiresIn, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_021`: Refresh token response contains admin profile data, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_022`: Refresh token response contains admin access controls, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_023`: Refresh token response should rotate refresh token, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_024`: Previous refresh token becomes invalid after rotation, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_025`: Refresh token response tokens should not be empty, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_026`: Refresh token response should not expose password field, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_028`: Replay attack attempt using already used refresh token, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_029`: Refresh token signed with different secret, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_034`: Refresh token request with SQL injection attempt in token field, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_035`: Refresh token request with script injection attempt in token field, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_036`: Refresh token response contains correct admin email, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_037`: Refresh token response contains correct admin role, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_039`: Refresh token with extremely long token string, expected `401`

Notes:

- `TC_AUTH_ADMIN_REFRESH_TOKEN_003` is skipped in external mode — expiry requires time manipulation.
- `TC_AUTH_ADMIN_REFRESH_TOKEN_013` seeds an inactive admin via raw SQL, then signs in (which should fail) or pre-mints a token. In external mode, this test signs in as an active admin, then deactivates via raw SQL UPDATE, then attempts refresh. The UPDATE is done via the `query()` helper.
- Rotation/replay strictness (`TC_AUTH_ADMIN_REFRESH_TOKEN_023`, `_024`, `_028`) is compatibility-aware if the live backend does not enforce one-time refresh semantics.

---

## Admin Signout API

- Spec file: `signout.e2e-spec.ts`
- Endpoint: `POST /api/v1/auth/admin/signout`

Test cases:

- `TC_AUTH_ADMIN_SIGNOUT_001`: Signout success with valid refresh token and authenticated PLATFORM admin, expected `200`
- `TC_AUTH_ADMIN_SIGNOUT_002`: Signout with missing refreshToken field, expected `400`
- `TC_AUTH_ADMIN_SIGNOUT_003`: Signout with empty refreshToken value, expected `400`
- `TC_AUTH_ADMIN_SIGNOUT_004`: Signout with null refreshToken value, expected `400`
- `TC_AUTH_ADMIN_SIGNOUT_005`: Signout with whitespace-only refreshToken, expected `400`
- `TC_AUTH_ADMIN_SIGNOUT_006`: Signout with invalid refresh token, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_007`: Signout with expired refresh token, expected `401` (skipped in external mode)
- `TC_AUTH_ADMIN_SIGNOUT_008`: Signout with malformed JWT refresh token, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_009`: Signout with tampered refresh token signature, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_010`: Signout using access token instead of refresh token, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_011`: Signout without authentication context (no Authorization header), expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_015`: Signout already revoked refresh token, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_016`: Double signout using same refresh token — second attempt, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_017`: Signout request with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_SIGNOUT_018`: Signout request with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_SIGNOUT_019`: Signout with SQL injection attempt in refreshToken field, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_020`: Signout with script injection attempt in refreshToken field, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_021`: Signout response should always return success=true on valid request, expected `200`
- `TC_AUTH_ADMIN_SIGNOUT_022`: Signout response data should be null, expected `200`
- `TC_AUTH_ADMIN_SIGNOUT_023`: Signout should invalidate refresh token immediately after success, expected `200`
- `TC_AUTH_ADMIN_SIGNOUT_024`: After signout, refresh token cannot be used in refresh API, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_025`: Signout does not affect access token validity until expiry, expected `200` (note: access token is not validated here — this tests that signout itself succeeds with a valid token)
- `TC_AUTH_ADMIN_SIGNOUT_028`: Signout request with extremely long token string, expected `401`

Notes:

- `TC_AUTH_ADMIN_SIGNOUT_007` is skipped in external mode (token expiry requires time manipulation).
- `TC_AUTH_ADMIN_SIGNOUT_011` returns `401` because an unauthenticated request is rejected by the JWT guard before user-type authorization fires.
- `TC_AUTH_ADMIN_SIGNOUT_012` and `TC_AUTH_ADMIN_SIGNOUT_013` are omitted — those legacy platform roles are not present in the current `AdminRole` enum.
- `TC_AUTH_ADMIN_SIGNOUT_014` is omitted — current endpoint enforces `PLATFORM` user type broadly, not SUPER_ADMIN-only restriction.
- `TC_AUTH_ADMIN_SIGNOUT_026` is omitted due to non-deterministic timing on concurrent requests.
- `TC_AUTH_ADMIN_SIGNOUT_030` is skipped in external mode (in-process DB inspection unavailable).

---

## Admin Initial Password Reset API

- Spec file: `admin-initial-password-reset.e2e-spec.ts`
- Endpoint: `POST /api/v1/auth/admin/signin/reset-password`

Test cases:

- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_001`: Initial password reset success with valid resetPasswordToken and valid newPassword, expected `200`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_002`: Initial password reset with invalid resetPasswordToken, expected `401`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_003`: Initial password reset with expired resetPasswordToken, expected `401` (skipped in external mode)
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_004`: Initial password reset with malformed resetPasswordToken, expected `401`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_005`: Initial password reset with already used resetPasswordToken, expected `401`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_006`: Initial password reset with empty resetPasswordToken, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_007`: Initial password reset with null resetPasswordToken, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_008`: Initial password reset with missing resetPasswordToken field, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_009`: Initial password reset with empty newPassword value, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_010`: Initial password reset with null newPassword value, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_011`: Initial password reset with missing newPassword field, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_012`: Initial password reset with password less than 8 characters, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_013`: Initial password reset with password missing uppercase character, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_014`: Initial password reset with password missing lowercase character, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_015`: Initial password reset with password missing numeric character, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_016`: Initial password reset with password missing special character, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_017`: Initial password reset with whitespace-only password, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_018`: Initial password reset with password containing leading whitespace, expected `400` (compatibility — DTO may not strip whitespace)
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_019`: Initial password reset with password containing trailing whitespace, expected `400` (compatibility)
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_020`: Initial password reset with same password as current password, expected `400` (compatibility — not currently enforced)
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_021`: Initial password reset with very long password, expected `400` (compatibility — no max length enforced)
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_022`: Initial password reset with Unicode password characters, expected `200`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_023`: Initial password reset with SQL injection in newPassword, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_024`: Initial password reset with script injection in newPassword, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_025`: Initial password reset with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_026`: Initial password reset with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_027`: Initial password reset response contains success=true, expected `200`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_028`: Initial password reset response contains correct success message, expected `200`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_029`: Initial password reset response contains null data object, expected `200`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_030`: Initial password reset allows subsequent signin with newly reset password, expected `200`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_031`: Initial password reset rejects signin using old password after successful reset, expected `401`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_032`: Initial password reset token from forgot-password flow should fail, expected `401`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_034`: Initial password reset with random string token, expected `401`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_035`: Initial password reset with numeric token value, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_036`: Initial password reset with boolean token value, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_039`: Initial password reset with numeric password value, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_040`: Initial password reset with boolean password value, expected `400`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_043`: Initial password reset token replay attack after successful reset, expected `401`
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_045`: Initial password reset with concurrent requests using same token, expected `200` for first (race condition — may be skipped in CI)

Notes:

- Admin under test is seeded via `insertAdminWithPasswordResetRequired()` using raw SQL.
- The `resetPasswordToken` is obtained by signing in as that admin; the 200 response will contain `requiresPasswordReset: true` and `resetPasswordToken`.
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_018` and `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_019`: compatibility — leading/trailing whitespace in `newPassword` may pass DTO validation since `@Matches()` does not strip whitespace. These are documented behavior gaps.
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_020` and `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_021`: compatibility — no same-password or max-length enforcement at DTO level.
- `TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_032` uses a token obtained from the forgot-password flow to confirm that initial-reset and forgot-password tokens are not interchangeable.
