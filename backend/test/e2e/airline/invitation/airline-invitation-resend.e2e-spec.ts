import { api } from "../../../helpers/http-client.helper";
import { endPool, query } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { insertActiveAdmin } from "../../../seeders/admin.seeder";
import {
  deleteInvitationDataByPattern,
  grantInvitePermission,
  getLatestInvitationIdByAdminEmail,
  setInvitationStatus,
} from "../../../seeders/airline-invitation.seeder";
import { validInvitePayload } from "../../../fixtures/airline-invitation.fixture";
import { getAdminTokens } from "../../../helpers/auth.helper";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const EMAIL_PATTERN = "%@e2e-airline.test";
const INVITE_PATTERN = "E2E%";
const TEST_PASSWORD = "Password@123";

async function makeAdminToken(
  role: "SUPER_ADMIN" | "STAFF",
  withEdit = false,
): Promise<string> {
  const email = `${role.toLowerCase()}-${Date.now()}@e2e-airline.test`;
  const admin = await insertActiveAdmin({
    email,
    password: TEST_PASSWORD,
    role,
  });
  if (withEdit) {
    await grantInvitePermission(admin.id, "EDIT");
  }
  return (await getAdminTokens(email, TEST_PASSWORD)).accessToken;
}

describe("POST /api/v1/airline/invitations/:invitationId/resend", () => {
  let superToken = "";
  let staffEditToken = "";

  beforeAll(async () => {
    superToken = await makeAdminToken("SUPER_ADMIN");
    staffEditToken = await makeAdminToken("STAFF", true);
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  async function createInviteAndGetId(): Promise<number> {
    const payload = validInvitePayload();
    const createRes = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(payload);

    expect(createRes.status).toBe(201);
    const invitationId = await getLatestInvitationIdByAdminEmail(
      payload.adminEmail,
    );
    return invitationId as number;
  }

  it("TC_AIRLINE_INVITATION_RESEND_001: Resend pending invitation by Super Admin with valid invitationId, expected 200", async () => {
    const invitationId = await createInviteAndGetId();

    const res = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("TC_AIRLINE_INVITATION_RESEND_002: Resend pending invitation by Staff with EDIT access, expected 200", async () => {
    const invitationId = await createInviteAndGetId();

    const res = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set("Authorization", `Bearer ${staffEditToken}`);

    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_RESEND_003/004: Resend expired or revoked invitation by Super Admin, expected 200", async () => {
    const expiredId = await createInviteAndGetId();
    await setInvitationStatus(expiredId, "PENDING", {
      expiresAt: new Date(Date.now() - 60_000),
    });

    const expiredRes = await api
      .post(`/api/v1/airline/invitations/${expiredId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(expiredRes.status).toBe(200);

    const revokedId = await createInviteAndGetId();
    await setInvitationStatus(revokedId, "REVOKED", { revokedAt: new Date() });

    const revokedRes = await api
      .post(`/api/v1/airline/invitations/${revokedId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(revokedRes.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_RESEND_005/006/007: Missing, invalid, expired token auth failures", async () => {
    const invitationId = await createInviteAndGetId();

    const noAuth = await api.post(
      `/api/v1/airline/invitations/${invitationId}/resend`,
    );
    expect(noAuth.status).toBe(401);

    const invalid = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set("Authorization", "Bearer invalid.token");
    expect(invalid.status).toBe(401);

    const expired = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set(
        "Authorization",
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDF9.x",
      );
    expect(expired.status).toBe(401);
  });

  it("TC_AIRLINE_INVITATION_RESEND_012: Resend non-existing invitationId, expected 404", async () => {
    const res = await api
      .post("/api/v1/airline/invitations/999999999/resend")
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(404);
  });

  it("TC_AIRLINE_INVITATION_RESEND_013: Resend accepted invitation, expected 409", async () => {
    const invitationId = await createInviteAndGetId();
    await setInvitationStatus(invitationId, "ACCEPTED", {
      acceptedAt: new Date(),
    });

    const res = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(409);
  });

  it("TC_AIRLINE_INVITATION_RESEND_014/015/016/017: Invalid invitationId path values, expected 400", async () => {
    const badIds = ["0", "-1", "abc", "1.5"];
    for (const id of badIds) {
      const res = await api
        .post(`/api/v1/airline/invitations/${id}/resend`)
        .set("Authorization", `Bearer ${superToken}`);
      expect(res.status).toBe(400);
    }
  });

  it("TC_AIRLINE_INVITATION_RESEND_019..025: Response contains contract fields and token parameter", async () => {
    const invitationId = await createInviteAndGetId();

    const first = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);

    expect(first.status).toBe(200);
    expect(first.body.data.invitationId).toBe(invitationId);
    expect(typeof first.body.data.expiresIn).toBe("string");
    expect(first.body.data.onboardingLink).toContain("token=");

    const token1 = new URL(first.body.data.onboardingLink).searchParams.get(
      "token",
    );

    const second = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);

    expect(second.status).toBe(200);
    const token2 = new URL(second.body.data.onboardingLink).searchParams.get(
      "token",
    );
    expect(token2).not.toBe(token1);
  });

  it("TC_AIRLINE_INVITATION_RESEND_008..011: remaining authorization matrix", async () => {
    const invitationId = await createInviteAndGetId();

    // TC_008: Inactive admin — get token before deactivating
    const inactiveEmail = `resend-inactive-${Date.now()}@e2e-airline.test`;
    await insertActiveAdmin({
      email: inactiveEmail,
      password: TEST_PASSWORD,
      role: "SUPER_ADMIN",
    });
    const inactiveToken = (
      await getAdminTokens(inactiveEmail, TEST_PASSWORD)
    ).accessToken;
    await query("UPDATE admins SET is_active = false WHERE email = $1", [
      inactiveEmail,
    ]);
    const inactiveRes = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set("Authorization", `Bearer ${inactiveToken}`);
    expect([401, 403]).toContain(inactiveRes.status);

    // TC_009: STAFF with VIEW-only (no EDIT) → 403
    const viewOnlyEmail = `resend-view-only-${Date.now()}@e2e-airline.test`;
    const viewOnlyAdmin = await insertActiveAdmin({
      email: viewOnlyEmail,
      password: TEST_PASSWORD,
      role: "STAFF",
    });
    await grantInvitePermission(viewOnlyAdmin.id, "VIEW");
    const viewOnlyToken = (
      await getAdminTokens(viewOnlyEmail, TEST_PASSWORD)
    ).accessToken;
    const viewOnlyRes = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set("Authorization", `Bearer ${viewOnlyToken}`);
    expect(viewOnlyRes.status).toBe(403);

    // TC_010: STAFF with no permissions → 403
    const noPermEmail = `resend-no-perm-${Date.now()}@e2e-airline.test`;
    await insertActiveAdmin({
      email: noPermEmail,
      password: TEST_PASSWORD,
      role: "STAFF",
    });
    const noPermToken = (
      await getAdminTokens(noPermEmail, TEST_PASSWORD)
    ).accessToken;
    const noPermRes = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set("Authorization", `Bearer ${noPermToken}`);
    expect(noPermRes.status).toBe(403);

    // TC_011: SUPER_ADMIN remains authorized
    const superRes = await api
      .post(`/api/v1/airline/invitations/${invitationId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(superRes.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_RESEND_018: Extremely large invitationId not found", async () => {
    const res = await api
      .post("/api/v1/airline/invitations/9999999999/resend")
      .set("Authorization", `Bearer ${superToken}`);
    expect([400, 404]).toContain(res.status);
  });

  it("TC_AIRLINE_INVITATION_RESEND_026..035: business logic, token rotation, and security checks", async () => {
    // TC_026/027: token rotates on each resend — old token must be invalidated
    const invId = await createInviteAndGetId();
    const firstResend = await api
      .post(`/api/v1/airline/invitations/${invId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(firstResend.status).toBe(200);
    const oldToken = new URL(
      firstResend.body.data.onboardingLink as string,
    ).searchParams.get("token");

    const secondResend = await api
      .post(`/api/v1/airline/invitations/${invId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(secondResend.status).toBe(200);
    const newToken = new URL(
      secondResend.body.data.onboardingLink as string,
    ).searchParams.get("token");
    expect(newToken).not.toBe(oldToken);

    // Old token should be rejected for onboarding
    const oldOnboard = await api
      .post("/api/v1/auth/airline/onboard")
      .send({ invitationToken: oldToken, password: TEST_PASSWORD });
    expect([401, 409]).toContain(oldOnboard.status);

    // TC_028/029: resend of revoked invitation → status returns to PENDING
    const revokedId = await createInviteAndGetId();
    await setInvitationStatus(revokedId, "REVOKED", { revokedAt: new Date() });
    const resendRevokedRes = await api
      .post(`/api/v1/airline/invitations/${revokedId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(resendRevokedRes.status).toBe(200);
    const detailAfterResend = await api
      .get(`/api/v1/airline/invitations/${revokedId}`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(detailAfterResend.body.data.status).toBe("PENDING");

    // TC_030: expiresAt should be refreshed (future date) after resend
    expect(
      new Date(detailAfterResend.body.data.expiresAt).getTime(),
    ).toBeGreaterThan(Date.now());

    // TC_031: SQL injection in path param → 400
    const sqli = await api
      .post("/api/v1/airline/invitations/1;DROP TABLE admins--/resend")
      .set("Authorization", `Bearer ${superToken}`);
    expect(sqli.status).toBe(400);

    // TC_032: Script injection in path param → 400
    const script = await api
      .post(
        "/api/v1/airline/invitations/%3Cscript%3Ealert(1)%3C%2Fscript%3E/resend",
      )
      .set("Authorization", `Bearer ${superToken}`);
    expect(script.status).toBe(400);

    // TC_033: Wrong HTTP method on resend endpoint → 404 or 405
    const wrongMethod = await api
      .get(`/api/v1/airline/invitations/${invId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);
    expect([404, 405]).toContain(wrongMethod.status);

    // TC_034: Malformed Authorization header (no Bearer prefix) → 401
    const malformedAuth = await api
      .post(`/api/v1/airline/invitations/${invId}/resend`)
      .set("Authorization", "Token somevalue");
    expect(malformedAuth.status).toBe(401);

    // TC_035: STAFF with EDIT can resend same invitation as SUPER_ADMIN created
    const anotherInvId = await createInviteAndGetId();
    const staffRes = await api
      .post(`/api/v1/airline/invitations/${anotherInvId}/resend`)
      .set("Authorization", `Bearer ${staffEditToken}`);
    expect(staffRes.status).toBe(200);
  });

  it.todo(
    "TC_AIRLINE_INVITATION_RESEND_036..037: concurrent resend edge cases and idempotency",
  );

  it("TC_AIRLINE_INVITATION_RESEND_038..041: response metadata and message assertions", async () => {
    const invId = await createInviteAndGetId();
    const res = await api
      .post(`/api/v1/airline/invitations/${invId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.requestId).toBe("string");
    expect(typeof res.body.timestamp).toBe("string");
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message.length).toBeGreaterThan(0);
    expect(res.body.data.invitationId).toBe(invId);
    expect(typeof res.body.data.expiresIn).toBe("string");
    expect(typeof res.body.data.onboardingLink).toBe("string");
  });
});
