/**
 * E2E tests for POST /api/v1/auth/admin/signin
 *
 * Black-box: all interactions via HTTP (supertest) and raw SQL (pg).
 * No imports from src/.
 *
 * Pre-conditions seeded in beforeAll via raw SQL:
 *   - superAdminEmail  / SUPER_ADMIN / active
 *   - staffEmail       / STAFF       / active
 *   - inactiveEmail    / SUPER_ADMIN / inactive
 *   - inactiveStaffEmail / STAFF     / inactive
 *   - deletedEmail     / SUPER_ADMIN / active (deleted in the test itself)
 *   - resetRequiredEmail / STAFF     / active, requirePasswordReset=true
 *
 * 2FA admin is set up through the live API flow in beforeAll.
 */
import { api } from "../../../helpers/http-client.helper";
import { endPool, query } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import {
  insertActiveAdmin,
  insertInactiveAdmin,
  insertAdminWithPasswordResetRequired,
  deleteAdminByEmail,
} from "../../../seeders/admin.seeder";
import {
  uniqueEmail,
  validSigninPayload,
  invalidPasswordSigninPayload,
  invalidEmailSigninPayload,
  missingEmailSigninPayload,
  missingPasswordSigninPayload,
  sqlInjectionSigninEmailPayload,
  scriptInjectionSigninPasswordPayload,
  whitespaceEmailSigninPayload,
  whitespacePasswordSigninPayload,
  unknownFieldsSigninPayload,
} from "../../../fixtures/admin.fixture";
import {
  getAdminTokens,
  signupAndGetTokens,
} from "../../../helpers/auth.helper";
import * as speakeasy from "speakeasy";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const EMAIL_PATTERN = "%@e2e-signin.test";
const TEST_PASSWORD = "Password@123";

// Emails for seeded admins
let superAdminEmail: string;
let staffEmail: string;
let inactiveEmail: string;
let inactiveStaffEmail: string;
let deletedEmail: string;
let resetRequiredEmail: string;
let twoFactorEmail: string;

describe("POST /api/v1/auth/admin/signin", () => {
  beforeAll(async () => {
    superAdminEmail = uniqueEmail("si-super");
    staffEmail = uniqueEmail("si-staff");
    inactiveEmail = uniqueEmail("si-inactive");
    inactiveStaffEmail = uniqueEmail("si-inactive-staff");
    deletedEmail = uniqueEmail("si-deleted");
    resetRequiredEmail = uniqueEmail("si-resetreq");
    twoFactorEmail = uniqueEmail("si-2fa");

    // Replace @e2e.test suffix with our pattern suffix
    superAdminEmail = superAdminEmail.replace("@e2e.test", "@e2e-signin.test");
    staffEmail = staffEmail.replace("@e2e.test", "@e2e-signin.test");
    inactiveEmail = inactiveEmail.replace("@e2e.test", "@e2e-signin.test");
    inactiveStaffEmail = inactiveStaffEmail.replace(
      "@e2e.test",
      "@e2e-signin.test",
    );
    deletedEmail = deletedEmail.replace("@e2e.test", "@e2e-signin.test");
    resetRequiredEmail = resetRequiredEmail.replace(
      "@e2e.test",
      "@e2e-signin.test",
    );
    twoFactorEmail = twoFactorEmail.replace("@e2e.test", "@e2e-signin.test");

    await Promise.all([
      insertActiveAdmin({
        email: superAdminEmail,
        password: TEST_PASSWORD,
        role: "SUPER_ADMIN",
      }),
      insertActiveAdmin({
        email: staffEmail,
        password: TEST_PASSWORD,
        role: "STAFF",
      }),
      insertInactiveAdmin({
        email: inactiveEmail,
        password: TEST_PASSWORD,
        role: "SUPER_ADMIN",
      }),
      insertInactiveAdmin({
        email: inactiveStaffEmail,
        password: TEST_PASSWORD,
        role: "STAFF",
      }),
      insertActiveAdmin({
        email: deletedEmail,
        password: TEST_PASSWORD,
        role: "SUPER_ADMIN",
      }),
      insertAdminWithPasswordResetRequired({
        email: resetRequiredEmail,
        password: TEST_PASSWORD,
      }),
    ]);

    // Set up 2FA admin via API flow: signup → signin → 2fa/setup → 2fa/enable
    await api.post("/api/v1/auth/admin/signup").send({
      firstName: "TwoFactor",
      lastName: "Admin",
      email: twoFactorEmail,
      password: TEST_PASSWORD,
    });

    const { accessToken } = await getAdminTokens(twoFactorEmail, TEST_PASSWORD);
    const setupRes = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);

    const { manualEntryKey } = setupRes.body.data as {
      manualEntryKey: string;
      qrCodeDataUrl: string;
    };
    const twoFactorCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });

    await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode });
  });

  afterAll(async () => {
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  // ─── Happy path ────────────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNIN_001
  it("TC_AUTH_ADMIN_SIGNIN_001: SUPER_ADMIN signin success → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(superAdminEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // TC_AUTH_ADMIN_SIGNIN_002
  it("TC_AUTH_ADMIN_SIGNIN_002: STAFF signin success → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(staffEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
  });

  // TC_AUTH_ADMIN_SIGNIN_020
  it("TC_AUTH_ADMIN_SIGNIN_020: SUPER_ADMIN signin returns tokens and admin profile → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(superAdminEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(typeof data.accessToken).toBe("string");
    expect(data.accessToken.length).toBeGreaterThan(0);
    expect(typeof data.refreshToken).toBe("string");
    expect(data.refreshToken.length).toBeGreaterThan(0);
    expect(typeof data.accessTokenExpiresIn).toBe("string");
    expect(typeof data.refreshTokenExpiresIn).toBe("string");
    expect(data.admin).toBeDefined();
    expect(data.admin.id).toBeDefined();
    expect(data.admin.email).toBe(superAdminEmail);
    expect(data.admin.role).toBe("SUPER_ADMIN");
    expect(data.admin.accessControls).toBeInstanceOf(Array);
  });

  // TC_AUTH_ADMIN_SIGNIN_021
  it("TC_AUTH_ADMIN_SIGNIN_021: STAFF signin returns tokens and admin profile → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(staffEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.data.admin.role).toBe("STAFF");
  });

  // TC_AUTH_ADMIN_SIGNIN_041
  it("TC_AUTH_ADMIN_SIGNIN_041: Signin response contains correct admin email → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(superAdminEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.data.admin.email).toBe(superAdminEmail);
  });

  // TC_AUTH_ADMIN_SIGNIN_042
  it("TC_AUTH_ADMIN_SIGNIN_042: Signin response contains correct admin role → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(superAdminEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(["SUPER_ADMIN", "STAFF"]).toContain(res.body.data.admin.role);
  });

  // TC_AUTH_ADMIN_SIGNIN_043
  it("TC_AUTH_ADMIN_SIGNIN_043: Signin response tokens are non-empty strings → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(superAdminEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
  });

  // TC_AUTH_ADMIN_SIGNIN_044
  it("TC_AUTH_ADMIN_SIGNIN_044: Signin response must not expose password field → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(superAdminEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.data.admin.password).toBeUndefined();
    expect(res.body.data.admin.passwordHash).toBeUndefined();
  });

  // TC_AUTH_ADMIN_SIGNIN_014
  it("TC_AUTH_ADMIN_SIGNIN_014: Uppercase email is normalized and succeeds → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(superAdminEmail.toUpperCase(), TEST_PASSWORD));

    expect(res.status).toBe(200);
  });

  // TC_AUTH_ADMIN_SIGNIN_015
  it("TC_AUTH_ADMIN_SIGNIN_015: Email with leading/trailing spaces is trimmed and succeeds → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(`  ${superAdminEmail}  `, TEST_PASSWORD));

    expect(res.status).toBe(200);
  });

  // TC_AUTH_ADMIN_SIGNIN_045
  it("TC_AUTH_ADMIN_SIGNIN_045: Concurrent signin requests with same credentials both succeed → 200", async () => {
    const [res1, res2] = await Promise.all([
      api
        .post("/api/v1/auth/admin/signin")
        .send(validSigninPayload(superAdminEmail, TEST_PASSWORD)),
      api
        .post("/api/v1/auth/admin/signin")
        .send(validSigninPayload(superAdminEmail, TEST_PASSWORD)),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  // ─── 2FA challenge ─────────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNIN_029
  it("TC_AUTH_ADMIN_SIGNIN_029: Signin with 2FA-enabled admin returns 2FA challenge → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(twoFactorEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.data.requiresTwoFactor).toBe(true);
  });

  // TC_AUTH_ADMIN_SIGNIN_030
  it("TC_AUTH_ADMIN_SIGNIN_030: 2FA challenge response contains requiresTwoFactor=true → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(twoFactorEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.data.requiresTwoFactor).toBe(true);
  });

  // TC_AUTH_ADMIN_SIGNIN_031
  it("TC_AUTH_ADMIN_SIGNIN_031: 2FA challenge response contains twoFactorToken → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(twoFactorEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(typeof res.body.data.twoFactorToken).toBe("string");
    expect(res.body.data.twoFactorToken.length).toBeGreaterThan(0);
  });

  // TC_AUTH_ADMIN_SIGNIN_032
  it("TC_AUTH_ADMIN_SIGNIN_032: 2FA challenge response contains twoFactorTokenExpiresIn → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(twoFactorEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(typeof res.body.data.twoFactorTokenExpiresIn).toBe("string");
  });

  // ─── Password reset challenge ──────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNIN_033
  it("TC_AUTH_ADMIN_SIGNIN_033: Signin with requirePasswordReset admin → password reset challenge → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(resetRequiredEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.data.requiresPasswordReset).toBe(true);
  });

  // TC_AUTH_ADMIN_SIGNIN_034
  it("TC_AUTH_ADMIN_SIGNIN_034: Password reset challenge contains requiresPasswordReset=true → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(resetRequiredEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.data.requiresPasswordReset).toBe(true);
  });

  // TC_AUTH_ADMIN_SIGNIN_035
  it("TC_AUTH_ADMIN_SIGNIN_035: Password reset challenge contains resetPasswordToken → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(resetRequiredEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(typeof res.body.data.resetPasswordToken).toBe("string");
    expect(res.body.data.resetPasswordToken.length).toBeGreaterThan(0);
  });

  // TC_AUTH_ADMIN_SIGNIN_036
  it("TC_AUTH_ADMIN_SIGNIN_036: Password reset challenge contains resetPasswordTokenExpiresIn → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(resetRequiredEmail, TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(typeof res.body.data.resetPasswordTokenExpiresIn).toBe("string");
  });

  // ─── Credential failures ───────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNIN_003
  it("TC_AUTH_ADMIN_SIGNIN_003: Signin with non-existing email → 401", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload("nonexistent@e2e-signin.test", TEST_PASSWORD));

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNIN_004
  it("TC_AUTH_ADMIN_SIGNIN_004: Signin with wrong password → 401", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(invalidPasswordSigninPayload(superAdminEmail));

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  // TC_AUTH_ADMIN_SIGNIN_005
  it("TC_AUTH_ADMIN_SIGNIN_005: Signin with non-existing email → 401", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload("ghost@e2e-signin.test", TEST_PASSWORD));

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNIN_016
  it("TC_AUTH_ADMIN_SIGNIN_016: Inactive admin signin → 401", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(inactiveEmail, TEST_PASSWORD));

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNIN_017
  it("TC_AUTH_ADMIN_SIGNIN_017: Inactive STAFF admin signin → 401", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(inactiveStaffEmail, TEST_PASSWORD));

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNIN_018
  it("TC_AUTH_ADMIN_SIGNIN_018: Deleted admin (hard-deleted via SQL) signin → 401", async () => {
    // Delete the admin directly via SQL (no API endpoint exists for this)
    await deleteAdminByEmail(deletedEmail);

    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(validSigninPayload(deletedEmail, TEST_PASSWORD));

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNIN_019
  it("TC_AUTH_ADMIN_SIGNIN_019: Multiple consecutive wrong passwords → 401 each time", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await api
        .post("/api/v1/auth/admin/signin")
        .send(validSigninPayload(superAdminEmail, "WrongPass@999"));
      expect(res.status).toBe(401);
    }
  });

  // ─── DTO validation failures ───────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNIN_006
  it("TC_AUTH_ADMIN_SIGNIN_006: Invalid email format → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(invalidEmailSigninPayload);

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_007
  it("TC_AUTH_ADMIN_SIGNIN_007: Password shorter than 8 chars → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send({ email: superAdminEmail, password: "short" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_008
  it("TC_AUTH_ADMIN_SIGNIN_008: Missing email field → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(missingEmailSigninPayload);

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_009
  it("TC_AUTH_ADMIN_SIGNIN_009: Missing password field → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(missingPasswordSigninPayload(superAdminEmail));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_010
  it("TC_AUTH_ADMIN_SIGNIN_010: Empty email string → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send({ email: "", password: TEST_PASSWORD });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_011
  it("TC_AUTH_ADMIN_SIGNIN_011: Empty password string → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send({ email: superAdminEmail, password: "" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_012
  it("TC_AUTH_ADMIN_SIGNIN_012: Null email → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send({ email: null, password: TEST_PASSWORD });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_013
  it("TC_AUTH_ADMIN_SIGNIN_013: Null password → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send({ email: superAdminEmail, password: null });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_046
  it("TC_AUTH_ADMIN_SIGNIN_046: Unicode characters in email field → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send({ email: "ünïcödé@example.com", password: TEST_PASSWORD });

    // Unicode local-part is not a valid RFC 5321 email per class-validator
    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_047
  it("TC_AUTH_ADMIN_SIGNIN_047: Whitespace-only password → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(whitespacePasswordSigninPayload(superAdminEmail));

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_048
  it("TC_AUTH_ADMIN_SIGNIN_048: Whitespace-only email → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(whitespaceEmailSigninPayload);

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_037
  it("TC_AUTH_ADMIN_SIGNIN_037: Malformed JSON payload → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .set("Content-Type", "application/json")
      .send("{ email: bad json }");

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_038
  it("TC_AUTH_ADMIN_SIGNIN_038: Unknown extra field in body → 400 (forbidNonWhitelisted)", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(unknownFieldsSigninPayload(superAdminEmail));

    expect(res.status).toBe(400);
  });

  // ─── Injection ────────────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNIN_039
  it("TC_AUTH_ADMIN_SIGNIN_039: SQL injection in email field → 400 (rejected by @IsEmail)", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(sqlInjectionSigninEmailPayload);

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_040
  it("TC_AUTH_ADMIN_SIGNIN_040: Script injection in password → 401 (passes DTO validation, invalid credentials)", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send(scriptInjectionSigninPasswordPayload(superAdminEmail));

    // Password has no regex constraint — it passes DTO validation but
    // authentication will fail because the hash won't match.
    expect(res.status).toBe(401);
  });
});
