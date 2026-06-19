/**
 * E2E tests for POST /api/v1/auth/admin/2fa/recover
 *
 * Black-box: all interactions via HTTP (supertest) and raw SQL (pg).
 * No imports from src/.
 *
 * Pre-condition: one admin with 2FA enabled is set up via API flow in
 * beforeAll. The recovery codes are captured from the enable response.
 *
 * Request shape: { email, password, recoveryCode }
 */
import * as speakeasy from "speakeasy";
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { uniqueEmail } from "../../../fixtures/admin.fixture";
import {
  signupAndGetTokens,
  getAdminTokens,
} from "../../../helpers/auth.helper";
import { describe, it } from "node:test";
import { beforeAll, afterAll, expect } from "@jest/globals";

const EMAIL_PATTERN = "%@e2e-recover.test";
const TEST_PASSWORD = "Password@123";

function makeEmail(prefix: string): string {
  return uniqueEmail(prefix).replace("@e2e.test", "@e2e-recover.test");
}

describe("POST /api/v1/auth/admin/2fa/recover", () => {
  // Admin with 2FA enabled
  let adminEmail: string;
  let recoveryCodes: string[];
  let manualEntryKey: string;

  // A fresh admin with 2FA enabled, used exclusively for the
  // "already-used code" test so it does not interfere with other tests
  let reuseTestEmail: string;
  let reuseTestRecoveryCodes: string[];

  beforeAll(async () => {
    // ── Main test admin ──────────────────────────────────────────────────
    adminEmail = makeEmail("recover-main");
    const { accessToken } = await signupAndGetTokens(
      "Recover",
      "Admin",
      adminEmail,
      TEST_PASSWORD,
    );

    const setupRes = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);
    manualEntryKey = (setupRes.body.data as { manualEntryKey: string })
      .manualEntryKey;

    const enableCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });
    const enableRes = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode: enableCode });
    recoveryCodes = (enableRes.body.data as { recoveryCodes: string[] })
      .recoveryCodes;

    // ── Reuse-test admin ─────────────────────────────────────────────────
    reuseTestEmail = makeEmail("recover-reuse");
    const { accessToken: reuseToken } = await signupAndGetTokens(
      "Reuse",
      "Admin",
      reuseTestEmail,
      TEST_PASSWORD,
    );

    const rSetupRes = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${reuseToken}`);
    const rKey = (rSetupRes.body.data as { manualEntryKey: string })
      .manualEntryKey;
    const rEnableCode = speakeasy.totp({ secret: rKey, encoding: "base32" });
    const rEnableRes = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${reuseToken}`)
      .send({ twoFactorCode: rEnableCode });
    reuseTestRecoveryCodes = (
      rEnableRes.body.data as { recoveryCodes: string[] }
    ).recoveryCodes;
  });

  afterAll(async () => {
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  // ─── Happy path ────────────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_2FA_RECOVER_001
  it("TC_AUTH_ADMIN_2FA_RECOVER_001: 2FA recovery with valid email, password, and recovery code → 200", async () => {
    // Use last recovery code to preserve the first ones for the reuse test
    const recoveryCode = recoveryCodes[recoveryCodes.length - 1];
    const res = await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ email: adminEmail, password: TEST_PASSWORD, recoveryCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_002
  it("TC_AUTH_ADMIN_2FA_RECOVER_002: 2FA recovery response data is null → 200", async () => {
    // Need a fresh admin with 2FA enabled for this test
    const freshEmail = makeEmail("recover-null");
    const { accessToken: ft } = await signupAndGetTokens(
      "Null",
      "Recover",
      freshEmail,
      TEST_PASSWORD,
    );
    const sr = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${ft}`);
    const fk = (sr.body.data as { manualEntryKey: string }).manualEntryKey;
    const fc = speakeasy.totp({ secret: fk, encoding: "base32" });
    const er = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${ft}`)
      .send({ twoFactorCode: fc });
    const frc = (er.body.data as { recoveryCodes: string[] }).recoveryCodes[0];

    const res = await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ email: freshEmail, password: TEST_PASSWORD, recoveryCode: frc });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_003
  it("TC_AUTH_ADMIN_2FA_RECOVER_003: 2FA recovery response success is true → 200", async () => {
    const freshEmail = makeEmail("recover-suc");
    const { accessToken: ft } = await signupAndGetTokens(
      "Suc",
      "Recover",
      freshEmail,
      TEST_PASSWORD,
    );
    const sr = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${ft}`);
    const fk = (sr.body.data as { manualEntryKey: string }).manualEntryKey;
    const fc = speakeasy.totp({ secret: fk, encoding: "base32" });
    const er = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${ft}`)
      .send({ twoFactorCode: fc });
    const frc = (er.body.data as { recoveryCodes: string[] }).recoveryCodes[0];

    const res = await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ email: freshEmail, password: TEST_PASSWORD, recoveryCode: frc });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_004
  it("TC_AUTH_ADMIN_2FA_RECOVER_004: After recovery, signing in no longer triggers 2FA challenge → 200 with tokens", async () => {
    // The main admin already consumed their last recovery code in TC_001.
    // Use a fresh admin specifically for this test.
    const freshEmail = makeEmail("recover-nodfa");
    const { accessToken: ft } = await signupAndGetTokens(
      "NoDfa",
      "Recover",
      freshEmail,
      TEST_PASSWORD,
    );
    const sr = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${ft}`);
    const fk = (sr.body.data as { manualEntryKey: string }).manualEntryKey;
    const fc = speakeasy.totp({ secret: fk, encoding: "base32" });
    const er = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${ft}`)
      .send({ twoFactorCode: fc });
    const frc = (er.body.data as { recoveryCodes: string[] }).recoveryCodes[0];

    // Recover
    await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ email: freshEmail, password: TEST_PASSWORD, recoveryCode: frc });

    // Now signing in should return tokens directly (no 2FA challenge)
    const signinRes = await api
      .post("/api/v1/auth/admin/signin")
      .send({ email: freshEmail, password: TEST_PASSWORD });

    expect(signinRes.status).toBe(200);
    expect(signinRes.body.data.accessToken).toBeDefined();
    expect(signinRes.body.data.requiresTwoFactor).toBeUndefined();
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_018
  it("TC_AUTH_ADMIN_2FA_RECOVER_018: After recovery, signin returns tokens directly — not a 2FA challenge", async () => {
    const freshEmail = makeEmail("recover-after");
    const { accessToken: ft } = await signupAndGetTokens(
      "After",
      "Rec",
      freshEmail,
      TEST_PASSWORD,
    );
    const sr = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${ft}`);
    const fk = (sr.body.data as { manualEntryKey: string }).manualEntryKey;
    const fc = speakeasy.totp({ secret: fk, encoding: "base32" });
    const er = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${ft}`)
      .send({ twoFactorCode: fc });
    const frc = (er.body.data as { recoveryCodes: string[] }).recoveryCodes[0];

    await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ email: freshEmail, password: TEST_PASSWORD, recoveryCode: frc });

    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send({ email: freshEmail, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe("string");
  });

  // ─── Invalid credential failures ──────────────────────────────────────────

  // TC_AUTH_ADMIN_2FA_RECOVER_005
  it("TC_AUTH_ADMIN_2FA_RECOVER_005: 2FA recovery with invalid password → 401", async () => {
    const res = await api.post("/api/v1/auth/admin/2fa/recover").send({
      email: adminEmail,
      password: "WrongPass@999",
      recoveryCode: recoveryCodes[0],
    });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_006
  it("TC_AUTH_ADMIN_2FA_RECOVER_006: 2FA recovery with non-existing email → 401", async () => {
    const res = await api.post("/api/v1/auth/admin/2fa/recover").send({
      email: "ghost@e2e-recover.test",
      password: TEST_PASSWORD,
      recoveryCode: "ABCD1234EF",
    });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_007
  it("TC_AUTH_ADMIN_2FA_RECOVER_007: 2FA recovery with invalid recovery code → 401", async () => {
    const res = await api.post("/api/v1/auth/admin/2fa/recover").send({
      email: adminEmail,
      password: TEST_PASSWORD,
      recoveryCode: "INVALID0000",
    });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_008
  it("TC_AUTH_ADMIN_2FA_RECOVER_008: 2FA recovery with already-used recovery code → 401", async () => {
    const codeToReuse = reuseTestRecoveryCodes[0];

    // First use: should succeed
    const firstRes = await api.post("/api/v1/auth/admin/2fa/recover").send({
      email: reuseTestEmail,
      password: TEST_PASSWORD,
      recoveryCode: codeToReuse,
    });
    expect(firstRes.status).toBe(200);

    // Second use: same code, 2FA is now disabled — trying to recover again
    // with the same (now spent) code must fail
    const secondRes = await api.post("/api/v1/auth/admin/2fa/recover").send({
      email: reuseTestEmail,
      password: TEST_PASSWORD,
      recoveryCode: codeToReuse,
    });

    // 2FA was disabled by the first recovery, so there is nothing to recover.
    // The service should return 401 (invalid recovery credentials).
    expect(secondRes.status).toBe(401);
  });

  // ─── DTO validation failures ───────────────────────────────────────────────

  // TC_AUTH_ADMIN_2FA_RECOVER_009
  it("TC_AUTH_ADMIN_2FA_RECOVER_009: Missing email field → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ password: TEST_PASSWORD, recoveryCode: "ABCD1234EF" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_010
  it("TC_AUTH_ADMIN_2FA_RECOVER_010: Missing password field → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ email: adminEmail, recoveryCode: "ABCD1234EF" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_011
  it("TC_AUTH_ADMIN_2FA_RECOVER_011: Missing recoveryCode field → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ email: adminEmail, password: TEST_PASSWORD });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_012
  it("TC_AUTH_ADMIN_2FA_RECOVER_012: Empty email → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ email: "", password: TEST_PASSWORD, recoveryCode: "ABCD1234EF" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_013
  it("TC_AUTH_ADMIN_2FA_RECOVER_013: Empty password → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ email: adminEmail, password: "", recoveryCode: "ABCD1234EF" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_014
  it("TC_AUTH_ADMIN_2FA_RECOVER_014: Empty recoveryCode → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/recover")
      .send({ email: adminEmail, password: TEST_PASSWORD, recoveryCode: "" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_015
  it("TC_AUTH_ADMIN_2FA_RECOVER_015: Invalid email format → 400", async () => {
    const res = await api.post("/api/v1/auth/admin/2fa/recover").send({
      email: "not-an-email",
      password: TEST_PASSWORD,
      recoveryCode: "ABCD1234EF",
    });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_016
  it("TC_AUTH_ADMIN_2FA_RECOVER_016: Malformed JSON payload → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/recover")
      .set("Content-Type", "application/json")
      .send("{ bad json }");

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_RECOVER_017
  it("TC_AUTH_ADMIN_2FA_RECOVER_017: Unknown fields in request body → 400 (forbidNonWhitelisted)", async () => {
    const res = await api.post("/api/v1/auth/admin/2fa/recover").send({
      email: adminEmail,
      password: TEST_PASSWORD,
      recoveryCode: "ABCD1234EF",
      extraField: "bad",
    });

    expect(res.status).toBe(400);
  });
});
