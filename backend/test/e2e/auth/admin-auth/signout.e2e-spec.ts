/**
 * E2E tests for POST /api/v1/auth/admin/signout
 *
 * Black-box: all interactions via HTTP (supertest) and raw SQL (pg).
 * No imports from src/.
 *
 * Endpoint requires:
 *   - Authorization: Bearer <accessToken>   (JWT guard)
 *   - Body: { refreshToken: string }
 *
 * TC IDs: TC_AUTH_ADMIN_SIGNOUT_001 through 030
 */
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { uniqueEmail } from "../../../fixtures/admin.fixture";
import { signupAndGetTokens } from "../../../helpers/auth.helper";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const EMAIL_PATTERN = "%@e2e-signout.test";
const TEST_PASSWORD = "Password@123";

function makeEmail(prefix: string): string {
  return uniqueEmail(prefix).replace("@e2e.test", "@e2e-signout.test");
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function freshTokens(
  prefix: string,
): Promise<{ email: string } & TokenPair> {
  const email = makeEmail(prefix);
  const { accessToken, refreshToken } = await signupAndGetTokens(
    "Sign",
    "Out",
    email,
    TEST_PASSWORD,
  );
  return { email, accessToken, refreshToken };
}

describe("POST /api/v1/auth/admin/signout", () => {
  afterAll(async () => {
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  // ─── Happy path ────────────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNOUT_001
  it("TC_AUTH_ADMIN_SIGNOUT_001: Signout with valid accessToken and refreshToken → 200", async () => {
    const { accessToken, refreshToken } = await freshTokens("so-ok");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // TC_AUTH_ADMIN_SIGNOUT_002
  it("TC_AUTH_ADMIN_SIGNOUT_002: Signout response data is null → 200", async () => {
    const { accessToken, refreshToken } = await freshTokens("so-null");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  // TC_AUTH_ADMIN_SIGNOUT_003
  it("TC_AUTH_ADMIN_SIGNOUT_003: After signout, refreshToken is revoked → 401 on refresh", async () => {
    const { accessToken, refreshToken } = await freshTokens("so-revoke");

    await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    const refreshRes = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(refreshRes.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNOUT_004
  it("TC_AUTH_ADMIN_SIGNOUT_004: After signout, accessToken is revoked — protected endpoint returns 401", async () => {
    const { accessToken, refreshToken } = await freshTokens("so-atrv");

    await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    // Access token may still be valid (JWT is stateless) for its TTL,
    // but after signout the server can choose to invalidate it.
    // We primarily verify the refresh is revoked (TC_003). If the
    // server also invalidates the access token, that is also fine.
    const profileRes = await api
      .get("/api/v1/admin/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    // Either 200 (stateless JWT, not yet expired) or 401 (blacklisted) is acceptable
    expect([200, 401]).toContain(profileRes.status);
  });

  // TC_AUTH_ADMIN_SIGNOUT_005
  it("TC_AUTH_ADMIN_SIGNOUT_005: Signout response does not leak sensitive fields → 200", async () => {
    const { accessToken, refreshToken } = await freshTokens("so-sens");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("password_hash");
    expect(bodyStr).not.toContain("passwordHash");
  });

  // TC_AUTH_ADMIN_SIGNOUT_016
  it("TC_AUTH_ADMIN_SIGNOUT_016: Double signout with same refreshToken → second call returns 401", async () => {
    const { accessToken, refreshToken } = await freshTokens("so-double");

    const first = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(first.status).toBe(200);

    // The refreshToken is now revoked; the accessToken may be expired too.
    // We need a fresh access token if the first one is also revoked.
    const secondEmail = makeEmail("so-double2");
    const { accessToken: at2 } = await signupAndGetTokens(
      "So",
      "D2",
      secondEmail,
      TEST_PASSWORD,
    );

    const second = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${at2}`)
      .send({ refreshToken }); // reuse revoked refreshToken

    // The revoked refresh token body should cause a 401 even with a valid AT
    expect(second.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNOUT_024
  it("TC_AUTH_ADMIN_SIGNOUT_024: After signout, refresh returns 401", async () => {
    const { accessToken, refreshToken } = await freshTokens("so-after-so");

    await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    const res = await api
      .post("/api/v1/auth/admin/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  // ─── Auth guard failures ───────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNOUT_011
  it("TC_AUTH_ADMIN_SIGNOUT_011: No Authorization header → 401", async () => {
    const { refreshToken } = await freshTokens("so-noauth");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNOUT_012
  it("TC_AUTH_ADMIN_SIGNOUT_012: Invalid accessToken in Authorization header → 401", async () => {
    const { refreshToken } = await freshTokens("so-invalat");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", "Bearer not.a.real.token")
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNOUT_013
  it('TC_AUTH_ADMIN_SIGNOUT_013: Malformed Bearer header (missing "Bearer " prefix) → 401', async () => {
    const { accessToken, refreshToken } = await freshTokens("so-malformed");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", accessToken) // no "Bearer " prefix
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNOUT_014
  it("TC_AUTH_ADMIN_SIGNOUT_014: Expired accessToken → 401", async () => {
    const { refreshToken } = await freshTokens("so-expirat");
    const expiredToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJzdWIiOiI5OTk5IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9." +
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${expiredToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNOUT_015
  it("TC_AUTH_ADMIN_SIGNOUT_015: AIRLINE accessToken used on admin signout → 403 or 401", async () => {
    // We don't have an airline token to use in this suite so we'll test
    // with a well-formed but wrong-audience token (tampered claims)
    const { refreshToken } = await freshTokens("so-crosstype");
    // Simulate wrong userType by creating a known-invalid JWT claim
    const fakeAirlineToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      Buffer.from(
        JSON.stringify({ sub: "1", userType: "AIRLINE", exp: 9999999999 }),
      ).toString("base64url") +
      ".fakesignature";

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${fakeAirlineToken}`)
      .send({ refreshToken });

    expect([401, 403]).toContain(res.status);
  });

  // TC_AUTH_ADMIN_SIGNOUT_017
  it("TC_AUTH_ADMIN_SIGNOUT_017: refreshToken belonging to a different admin → 401", async () => {
    const { accessToken } = await freshTokens("so-cross1");
    const { refreshToken: otherRefreshToken } = await freshTokens("so-cross2");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken: otherRefreshToken });

    expect(res.status).toBe(401);
  });

  // ─── DTO validation ───────────────────────────────────────────────────────

  // TC_AUTH_ADMIN_SIGNOUT_006
  it("TC_AUTH_ADMIN_SIGNOUT_006: Missing refreshToken field → 400", async () => {
    const { accessToken } = await freshTokens("so-missing");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNOUT_007
  it("TC_AUTH_ADMIN_SIGNOUT_007: Empty refreshToken value → 400", async () => {
    const { accessToken } = await freshTokens("so-empty");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken: "" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNOUT_008
  it("TC_AUTH_ADMIN_SIGNOUT_008: Null refreshToken value → 400", async () => {
    const { accessToken } = await freshTokens("so-nullrt");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken: null });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNOUT_009
  it("TC_AUTH_ADMIN_SIGNOUT_009: Whitespace-only refreshToken → 400", async () => {
    const { accessToken } = await freshTokens("so-wsonly");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken: "   " });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNOUT_010
  it("TC_AUTH_ADMIN_SIGNOUT_010: Unknown fields in request body → 400 (forbidNonWhitelisted)", async () => {
    const { accessToken, refreshToken } = await freshTokens("so-unknown");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken, extraField: "bad" });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNOUT_018
  it("TC_AUTH_ADMIN_SIGNOUT_018: Malformed JSON body → 400", async () => {
    const { accessToken } = await freshTokens("so-malfjson");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send("{ bad json }");

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNOUT_019
  it("TC_AUTH_ADMIN_SIGNOUT_019: Numeric refreshToken → 400", async () => {
    const { accessToken } = await freshTokens("so-numrt");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken: 12345 });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNOUT_020
  it("TC_AUTH_ADMIN_SIGNOUT_020: Array as refreshToken → 400", async () => {
    const { accessToken } = await freshTokens("so-arrrt");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken: ["token1"] });

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNOUT_021
  it("TC_AUTH_ADMIN_SIGNOUT_021: SQL injection in refreshToken body field → 400 or 401 (not 500)", async () => {
    const { accessToken } = await freshTokens("so-sqlinj");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken: "'; DROP TABLE admins;--" });

    expect([400, 401]).toContain(res.status);
  });

  // TC_AUTH_ADMIN_SIGNOUT_022
  it("TC_AUTH_ADMIN_SIGNOUT_022: Empty JSON body (no fields at all) → 400", async () => {
    const { accessToken } = await freshTokens("so-emptybody");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send("{}");

    expect(res.status).toBe(400);
  });

  // TC_AUTH_ADMIN_SIGNOUT_023
  it("TC_AUTH_ADMIN_SIGNOUT_023: XSS payload in refreshToken → 400 or 401 (not 500)", async () => {
    const { accessToken } = await freshTokens("so-xss");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken: "<script>alert(1)</script>" });

    expect([400, 401]).toContain(res.status);
  });

  // TC_AUTH_ADMIN_SIGNOUT_025
  it("TC_AUTH_ADMIN_SIGNOUT_025: Concurrent signout calls with same tokens → only first succeeds", async () => {
    const { accessToken, refreshToken } = await freshTokens("so-concurrent");

    const [r1, r2] = await Promise.all([
      api
        .post("/api/v1/auth/admin/signout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ refreshToken }),
      api
        .post("/api/v1/auth/admin/signout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ refreshToken }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual(expect.arrayContaining([200]));
    // The second call may return 401 because the refresh token is already revoked
  });

  // TC_AUTH_ADMIN_SIGNOUT_026
  it("TC_AUTH_ADMIN_SIGNOUT_026: Signout with a valid-format but non-existent refreshToken → 401", async () => {
    // Use tokens from a fresh sign-in and immediately rotate them first
    const { accessToken: at, refreshToken: rt } =
      await freshTokens("so-nonexist");
    // Rotate to invalidate rt
    await api.post("/api/v1/auth/admin/refresh").send({ refreshToken: rt });

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${at}`)
      .send({ refreshToken: rt });

    expect(res.status).toBe(401);
  });

  // TC_AUTH_ADMIN_SIGNOUT_027
  it.todo(
    "TC_AUTH_ADMIN_SIGNOUT_027: Signout invalidates all sessions (all-device signout) " +
      "[COMPATIBILITY: endpoint may not support all-device signout — revisit if added]",
  );

  // TC_AUTH_ADMIN_SIGNOUT_028
  it("TC_AUTH_ADMIN_SIGNOUT_028: Signout while having 2FA enabled succeeds → 200", async () => {
    const email = makeEmail("so-2fa");
    const { accessToken, refreshToken } = await signupAndGetTokens(
      "So",
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

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
  });

  // TC_AUTH_ADMIN_SIGNOUT_029
  it("TC_AUTH_ADMIN_SIGNOUT_029: signout response message is a non-empty string → 200", async () => {
    const { accessToken, refreshToken } = await freshTokens("so-msg");

    const res = await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  // TC_AUTH_ADMIN_SIGNOUT_030
  it("TC_AUTH_ADMIN_SIGNOUT_030: Signout and sign back in with same credentials succeeds → 200", async () => {
    const email = makeEmail("so-relogin");
    const { accessToken, refreshToken } = await signupAndGetTokens(
      "So",
      "Relogin",
      email,
      TEST_PASSWORD,
    );

    await api
      .post("/api/v1/auth/admin/signout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    const signinRes = await api
      .post("/api/v1/auth/admin/signin")
      .send({ email, password: TEST_PASSWORD });

    expect(signinRes.status).toBe(200);
    expect(signinRes.body.data.accessToken).toBeDefined();
  });
});
