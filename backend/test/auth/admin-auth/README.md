# Admin Auth E2E Test Cases

This document lists all Admin Auth API e2e test cases in this folder for quick review.

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
- `TC_AUTH_ADMIN_SIGNIN_020`: Successful STAFF_ADMIN signin returns complete response with tokens and profile data, expected `200`

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

- `TC_AUTH_ADMIN_SIGNIN_018` may be skipped in external mode because it requires in-process DB mutation (hard delete).
- `TC_AUTH_ADMIN_SIGNIN_026`, `TC_AUTH_ADMIN_SIGNIN_027`, and `TC_AUTH_ADMIN_SIGNIN_028` are commented out pending implementation of legacy platform role labels.

## Admin Airline Invitation API

- Spec file: `airline-invitations.e2e-spec.ts`
- Endpoint: `POST /api/v1/auth/admin/airline-invitations`

Test cases:

- `TC_AUTH_ADMIN_AIRLINE_INVITE_001`: Airline admin invitation success with valid payload, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_002`: Invitation without access token, expected `401`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_003`: Invitation with invalid access token, expected `401`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_004`: Invitation with expired access token, expected `401`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_005`: Invitation by unauthorized role user, expected `403`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_006`: Invitation by SUPPORT_AGENT role, expected `403`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_007`: Invitation by OPERATIONS_MANAGER role, expected `403`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_008`: Duplicate airline code, expected `409`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_009`: Duplicate admin email, expected `409`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_010`: Active invitation already exists for admin email, expected `409`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_011`: Missing airlineName field, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_012`: Missing airlineCode field, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_013`: Missing countryCode field, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_014`: Missing adminFirstName field, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_015`: Missing adminLastName field, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_016`: Missing adminEmail field, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_017`: Invalid adminEmail format, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_018`: Invalid contactEmail format, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_019`: Invalid contactPhone format, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_020`: Empty airlineName value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_021`: Empty airlineCode value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_022`: Empty countryCode value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_023`: Empty adminFirstName value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_024`: Empty adminLastName value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_025`: Empty adminEmail value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_026`: Null airlineName value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_027`: Null airlineCode value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_028`: Null countryCode value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_029`: Null adminFirstName value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_030`: Null adminLastName value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_031`: Null adminEmail value, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_032`: Invalid countryCode format, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_033`: Lowercase countryCode normalization handling, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_034`: Lowercase airlineCode normalization handling, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_035`: Airline code exceeding allowed length, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_036`: Airline name exceeding allowed length, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_037`: Admin first name exceeding allowed length, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_038`: Admin last name exceeding allowed length, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_039`: Invitation response contains invitationId, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_040`: Invitation response contains airlineId, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_041`: Invitation response contains onboardingLink, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_042`: Invitation response contains expiresIn, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_043`: Invitation response contains invited admin email, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_044`: Invitation onboardingLink contains valid token parameter, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_045`: Invitation request with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_046`: Invitation request with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_047`: SQL injection attempt in airlineCode field, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_048`: Script injection attempt in airlineName field, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_049`: Invitation with Unicode airline name, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_050`: Re-invite after previous invite expiration, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_051`: Invitation with valid optional contactEmail omitted, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_052`: Invitation with valid optional contactPhone omitted, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_053`: Invitation with whitespace-only required fields, expected `400`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_054`: Invitation with mixed-case admin email normalization, expected `201`
- `TC_AUTH_ADMIN_AIRLINE_INVITE_055`: Invitation with already existing airline contact email, expected `201`

Notes:

- `TC_AUTH_ADMIN_AIRLINE_INVITE_006` and `TC_AUTH_ADMIN_AIRLINE_INVITE_007` are compatibility placeholders because those legacy platform roles are not present in the current role model.
- `TC_AUTH_ADMIN_AIRLINE_INVITE_050` may be skipped in external mode because invite expiry mutation requires in-process DB access.

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
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_011`: Send OTP request after rate limit window expires, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_012`: Send OTP for inactive admin account, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_013`: Send OTP for deleted admin account, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_014`: Send OTP request with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_015`: Send OTP request with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_016`: Send OTP response should not expose account existence, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_017`: Send OTP in local/dev/test environment uses static OTP 444444, expected `200`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_018`: Send OTP in production environment generates random 6-digit OTP, expected `200`
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
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_015`: Verify OTP after maximum 5 failed attempts, expected `401`
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_016`: Verify OTP after OTP invalidation due to failed attempts, expected `401`
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
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_003`: Reset password with expired resetPasswordToken, expected `401`
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
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_015`: Reset password with previously used password, expected `400`
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

- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_010` currently documents a behavior gap: service returns generic `200` instead of `429` when OTP send limit is reached.
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_020` currently documents a compatibility behavior where Unicode email input can return generic `200` instead of strict `400`.
- `TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_013` and `TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_015` are compatibility placeholders because deleted-admin state and password-history validation are not implemented.
- DB-mutation scenarios (for expiry/window checks) may be skipped in external mode where in-process repository access is unavailable.

## Admin Refresh Token API

- Spec file: `refresh-token.e2e-spec.ts`
- Endpoint: `POST /api/v1/auth/admin/refresh`

Test cases:

- `TC_AUTH_ADMIN_REFRESH_TOKEN_001`: Refresh token success with valid refresh token, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_002`: Refresh token with invalid token, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_003`: Refresh token with expired token, expected `401`
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
- `TC_AUTH_ADMIN_REFRESH_TOKEN_014`: Refresh token for deleted admin account, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_015`: Refresh token after admin password reset, expected `401`
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
- `TC_AUTH_ADMIN_REFRESH_TOKEN_027`: Concurrent refresh requests using same refresh token, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_028`: Replay attack attempt using already used refresh token, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_029`: Refresh token signed with different secret, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_030`: Refresh token with unsupported algorithm, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_031`: Refresh token with invalid issuer claim, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_032`: Refresh token with invalid audience claim, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_033`: Refresh token generated for another user type, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_034`: Refresh token request with SQL injection attempt in token field, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_035`: Refresh token request with script injection attempt in token field, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_036`: Refresh token response contains correct admin email, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_037`: Refresh token response contains correct admin role, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_038`: Refresh token response maintains admin access permissions, expected `200`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_039`: Refresh token with extremely long token string, expected `401`
- `TC_AUTH_ADMIN_REFRESH_TOKEN_040`: Refresh token with Unicode characters in token value, expected `401`

Notes:

- In external mode, DB-mutation tests (inactive/deleted account checks) may be skipped because in-process repository access is unavailable.
- Rotation/replay strictness (`TC_AUTH_ADMIN_REFRESH_TOKEN_023`, `TC_AUTH_ADMIN_REFRESH_TOKEN_024`, `TC_AUTH_ADMIN_REFRESH_TOKEN_028`) is compatibility-aware if the live backend does not enforce one-time refresh semantics.

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
- `TC_AUTH_ADMIN_SIGNOUT_007`: Signout with expired refresh token, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_008`: Signout with malformed JWT refresh token, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_009`: Signout with tampered refresh token signature, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_010`: Signout using access token instead of refresh token, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_011`: Signout without authentication context (no PLATFORM userType), expected `403`
- `TC_AUTH_ADMIN_SIGNOUT_012`: Signout with SUPPORT_AGENT role admin, expected `403`
- `TC_AUTH_ADMIN_SIGNOUT_013`: Signout with OPERATIONS_MANAGER role admin, expected `403`
- `TC_AUTH_ADMIN_SIGNOUT_014`: Signout with SUPER_ADMIN role if restricted to PLATFORM only, expected `403`
- `TC_AUTH_ADMIN_SIGNOUT_015`: Signout already revoked refresh token, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_016`: Double signout using same refresh token, expected `401` on second attempt
- `TC_AUTH_ADMIN_SIGNOUT_017`: Signout request with malformed JSON payload, expected `400`
- `TC_AUTH_ADMIN_SIGNOUT_018`: Signout request with additional unknown fields, expected `400`
- `TC_AUTH_ADMIN_SIGNOUT_019`: Signout with SQL injection attempt in refreshToken field, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_020`: Signout with script injection attempt in refreshToken field, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_021`: Signout response should always return success=true on valid request, expected `200`
- `TC_AUTH_ADMIN_SIGNOUT_022`: Signout response data should be null, expected `200`
- `TC_AUTH_ADMIN_SIGNOUT_023`: Signout should invalidate refresh token immediately after success, expected `200`
- `TC_AUTH_ADMIN_SIGNOUT_024`: After signout, refresh token cannot be used in refresh API, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_025`: Signout does not affect access token validity until expiry, expected `200`
- `TC_AUTH_ADMIN_SIGNOUT_026`: Concurrent signout requests with same token, expected `200` for first and `401` for subsequent
- `TC_AUTH_ADMIN_SIGNOUT_027`: Signout with Unicode refresh token value, expected `400/401`
- `TC_AUTH_ADMIN_SIGNOUT_028`: Signout request with extremely long token string, expected `401`
- `TC_AUTH_ADMIN_SIGNOUT_029`: Signout with token issued for different user type, expected `403`
- `TC_AUTH_ADMIN_SIGNOUT_030`: Signout ensures session revocation is persisted in database, expected `200`

Notes:

- `TC_AUTH_ADMIN_SIGNOUT_011` may return `401` as a compatibility behavior because unauthenticated requests can be rejected before user-type authorization.
- `TC_AUTH_ADMIN_SIGNOUT_012` and `TC_AUTH_ADMIN_SIGNOUT_013` are compatibility placeholders because those legacy platform roles are not present in the current role model.
- `TC_AUTH_ADMIN_SIGNOUT_014` may return `200` as compatibility behavior because current endpoint enforces `PLATFORM` user type, not SUPER_ADMIN-only role restrictions.
- `TC_AUTH_ADMIN_SIGNOUT_026` may return concurrent `200,200` as compatibility behavior when the live backend processes both signout requests before revocation visibility is enforced.
- `TC_AUTH_ADMIN_SIGNOUT_030` may be skipped in external mode because in-process database inspection is not available.
