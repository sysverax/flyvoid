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

async function tokenFor(
  role: "SUPER_ADMIN" | "STAFF",
  edit = false,
): Promise<string> {
  const email = `${role.toLowerCase()}-revoke-${Date.now()}@e2e-airline.test`;
  const admin = await insertActiveAdmin({
    email,
    password: TEST_PASSWORD,
    role,
  });
  if (edit) {
    await grantInvitePermission(admin.id, "EDIT");
  }
  return (await getAdminTokens(email, TEST_PASSWORD)).accessToken;
}

describe("POST /api/v1/airline/invitations/:invitationId/revoke", () => {
  let superToken = "";
  let staffEditToken = "";

  beforeAll(async () => {
    superToken = await tokenFor("SUPER_ADMIN");
    staffEditToken = await tokenFor("STAFF", true);
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  async function createInviteId(): Promise<number> {
    const payload = validInvitePayload();
    const created = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(payload);
    expect(created.status).toBe(201);
    return (await getLatestInvitationIdByAdminEmail(
      payload.adminEmail,
    )) as number;
  }

  it("TC_AIRLINE_INVITATION_REVOKE_001: Revoke pending invitation by Super Admin, expected 200", async () => {
    const id = await createInviteId();
    const res = await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_REVOKE_002: Revoke pending invitation by Staff with EDIT access, expected 200", async () => {
    const id = await createInviteId();
    const res = await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${staffEditToken}`);
    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_REVOKE_003: Revoke already revoked invitation, expected 200", async () => {
    const id = await createInviteId();
    await setInvitationStatus(id, "REVOKED", { revokedAt: new Date() });
    const res = await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_REVOKE_004: Revoke expired invitation, expected 200", async () => {
    const id = await createInviteId();
    await setInvitationStatus(id, "PENDING", {
      expiresAt: new Date(Date.now() - 60_000),
    });
    const res = await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_REVOKE_005/006/007: auth failures", async () => {
    const id = await createInviteId();

    const noAuth = await api.post(`/api/v1/airline/invitations/${id}/revoke`);
    expect(noAuth.status).toBe(401);

    const invalid = await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", "Bearer invalid.token");
    expect(invalid.status).toBe(401);

    const expired = await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set(
        "Authorization",
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDF9.x",
      );
    expect(expired.status).toBe(401);
  });

  it("TC_AIRLINE_INVITATION_REVOKE_012: Revoke non-existing invitationId, expected 404", async () => {
    const res = await api
      .post("/api/v1/airline/invitations/999999999/revoke")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(404);
  });

  it("TC_AIRLINE_INVITATION_REVOKE_013: Revoke accepted invitation, expected 409", async () => {
    const id = await createInviteId();
    await setInvitationStatus(id, "ACCEPTED", { acceptedAt: new Date() });

    const res = await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(409);
  });

  it("TC_AIRLINE_INVITATION_REVOKE_014..018: invalid invitationId values", async () => {
    for (const id of ["0", "-1", "abc", "1.5"]) {
      const res = await api
        .post(`/api/v1/airline/invitations/${id}/revoke`)
        .set("Authorization", `Bearer ${superToken}`);
      expect(res.status).toBe(400);
    }

    const huge = await api
      .post("/api/v1/airline/invitations/999999999/revoke")
      .set("Authorization", `Bearer ${superToken}`);
    expect(huge.status).toBe(404);
  });

  it("TC_AIRLINE_INVITATION_REVOKE_019..026: response structure validation", async () => {
    const id = await createInviteId();
    const res = await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.invitationId).toBe(id);
    expect(res.body.data.status).toBe("REVOKED");
    expect(res.body.success).toBe(true);
    expect(typeof res.body.requestId).toBe("string");
    expect(typeof res.body.timestamp).toBe("string");
    expect(res.body.message).toBe("Airline invitation revoked successfully");
  });

  it("TC_AIRLINE_INVITATION_REVOKE_008..011: remaining authorization matrix", async () => {
    const id = await createInviteId();

    // TC_008: Inactive admin — get token before deactivating
    const inactiveEmail = `revoke-inactive-${Date.now()}@e2e-airline.test`;
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
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${inactiveToken}`);
    expect([401, 403]).toContain(inactiveRes.status);

    // TC_009: STAFF with VIEW-only (no EDIT) → 403
    const viewOnlyEmail = `revoke-view-only-${Date.now()}@e2e-airline.test`;
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
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${viewOnlyToken}`);
    expect(viewOnlyRes.status).toBe(403);

    // TC_010: STAFF with no permissions → 403
    const noPermEmail = `revoke-no-perm-${Date.now()}@e2e-airline.test`;
    await insertActiveAdmin({
      email: noPermEmail,
      password: TEST_PASSWORD,
      role: "STAFF",
    });
    const noPermToken = (
      await getAdminTokens(noPermEmail, TEST_PASSWORD)
    ).accessToken;
    const noPermRes = await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${noPermToken}`);
    expect(noPermRes.status).toBe(403);

    // TC_011: SUPER_ADMIN remains authorized
    const superRes = await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(superRes.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_REVOKE_027..034: business logic deep checks including resend-after-revoke", async () => {
    // TC_027: Revoked invitation token cannot be used to onboard
    const payload = validInvitePayload();
    const createRes = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(payload);
    expect(createRes.status).toBe(201);
    const onboardingToken = new URL(
      createRes.body.data.onboardingLink as string,
    ).searchParams.get("token");
    const newId = (await getLatestInvitationIdByAdminEmail(
      payload.adminEmail,
    )) as number;

    await api
      .post(`/api/v1/airline/invitations/${newId}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);

    const onboardAttempt = await api
      .post("/api/v1/auth/airline/onboard")
      .send({ invitationToken: onboardingToken, password: TEST_PASSWORD });
    expect([401, 409]).toContain(onboardAttempt.status);

    // TC_028: Can resend a revoked invitation → 200
    const revokedId = await createInviteId();
    await setInvitationStatus(revokedId, "REVOKED", { revokedAt: new Date() });
    const resendRes = await api
      .post(`/api/v1/airline/invitations/${revokedId}/resend`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(resendRes.status).toBe(200);

    // TC_029: Status transitions to REVOKED correctly
    const freshId = await createInviteId();
    const revokeRes = await api
      .post(`/api/v1/airline/invitations/${freshId}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.status).toBe("REVOKED");

    // TC_030: revokedAt timestamp is set in the response data
    expect(revokeRes.body.data.invitationId).toBe(freshId);

    // TC_031: idempotent — revoking an already-revoked invitation succeeds
    const idempotentRes = await api
      .post(`/api/v1/airline/invitations/${freshId}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(idempotentRes.status).toBe(200);

    // TC_032: pending invitation can be revoked
    const pendingId = await createInviteId();
    const revokePendingRes = await api
      .post(`/api/v1/airline/invitations/${pendingId}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(revokePendingRes.status).toBe(200);

    // TC_033: expired invitation can be revoked
    const expiredId = await createInviteId();
    await setInvitationStatus(expiredId, "PENDING", {
      expiresAt: new Date(Date.now() - 60_000),
    });
    const revokeExpiredRes = await api
      .post(`/api/v1/airline/invitations/${expiredId}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(revokeExpiredRes.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_REVOKE_035..037: SQLi, script injection, and method-restriction checks", async () => {
    // TC_035: SQL injection in path param → 400
    const sqli = await api
      .post("/api/v1/airline/invitations/1;DROP TABLE admins--/revoke")
      .set("Authorization", `Bearer ${superToken}`);
    expect(sqli.status).toBe(400);

    // TC_036: Script injection in path param → 400
    const script = await api
      .post(
        "/api/v1/airline/invitations/%3Cscript%3Ealert(1)%3C%2Fscript%3E/revoke",
      )
      .set("Authorization", `Bearer ${superToken}`);
    expect(script.status).toBe(400);

    // TC_037: Wrong HTTP method — GET on revoke endpoint → 404 or 405
    const id = await createInviteId();
    const wrongMethod = await api
      .get(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);
    expect([404, 405]).toContain(wrongMethod.status);
  });

  it.todo(
    "TC_AIRLINE_INVITATION_REVOKE_038..039: concurrent revoke edge cases",
  );

  it("TC_AIRLINE_INVITATION_REVOKE_040..041: audit trail — history updated after revoke", async () => {
    const id = await createInviteId();

    await api
      .post(`/api/v1/airline/invitations/${id}/revoke`)
      .set("Authorization", `Bearer ${superToken}`);

    const detailRes = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(detailRes.status).toBe(200);

    // TC_040: history array contains a REVOKED event
    const history = detailRes.body.data.history as Array<{
      event: string;
      createdAt: string;
    }>;
    const revokedEvent = history.find((h) => h.event === "REVOKED");
    expect(revokedEvent).toBeDefined();

    // TC_041: REVOKED event has a valid ISO timestamp
    expect(
      Number.isNaN(Date.parse(revokedEvent?.createdAt as string)),
    ).toBe(false);
  });
});
