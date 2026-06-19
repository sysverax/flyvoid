import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
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
import { describe, it } from "node:test";
import { beforeAll, afterAll, expect } from "@jest/globals";

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
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await deleteInvitationDataByPattern(INVITE_PATTERN);
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

  it.todo(
    "TC_AIRLINE_INVITATION_REVOKE_008..011: remaining authorization matrix",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_REVOKE_027..034: business logic deep checks, including resend-after-revoke",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_REVOKE_035..039: SQLi/script/concurrency/method robustness",
  );
  it.todo("TC_AIRLINE_INVITATION_REVOKE_040..041: audit trail verification");
});
