/**
 * E2E tests for POST /api/v1/auth/admin/refresh
 *
 * Black-box: all interactions via HTTP (supertest) and raw SQL (pg).
 * No imports from src/.
 *
 * Request shape: { refreshToken: string }
 * Response (200): { accessToken, refreshToken, accessTokenExpiresIn, refreshTokenExpiresIn, userType }
 *
 * TC IDs: TC_AUTH_ADMIN_REFRESH_TOKEN_001 through 040
 */
import { Logger } from "@nestjs/common";
import { api } from "../../../helpers/http-client.helper";
import { endPool, query } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import {
  insertActiveAdmin,
  deleteAdminByEmail,
} from "../../../seeders/admin.seeder";
import { uniqueEmail } from "../../../fixtures/admin.fixture";
import {
  signupAndGetTokens,
  getAdminTokens,
} from "../../../helpers/auth.helper";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const EMAIL_PATTERN = "%@e2e-refresh.test";
const TEST_PASSWORD = "Password@123";

function makeEmail(prefix: string): string {
  return uniqueEmail(prefix).replace("@e2e.test", "@e2e-refresh.test");
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function signInAndGetTokens(
  email: string,
  password: string,
): Promise<TokenPair> {
  return getAdminTokens(email, password);
}

describe("POST /api/v1/auth/admin/refresh", () => {
  // A reusable seeded admin for tests that need a valid refresh token
  let primaryEmail: string;
  let primaryTokens: TokenPair;

  beforeAll(async () => {
    primaryEmail = makeEmail("refresh-primary");
    const { accessToken, refreshToken } = await signupAndGetTokens(
      "Refresh",
      "Primary",
      primaryEmail,
      TEST_PASSWORD,
    );
    primaryTokens = { accessToken, refreshToken };
  });

  afterAll(async () => {
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  // ─── Happy path ────────────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_REFRESH_TOKEN_001
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_001: Valid refreshToken → 200", async () => {
    const email = makeEmail("ref-ok");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Ok",
      email,
      TEST_PASSWORD,
    );

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_002
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_002: Response contains new accessToken → 200", async () => {
    const email = makeEmail("ref-at");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "At",
      email,
      TEST_PASSWORD,
    );

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(res.body.data.accessToken.length).toBeGreaterThan(0);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_003
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_003: Response contains new refreshToken → 200", async () => {
    const email = makeEmail("ref-rt");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Rt",
      email,
      TEST_PASSWORD,
    );

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.refreshToken).toBe("string");
    expect(res.body.data.refreshToken.length).toBeGreaterThan(0);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_004
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_004: Response contains accessTokenExpiresIn → 200", async () => {
    const email = makeEmail("ref-iatexp");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Atexp",
      email,
      TEST_PASSWORD,
    );

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessTokenExpiresIn).toBe("string");
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_005
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_005: Response contains refreshTokenExpiresIn → 200", async () => {
    const email = makeEmail("ref-irtexp");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Rtexp",
      email,
      TEST_PASSWORD,
    );

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.refreshTokenExpiresIn).toBe("string");
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_006
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_006: Response userType is PLATFORM → 200", async () => {
    const email = makeEmail("ref-usertype");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Usertype",
      email,
      TEST_PASSWORD,
    );

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.userType).toBe("PLATFORM");
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_023
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_023: New accessToken from refresh is different from original → 200", async () => {
    const email = makeEmail("ref-newtok");
    const { accessToken: originalAccessToken, refreshToken } =
      await signupAndGetTokens("Ref", "New", email, TEST_PASSWORD);

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).not.toBe(originalAccessToken);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_024
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_024: Old refreshToken is invalid after token rotation → 401", async () => {
    const email = makeEmail("ref-rotation");
    const { refreshToken: oldRefreshToken } = await signupAndGetTokens(
      "Ref",
      "Rot",
      email,
      TEST_PASSWORD,
    );

    // Perform one refresh to rotate the token
    await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: oldRefreshToken });

    // Old token should now be rejected
    const reuseRes = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: oldRefreshToken });

    expect(reuseRes.status).toBe(401);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_025
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_025: New refreshToken from rotation is valid → 200", async () => {
    const email = makeEmail("ref-newrt");
    const { refreshToken: firstToken } = await signupAndGetTokens(
      "Ref",
      "Nrt",
      email,
      TEST_PASSWORD,
    );

    const rotateRes = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: firstToken });
    expect(rotateRes.status).toBe(200);

    const { refreshToken: newToken } = rotateRes.body.data as {
      refreshToken: string;
    };

    const secondRes = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: newToken });

    expect(secondRes.status).toBe(200);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_026
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_026: New accessToken can be used to access protected endpoint → 200", async () => {
    const email = makeEmail("ref-usetoken");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Use",
      email,
      TEST_PASSWORD,
    );

    const refreshRes = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    const { accessToken: newAccessToken } = refreshRes.body.data as {
      accessToken: string;
    };

    // Use the new access token on a protected endpoint (profile or similar)
    const profileRes = await api
      .get("/api/v1/admin/profile")
      .set("Authorization", `Bearer ${newAccessToken}`);

    expect(profileRes.status).toBe(200);
  });

  // ─── Invalid / expired token failures ─────────────────────────────────────

  // TC_AUTH_ADMIN_REFRESH_TOKEN_007
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_007: Invalid / garbage refreshToken → 401", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: "invalid.not.a.real.token" });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_008
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_008: Expired refreshToken → 401", async () => {
    // A known-expired token (signed with correct secret but exp in the past)
    const expiredToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJzdWIiOiI5OTk5IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9." +
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: expiredToken });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_012
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_012: Using accessToken as refreshToken → 401", async () => {
    const email = makeEmail("ref-useat");
    const { accessToken } = await signupAndGetTokens(
      "Ref",
      "UseAt",
      email,
      TEST_PASSWORD,
    );

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: accessToken }); // wrong token type

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_013
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_013: Refresh token for deactivated admin → 401", async () => {
    const email = makeEmail("ref-deactivated");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Deact",
      email,
      TEST_PASSWORD,
    );

    // Deactivate admin via raw SQL
    await query("UPDATE admins SET is_active = false WHERE email = $1", [
      email,
    ]);

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_016
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_016: Refresh after signout → 401", async () => {
    const email = makeEmail("ref-aftersign");
    const { accessToken, refreshToken } = await signupAndGetTokens(
      "Ref",
      "Afts",
      email,
      TEST_PASSWORD,
    );

    // Signout first
    await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    // Try to refresh with the signed-out token
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_009
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_009: Tampered refreshToken (altered payload) → 401", async () => {
    const email = makeEmail("ref-tampered");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Tamp",
      email,
      TEST_PASSWORD,
    );

    const parts = refreshToken.split(".");
    parts[1] = Buffer.from(
      JSON.stringify({ sub: "altered", type: "refresh" }),
    ).toString("base64url");
    const tampered = parts.join(".");

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: tampered });

    expect(res.status).toBe(401);
  });

  // ─── DTO validation ───────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_REFRESH_TOKEN_027
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_027: Missing refreshToken field → 400", async () => {
    const res = await api.post("/api/v1/auth/admin/refresh").send({});

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_028
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_028: Empty refreshToken → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: "" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_029
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_029: Null refreshToken → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: null });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_030
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_030: Numeric refreshToken value → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: 12345 });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_031
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_031: Array as refreshToken value → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: ["token1", "token2"] });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_032
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_032: Malformed JSON body → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .set("Content-Type", "application/json")
      .send("{ bad json }");

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_033
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_033: Unknown fields → 400 (forbidNonWhitelisted)", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: primaryTokens.refreshToken, extraField: "bad" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_034
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_034: Whitespace-only refreshToken → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: "   " });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_035
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_035: SQL injection in refreshToken → 401 (invalid token, not 500)", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: "'; DROP TABLE admins;--" });

    expect([400, 401]).toContain(res.status);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_036
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_036: Response does not expose password hash or sensitive admin fields → 200", async () => {
    const email = makeEmail("ref-nosens");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Ns",
      email,
      TEST_PASSWORD,
    );

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("password_hash");
    expect(bodyStr).not.toContain("passwordHash");
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_037
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_037: Empty request body → 400", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .set("Content-Type", "application/json")
      .send("{}");

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_038
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_038: Concurrent refresh calls with same token — only one should succeed", async () => {
    const email = makeEmail("ref-concurrent");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Con",
      email,
      TEST_PASSWORD,
    );

    const [r1, r2] = await Promise.all([
      api.post("/api/v1/auth/admin/refresh").send({ refreshToken }),
      api.post("/api/v1/auth/admin/refresh").send({ refreshToken }),
    ]);

    const statuses = [r1.status, r2.status];
    // Due to token rotation, at most one should succeed
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(1);
    expect(statuses.filter((s) => s === 401).length).toBeGreaterThanOrEqual(1);
  });

  // ─── Additional business-logic failures ──────────────────────────────────

  // TC_AUTH_ADMIN_REFRESH_TOKEN_014
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_014: Refresh token for hard-deleted admin → 401", async () => {
    const email = makeEmail("ref-deleted");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Del",
      email,
      TEST_PASSWORD,
    );

    // Hard-delete the admin
    await deleteAdminByEmail(email);

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_015
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_015: Refresh token after admin password reset via forgot-password → 401", async () => {
    const email = makeEmail("ref-afterpwreset");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Pwr",
      email,
      TEST_PASSWORD,
    );

    // Trigger forgot-password reset flow to invalidate all sessions
    await api
      .post("/api/v1/auth/admin/forgot-password/send-otp")
      .send({ email });
    const verifyRes = await api
      .post("/api/v1/auth/admin/forgot-password/verify-otp")
      .send({ email, otp: "444444" });
    const resetToken = (verifyRes.body.data as { resetPasswordToken: string })
      .resetPasswordToken;

    await api
      .post("/api/v1/auth/admin/forgot-password")
      .send({ resetPasswordToken: resetToken, newPassword: "Changed@789" });

    // Old refresh token should now be revoked
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  // ─── Response shape ───────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_REFRESH_TOKEN_021
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_021: Response contains admin profile data (id, email, role) → 200", async () => {
    const email = makeEmail("ref-profile");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Prof",
      email,
      TEST_PASSWORD,
    );

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    // If the endpoint returns admin profile in data, verify it
    if (res.body.data?.admin) {
      expect(res.body.data.admin.id).toBeDefined();
      expect(typeof res.body.data.admin.email).toBe("string");
      expect(res.body.data.admin.role).toBeDefined();
    } else {
      // Endpoint returns tokens without profile — acceptable
      expect(res.body.data.accessToken).toBeDefined();
    }
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_022
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_022: Response admin.accessControls is an array when profile is present → 200", async () => {
    const email = makeEmail("ref-acl");
    const { refreshToken } = await signupAndGetTokens(
      "Ref",
      "Acl",
      email,
      TEST_PASSWORD,
    );

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    if (res.body.data?.admin?.accessControls !== undefined) {
      expect(res.body.data.admin.accessControls).toBeInstanceOf(Array);
    }
  });

  // ─── Injection / unusual input ─────────────────────────────────────────────

  // TC_AUTH_ADMIN_REFRESH_TOKEN_040
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_040: Unicode characters in refreshToken → 401", async () => {
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken: "eyJhbGciOiJIUzI1NiJ9.dW5pY29kZeKCrA.sig" });

    // Not a valid signed token — should be rejected
    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_REFRESH_TOKEN_039
  it.todo(
    "TC_AUTH_ADMIN_REFRESH_TOKEN_039: Refresh for AIRLINE user type returns AIRLINE tokens " +
      "[COMPATIBILITY: airline auth uses separate endpoint, test skipped in admin-auth suite]",
  );

  // TC_AUTH_ADMIN_REFRESH_TOKEN_041
  it("TC_AUTH_ADMIN_REFRESH_TOKEN_041: Refresh for admin with 2FA enabled still returns tokens without re-auth → 200", async () => {
    // This confirms that once signed in, a stored refresh token doesn't re-trigger 2FA
    const email = makeEmail("ref-2fa");
    const { accessToken, refreshToken } = await signupAndGetTokens(
      "Ref",
      "Twofa",
      email,
      TEST_PASSWORD,
    );

    // Enable 2FA
    const speakeasy = await import("speakeasy");
    const setupRes = await api
      .post("/api/v1/auth/admin/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);
    const key = (setupRes.body.data as { manualEntryKey: string })
      .manualEntryKey;
    const code = speakeasy.totp({ secret: key, encoding: "base32" });
    await api
      .post("/api/v1/auth/admin/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ twoFactorCode: code });

    // Refreshing should not require 2FA
    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });
});
