/**
 * E2E tests for:
 *   POST /api/v1/auth/admin/2fa/setup
 *   POST /api/v1/auth/admin/2fa/enable
 *   POST /api/v1/auth/admin/2fa/disable
 *   POST /api/v1/auth/admin/signin/2fa/verify
 *
 * Black-box: all interactions via HTTP (supertest) and raw SQL (pg).
 * No imports from src/.
 *
 * TOTP codes are generated via `speakeasy` (a node_modules library) using
 * the manualEntryKey returned from the setup endpoint.
 * The backend is configured with TWO_FACTOR_OTP_WINDOW=1, which means
 * it accepts codes from the current 30s window ±1 window (up to 90s grace).
 *
 * Test admin lifecycle per describe block:
 *  - Setup tests: one fresh admin per test where needed (beforeAll creates it)
 *  - Enable tests: one admin goes through setup first in beforeAll
 *  - Disable tests: one admin goes through setup + enable in beforeAll
 *  - Verify tests: one admin has 2FA enabled; signin produces twoFactorToken
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
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const EMAIL_PATTERN = "%@e2e-2fa.test";
const TEST_PASSWORD = "Password@123";

function makeEmail(prefix: string): string {
  return uniqueEmail(prefix).replace("@e2e.test", "@e2e-2fa.test");
}

// ─── 2FA Setup ────────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/admin/2fa/setup", () => {
  let accessToken: string;
  let adminEmail: string;

  beforeAll(async () => {
    adminEmail = makeEmail("setup-admin");
    accessToken = (
      await signupAndGetTokens("Setup", "Admin", adminEmail, TEST_PASSWORD)
    ).accessToken;
  });

  afterAll(async () => {
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  // TC_AUTH_ADMIN_2FA_SETUP_001
  it("TC_AUTH_ADMIN_2FA_SETUP_001: 2FA setup success returns manualEntryKey and qrCodeDataUrl → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.manualEntryKey).toBeDefined();
    expect(res.body.data.qrCodeDataUrl).toBeDefined();
  });

  // TC_AUTH_ADMIN_2FA_SETUP_005
  it("TC_AUTH_ADMIN_2FA_SETUP_005: 2FA setup response manualEntryKey is a non-empty string → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.manualEntryKey).toBe("string");
    expect(res.body.data.manualEntryKey.length).toBeGreaterThan(0);
  });

  // TC_AUTH_ADMIN_2FA_SETUP_006
  it("TC_AUTH_ADMIN_2FA_SETUP_006: 2FA setup response qrCodeDataUrl is a non-empty string → 200", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.qrCodeDataUrl).toBe("string");
    expect(res.body.data.qrCodeDataUrl).toMatch(/^data:image\//);
  });

  // TC_AUTH_ADMIN_2FA_SETUP_002
  it("TC_AUTH_ADMIN_2FA_SETUP_002: 2FA setup without Authorization header → 401", async () => {
    const res = await api.post("/api/v1/auth/admin/2fa/setup");

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_2FA_SETUP_003
  it("TC_AUTH_ADMIN_2FA_SETUP_003: 2FA setup with invalid access token → 401", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", "Bearer invalid.token.value");

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_2FA_SETUP_004 — requires 2FA already enabled; tested in the enable+disable describe block
});

// ─── 2FA Enable ───────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/admin/2fa/enable", () => {
  let accessToken: string;
  let adminEmail: string;
  let manualEntryKey: string;

  // Admin for "no-setup" test (never called /2fa/setup)
  let noSetupAccessToken: string;
  let noSetupEmail: string;

  beforeAll(async () => {
    adminEmail = makeEmail("enable-admin");
    accessToken = (
      await signupAndGetTokens("Enable", "Admin", adminEmail, TEST_PASSWORD)
    ).accessToken;

    // Call setup to get the manualEntryKey
    const setupRes = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);
    manualEntryKey = (setupRes.body.data as { manualEntryKey: string })
      .manualEntryKey;

    // Admin that skips setup
    noSetupEmail = makeEmail("nosetupadmin");
    noSetupAccessToken = (
      await signupAndGetTokens("NoSetup", "Admin", noSetupEmail, TEST_PASSWORD)
    ).accessToken;
  });

  afterAll(async () => {
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_001
  it("TC_AUTH_ADMIN_2FA_ENABLE_001: 2FA enable with valid TOTP code → 200", async () => {
    const twoFactorCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });
    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_002
  it("TC_AUTH_ADMIN_2FA_ENABLE_002: 2FA enable response contains recoveryCodes array → 200", async () => {
    // Re-enable: need a fresh admin because the previous test already enabled 2FA.
    const freshEmail = makeEmail("enable-fresh");
    const { accessToken: freshToken } = await signupAndGetTokens(
      "Fresh",
      "Enable",
      freshEmail,
      TEST_PASSWORD,
    );
    const setupRes = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${freshToken}`);
    const key = (setupRes.body.data as { manualEntryKey: string })
      .manualEntryKey;
    const code = speakeasy.totp({ secret: key, encoding: "base32" });

    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${freshToken}`)
      .send({ twoFactorCode: code });

    expect(res.status).toBe(200);
    expect(res.body.data.recoveryCodes).toBeInstanceOf(Array);
    expect(res.body.data.recoveryCodes.length).toBeGreaterThan(0);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_003
  it("TC_AUTH_ADMIN_2FA_ENABLE_003: 2FA enable recoveryCodes are non-empty strings → 200", async () => {
    const freshEmail = makeEmail("enable-fresh2");
    const { accessToken: freshToken } = await signupAndGetTokens(
      "Fresh2",
      "Enable",
      freshEmail,
      TEST_PASSWORD,
    );
    const setupRes = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${freshToken}`);
    const key = (setupRes.body.data as { manualEntryKey: string })
      .manualEntryKey;
    const code = speakeasy.totp({ secret: key, encoding: "base32" });

    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${freshToken}`)
      .send({ twoFactorCode: code });

    expect(res.status).toBe(200);
    for (const rc of res.body.data.recoveryCodes as string[]) {
      expect(typeof rc).toBe("string");
      expect(rc.length).toBeGreaterThan(0);
    }
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_004
  it("TC_AUTH_ADMIN_2FA_ENABLE_004: 2FA enable with invalid TOTP code → 401", async () => {
    const freshEmail = makeEmail("enable-invalid");
    const { accessToken: freshToken } = await signupAndGetTokens(
      "Inv",
      "Enable",
      freshEmail,
      TEST_PASSWORD,
    );
    await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${freshToken}`);

    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${freshToken}`)
      .send({ twoFactorCode: "000000" }); // definitely wrong

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_005
  it("TC_AUTH_ADMIN_2FA_ENABLE_005: 2FA enable without twoFactorCode field → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${noSetupAccessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_006
  it("TC_AUTH_ADMIN_2FA_ENABLE_006: 2FA enable with empty twoFactorCode → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${noSetupAccessToken}`)
      .send({ twoFactorCode: "" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_007
  it("TC_AUTH_ADMIN_2FA_ENABLE_007: 2FA enable with 5-digit code (too short) → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${noSetupAccessToken}`)
      .send({ twoFactorCode: "12345" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_008
  it("TC_AUTH_ADMIN_2FA_ENABLE_008: 2FA enable with 7-digit code (too long) → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${noSetupAccessToken}`)
      .send({ twoFactorCode: "1234567" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_009
  it("TC_AUTH_ADMIN_2FA_ENABLE_009: 2FA enable with non-numeric code → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${noSetupAccessToken}`)
      .send({ twoFactorCode: "ABCDEF" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_010
  it("TC_AUTH_ADMIN_2FA_ENABLE_010: 2FA enable without Authorization header → 401", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .send({ twoFactorCode: "123456" });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_011
  it("TC_AUTH_ADMIN_2FA_ENABLE_011: 2FA enable when setup has not been called → 400", async () => {
    const twoFactorCode = speakeasy.totp({
      secret: "JBSWY3DPEHPK3PXP",
      encoding: "base32",
    });
    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${noSetupAccessToken}`)
      .send({ twoFactorCode });

    // No temp secret exists → service returns 400
    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_ENABLE_012
  it("TC_AUTH_ADMIN_2FA_ENABLE_012: 2FA enable with unknown fields → 400 (forbidNonWhitelisted)", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${noSetupAccessToken}`)
      .send({ twoFactorCode: "123456", extraField: "bad" });

    expect(res.status).toBe(400);
  });
});

// ─── 2FA Disable ──────────────────────────────────────────────────────────────

describe("POST /api/v1/auth/admin/2fa/disable", () => {
  let accessToken: string;
  let adminEmail: string;
  let manualEntryKey: string;

  // Admin with 2FA never enabled (for the "not enabled" test)
  let noTwoFactorAccessToken: string;
  let noTwoFactorEmail: string;

  beforeAll(async () => {
    adminEmail = makeEmail("disable-admin");
    accessToken = (
      await signupAndGetTokens("Disable", "Admin", adminEmail, TEST_PASSWORD)
    ).accessToken;

    // setup → enable so we have a 2FA-enabled admin to disable
    const setupRes = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);
    manualEntryKey = (setupRes.body.data as { manualEntryKey: string })
      .manualEntryKey;
    const enableCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });
    await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode: enableCode });

    noTwoFactorEmail = makeEmail("nodisable-admin");
    noTwoFactorAccessToken = (
      await signupAndGetTokens(
        "NoDis",
        "Admin",
        noTwoFactorEmail,
        TEST_PASSWORD,
      )
    ).accessToken;
  });

  afterAll(async () => {
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
  });

  // TC_AUTH_ADMIN_2FA_DISABLE_001
  it("TC_AUTH_ADMIN_2FA_DISABLE_001: 2FA disable with valid TOTP code → 200", async () => {
    const twoFactorCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });
    const res = await api
      .post("/api/v1/auth/admin/2fa/disable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // TC_AUTH_ADMIN_2FA_DISABLE_002
  it("TC_AUTH_ADMIN_2FA_DISABLE_002: 2FA disable response data is null → 200", async () => {
    // Re-enable first so we can disable again
    const re = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);
    const key2 = (re.body.data as { manualEntryKey: string }).manualEntryKey;
    const enableCode = speakeasy.totp({ secret: key2, encoding: "base32" });
    await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode: enableCode });

    const disableCode = speakeasy.totp({ secret: key2, encoding: "base32" });
    const res = await api
      .post("/api/v1/auth/admin/2fa/disable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode: disableCode });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  // TC_AUTH_ADMIN_2FA_DISABLE_003
  it("TC_AUTH_ADMIN_2FA_DISABLE_003: 2FA disable with invalid TOTP code → 401", async () => {
    // Re-enable again first
    const re = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);
    const key3 = (re.body.data as { manualEntryKey: string }).manualEntryKey;
    const enableCode = speakeasy.totp({ secret: key3, encoding: "base32" });
    await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode: enableCode });

    const res = await api
      .post("/api/v1/auth/admin/2fa/disable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode: "000000" });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_2FA_DISABLE_004
  it("TC_AUTH_ADMIN_2FA_DISABLE_004: 2FA disable when 2FA is not enabled → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/disable")
      .set("Authorization", `Bearer ${noTwoFactorAccessToken}`)
      .send({ twoFactorCode: "123456" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_DISABLE_005
  it("TC_AUTH_ADMIN_2FA_DISABLE_005: 2FA disable without twoFactorCode field → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/disable")
      .set("Authorization", `Bearer ${noTwoFactorAccessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_DISABLE_006
  it("TC_AUTH_ADMIN_2FA_DISABLE_006: 2FA disable with empty twoFactorCode → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/disable")
      .set("Authorization", `Bearer ${noTwoFactorAccessToken}`)
      .send({ twoFactorCode: "" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_DISABLE_007
  it("TC_AUTH_ADMIN_2FA_DISABLE_007: 2FA disable with non-numeric code → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/disable")
      .set("Authorization", `Bearer ${noTwoFactorAccessToken}`)
      .send({ twoFactorCode: "ABCDEF" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_DISABLE_008
  it("TC_AUTH_ADMIN_2FA_DISABLE_008: 2FA disable without Authorization header → 401", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/disable")
      .send({ twoFactorCode: "123456" });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_2FA_DISABLE_009
  it("TC_AUTH_ADMIN_2FA_DISABLE_009: 2FA disable with unknown fields → 400 (forbidNonWhitelisted)", async () => {
    const res = await api
      .post("/api/v1/auth/admin/2fa/disable")
      .set("Authorization", `Bearer ${noTwoFactorAccessToken}`)
      .send({ twoFactorCode: "123456", extraField: "bad" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_2FA_SETUP_004 (tested here because 2FA is already enabled)
  it("TC_AUTH_ADMIN_2FA_SETUP_004: 2FA setup when 2FA already enabled → 409", async () => {
    // Re-enable 2FA on the admin
    const re = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);
    const key4 = (re.body.data as { manualEntryKey: string }).manualEntryKey;
    const enableCode = speakeasy.totp({ secret: key4, encoding: "base32" });
    await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode: enableCode });

    // Now calling setup again should return 409
    const res = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
  });
});

// ─── Signin 2FA Verify ────────────────────────────────────────────────────────

describe("POST /api/v1/auth/admin/signin/2fa/verify", () => {
  let twoFactorEmail: string;
  let manualEntryKey: string;

  beforeAll(async () => {
    twoFactorEmail = makeEmail("verify-admin");
    const { accessToken } = await signupAndGetTokens(
      "Verify",
      "Admin",
      twoFactorEmail,
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
    await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode: enableCode });
  });

  afterAll(async () => {
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
  });

  async function getChallengeTwoFactorToken(): Promise<string> {
    const res = await api
      .post("/api/v1/auth/admin/signin")
      .send({ email: twoFactorEmail, password: TEST_PASSWORD });
    return (res.body.data as { twoFactorToken: string }).twoFactorToken;
  }

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_001
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_001: Valid twoFactorToken + valid TOTP code → 200", async () => {
    const twoFactorToken = await getChallengeTwoFactorToken();
    const twoFactorCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });

    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .send({ twoFactorToken, twoFactorCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_002
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_002: Verify response contains accessToken and refreshToken → 200", async () => {
    const twoFactorToken = await getChallengeTwoFactorToken();
    const twoFactorCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });

    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .send({ twoFactorToken, twoFactorCode });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(res.body.data.accessToken.length).toBeGreaterThan(0);
    expect(typeof res.body.data.refreshToken).toBe("string");
    expect(res.body.data.refreshToken.length).toBeGreaterThan(0);
  });

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_003
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_003: Invalid twoFactorToken → 401", async () => {
    const twoFactorCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });

    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .send({ twoFactorToken: "invalid.token.value", twoFactorCode });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_004
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_004: Valid token + invalid TOTP code → 401", async () => {
    const twoFactorToken = await getChallengeTwoFactorToken();

    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .send({ twoFactorToken, twoFactorCode: "000000" });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_005
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_005: Missing twoFactorToken field → 400", async () => {
    const twoFactorCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });

    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .send({ twoFactorCode });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_006
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_006: Missing twoFactorCode field → 400", async () => {
    const twoFactorToken = await getChallengeTwoFactorToken();

    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .send({ twoFactorToken });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_007
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_007: Non-numeric twoFactorCode → 400", async () => {
    const twoFactorToken = await getChallengeTwoFactorToken();

    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .send({ twoFactorToken, twoFactorCode: "ABCDEF" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_008
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_008: 5-digit twoFactorCode (too short) → 400", async () => {
    const twoFactorToken = await getChallengeTwoFactorToken();

    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .send({ twoFactorToken, twoFactorCode: "12345" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_009
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_009: Malformed JSON payload → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .set("Content-Type", "application/json")
      .send("{ bad json }");

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_010
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_010: Unknown fields in request body → 400", async () => {
    const twoFactorToken = await getChallengeTwoFactorToken();
    const twoFactorCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });

    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .send({ twoFactorToken, twoFactorCode, extraField: "bad" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_011
  it("TC_AUTH_ADMIN_SIGNIN_2FA_VERIFY_011: Verify response must not expose password field → 200", async () => {
    const twoFactorToken = await getChallengeTwoFactorToken();
    const twoFactorCode = speakeasy.totp({
      secret: manualEntryKey,
      encoding: "base32",
    });

    const res = await api
      .post("/api/v1/auth/admin/signin/2fa/verify")
      .send({ twoFactorToken, twoFactorCode });

    expect(res.status).toBe(200);
    expect(res.body.data?.admin?.password).toBeUndefined();
    expect(res.body.data?.admin?.passwordHash).toBeUndefined();
  });
});
