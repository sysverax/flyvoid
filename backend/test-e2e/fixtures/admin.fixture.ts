/**
 * Admin test fixtures — black-box e2e only.
 *
 * These are plain JavaScript objects used as HTTP REQUEST BODIES sent to
 * the API via supertest. They never touch the database directly.
 *
 * Rules:
 *  - Every object is a plain type (no class instances, no ORM models).
 *  - For tests that need a unique email per run, use `uniqueEmail()`.
 *  - Static invalid payloads use a clearly invalid placeholder email that
 *    will never collide with real data.
 */

// ─── Email generator ────────────────────────────────────────────────────────

/**
 * Generates a unique lowercase email for a single test run.
 * Pattern: `<prefix>-<timestamp>-<random>@e2e.test`
 *
 * Always use this when the test creates an admin row to avoid collisions
 * across parallel or repeated runs.
 */
export function uniqueEmail(prefix = "admin"): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${ts}-${rand}@e2e.test`;
}

// ─── Signup payloads ────────────────────────────────────────────────────────

/** A fully valid signup payload. Pass a unique email via `uniqueEmail()`. */
export function validSignupPayload(
  email: string,
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    firstName: "Test",
    lastName: "Admin",
    email,
    password: "Password@123",
    ...overrides,
  };
}

export const weakPasswordPayload = (email: string) => ({
  firstName: "Test",
  lastName: "Admin",
  email,
  password: "pass", // < 8 chars
});

export const noUpperCasePasswordPayload = (email: string) => ({
  firstName: "Test",
  lastName: "Admin",
  email,
  password: "password@123", // no uppercase
});

export const noLowerCasePasswordPayload = (email: string) => ({
  firstName: "Test",
  lastName: "Admin",
  email,
  password: "PASSWORD@123", // no lowercase
});

export const noNumberPasswordPayload = (email: string) => ({
  firstName: "Test",
  lastName: "Admin",
  email,
  password: "Password@abc", // no digit
});

export const noSpecialCharPasswordPayload = (email: string) => ({
  firstName: "Test",
  lastName: "Admin",
  email,
  password: "Password123", // no special char
});

export const invalidEmailPayload = {
  firstName: "Test",
  lastName: "Admin",
  email: "not-an-email",
  password: "Password@123",
};

export const missingFirstNamePayload = (email: string) => ({
  lastName: "Admin",
  email,
  password: "Password@123",
});

export const missingLastNamePayload = (email: string) => ({
  firstName: "Test",
  email,
  password: "Password@123",
});

export const missingEmailPayload = {
  firstName: "Test",
  lastName: "Admin",
  password: "Password@123",
};

export const missingPasswordPayload = (email: string) => ({
  firstName: "Test",
  lastName: "Admin",
  email,
});

export const shortFirstNamePayload = (email: string) => ({
  firstName: "A", // 1 char (min is 2)
  lastName: "Admin",
  email,
  password: "Password@123",
});

export const shortLastNamePayload = (email: string) => ({
  firstName: "Test",
  lastName: "B", // 1 char
  email,
  password: "Password@123",
});

export const longFirstNamePayload = (email: string) => ({
  firstName: "A".repeat(101), // > 100 chars
  lastName: "Admin",
  email,
  password: "Password@123",
});

export const longLastNamePayload = (email: string) => ({
  firstName: "Test",
  lastName: "B".repeat(101), // > 100 chars
  email,
  password: "Password@123",
});

export const numericFirstNamePayload = (email: string) => ({
  firstName: "12345",
  lastName: "Admin",
  email,
  password: "Password@123",
});

export const numericLastNamePayload = (email: string) => ({
  firstName: "Test",
  lastName: "67890",
  email,
  password: "Password@123",
});

export const specialCharsFirstNamePayload = (email: string) => ({
  firstName: "@#$%",
  lastName: "Admin",
  email,
  password: "Password@123",
});

export const specialCharsLastNamePayload = (email: string) => ({
  firstName: "Test",
  lastName: "@#$%",
  email,
  password: "Password@123",
});

export const unknownFieldsSignupPayload = (email: string) => ({
  firstName: "Test",
  lastName: "Admin",
  email,
  password: "Password@123",
  unknownField: "should-fail", // forbidNonWhitelisted = true
});

export const sqlInjectionEmailPayload = {
  firstName: "Test",
  lastName: "Admin",
  email: "' OR '1'='1",
  password: "Password@123",
};

export const scriptInjectionFirstNamePayload = (email: string) => ({
  firstName: "<script>alert(1)</script>",
  lastName: "Admin",
  email,
  password: "Password@123",
});

// ─── Signin payloads ────────────────────────────────────────────────────────

export function validSigninPayload(
  email: string,
  password: string,
): Record<string, unknown> {
  return { email, password };
}

export const invalidPasswordSigninPayload = (email: string) => ({
  email,
  password: "WrongPassword@999",
});

export const invalidEmailSigninPayload = {
  email: "not-an-email",
  password: "Password@123",
};

export const missingEmailSigninPayload = {
  password: "Password@123",
};

export const missingPasswordSigninPayload = (email: string) => ({
  email,
});

export const sqlInjectionSigninEmailPayload = {
  email: "' OR '1'='1",
  password: "Password@123",
};

export const scriptInjectionSigninPasswordPayload = (email: string) => ({
  email,
  password: "<script>alert(1)</script>",
});

export const whitespaceEmailSigninPayload = {
  email: "   ",
  password: "Password@123",
};

export const whitespacePasswordSigninPayload = (email: string) => ({
  email,
  password: "   ",
});

export const unknownFieldsSigninPayload = (email: string) => ({
  email,
  password: "Password@123",
  unknownField: "should-fail",
});

// ─── 2FA payloads ───────────────────────────────────────────────────────────

export function twoFactorEnablePayload(
  twoFactorCode: string,
): Record<string, unknown> {
  return { twoFactorCode };
}

export function twoFactorDisablePayload(
  twoFactorCode: string,
): Record<string, unknown> {
  return { twoFactorCode };
}

export function twoFactorVerifyPayload(
  twoFactorToken: string,
  twoFactorCode: string,
): Record<string, unknown> {
  return { twoFactorToken, twoFactorCode };
}

export function twoFactorRecoverPayload(
  email: string,
  password: string,
  recoveryCode: string,
): Record<string, unknown> {
  return { email, password, recoveryCode };
}

export const invalidTwoFactorCodePayload = (twoFactorToken: string) => ({
  twoFactorToken,
  twoFactorCode: "000000", // likely invalid unless unlucky collision
});

export const shortTwoFactorCodePayload = (twoFactorToken: string) => ({
  twoFactorToken,
  twoFactorCode: "12345", // 5 digits, min is 6
});

export const nonNumericTwoFactorCodePayload = (twoFactorToken: string) => ({
  twoFactorToken,
  twoFactorCode: "ABCDEF", // not digits
});

// ─── Forgot-password payloads ───────────────────────────────────────────────

export function sendOtpPayload(email: string): Record<string, unknown> {
  return { email };
}

export function verifyOtpPayload(
  email: string,
  otp: string,
): Record<string, unknown> {
  return { email, otp };
}

export function forgotPasswordResetPayload(
  resetPasswordToken: string,
  newPassword: string,
): Record<string, unknown> {
  return { resetPasswordToken, newPassword };
}

export const invalidOtpPayload = (email: string) => ({
  email,
  otp: "999999", // static wrong OTP (real is 444444 in test env)
});

export const shortOtpPayload = (email: string) => ({
  email,
  otp: "12345", // 5 digits
});

export const longOtpPayload = (email: string) => ({
  email,
  otp: "1234567", // 7 digits
});

export const nonNumericOtpPayload = (email: string) => ({
  email,
  otp: "ABCDEF",
});

// ─── Initial password reset payloads ────────────────────────────────────────

export function initialPasswordResetPayload(
  resetPasswordToken: string,
  newPassword: string,
): Record<string, unknown> {
  return { resetPasswordToken, newPassword };
}

export const weakInitialPasswordPayload = (resetPasswordToken: string) => ({
  resetPasswordToken,
  newPassword: "pass",
});

export const noUpperInitialPasswordPayload = (resetPasswordToken: string) => ({
  resetPasswordToken,
  newPassword: "newpassword@1",
});

export const noLowerInitialPasswordPayload = (resetPasswordToken: string) => ({
  resetPasswordToken,
  newPassword: "NEWPASSWORD@1",
});

export const noNumberInitialPasswordPayload = (resetPasswordToken: string) => ({
  resetPasswordToken,
  newPassword: "NewPassword@!",
});

export const noSpecialInitialPasswordPayload = (
  resetPasswordToken: string,
) => ({
  resetPasswordToken,
  newPassword: "NewPassword123",
});

// ─── Refresh token payloads ──────────────────────────────────────────────────

export function refreshTokenPayload(
  refreshToken: string,
): Record<string, unknown> {
  return { refreshToken };
}

export const invalidRefreshTokenPayload = {
  refreshToken: "invalid.token.value",
};

export const malformedJwtRefreshTokenPayload = {
  refreshToken: "not.a.jwt",
};

// ─── Signout payloads ────────────────────────────────────────────────────────

export function signoutPayload(refreshToken: string): Record<string, unknown> {
  return { refreshToken };
}

export const invalidSignoutRefreshTokenPayload = {
  refreshToken: "invalid.refresh.token",
};
