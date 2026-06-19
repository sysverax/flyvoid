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

  it.todo(
    "TC_AIRLINE_INVITATION_RESEND_008..011: Remaining authorization matrix",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_RESEND_018: Extremely large invitationId value not found, expected 404",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_RESEND_026..037: business logic/security including concurrent resend and method checks",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_RESEND_038..041: audit metadata and exact message assertions",
  );
});
