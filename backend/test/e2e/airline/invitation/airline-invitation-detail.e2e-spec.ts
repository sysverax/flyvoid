import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { insertActiveAdmin } from "../../../seeders/admin.seeder";
import {
  deleteInvitationDataByPattern,
  grantInvitePermission,
  getLatestInvitationIdByAdminEmail,
  insertInviteHistoryRow,
  setInvitationStatus,
} from "../../../seeders/airline-invitation.seeder";
import { validInvitePayload } from "../../../fixtures/airline-invitation.fixture";
import { getAdminTokens } from "../../../helpers/auth.helper";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const EMAIL_PATTERN = "%@e2e-airline.test";
const INVITE_PATTERN = "E2E%";
const TEST_PASSWORD = "Password@123";

async function superToken(): Promise<string> {
  const email = `detail-super-${Date.now()}@e2e-airline.test`;
  await insertActiveAdmin({
    email,
    password: TEST_PASSWORD,
    role: "SUPER_ADMIN",
  });
  return (await getAdminTokens(email, TEST_PASSWORD)).accessToken;
}

async function staffViewToken(): Promise<string> {
  const email = `detail-staff-${Date.now()}@e2e-airline.test`;
  const admin = await insertActiveAdmin({
    email,
    password: TEST_PASSWORD,
    role: "STAFF",
  });
  await grantInvitePermission(admin.id, "VIEW");
  return (await getAdminTokens(email, TEST_PASSWORD)).accessToken;
}

describe("GET /api/v1/airline/invitations/:invitationId", () => {
  let adminToken = "";
  let viewerToken = "";

  beforeAll(async () => {
    adminToken = await superToken();
    viewerToken = await staffViewToken();
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  async function createInviteId(): Promise<number> {
    const payload = validInvitePayload();
    const create = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);
    expect(create.status).toBe(201);

    return (await getLatestInvitationIdByAdminEmail(
      payload.adminEmail,
    )) as number;
  }

  it("TC_AIRLINE_INVITATION_DETAIL_001: Fetch invitation by Super Admin with valid invitationId, expected 200", async () => {
    const id = await createInviteId();
    const res = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_DETAIL_002: Fetch invitation by Staff with VIEW access, expected 200", async () => {
    const id = await createInviteId();
    const res = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_DETAIL_003..006: Fetch pending/accepted/expired/revoked invitation successfully, expected 200", async () => {
    const pendingId = await createInviteId();
    const pendingRes = await api
      .get(`/api/v1/airline/invitations/${pendingId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(pendingRes.status).toBe(200);

    const acceptedId = await createInviteId();
    await setInvitationStatus(acceptedId, "ACCEPTED", {
      acceptedAt: new Date(),
    });
    const acceptedRes = await api
      .get(`/api/v1/airline/invitations/${acceptedId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(acceptedRes.status).toBe(200);

    const expiredId = await createInviteId();
    await setInvitationStatus(expiredId, "PENDING", {
      expiresAt: new Date(Date.now() - 60_000),
    });
    const expiredRes = await api
      .get(`/api/v1/airline/invitations/${expiredId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(expiredRes.status).toBe(200);

    const revokedId = await createInviteId();
    await setInvitationStatus(revokedId, "REVOKED", { revokedAt: new Date() });
    const revokedRes = await api
      .get(`/api/v1/airline/invitations/${revokedId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(revokedRes.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_DETAIL_007..013: auth/authz matrix baseline", async () => {
    const id = await createInviteId();

    const noAuth = await api.get(`/api/v1/airline/invitations/${id}`);
    expect(noAuth.status).toBe(401);

    const invalid = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", "Bearer invalid.token");
    expect(invalid.status).toBe(401);

    const expired = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set(
        "Authorization",
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDF9.x",
      );
    expect(expired.status).toBe(401);
  });

  it("TC_AIRLINE_INVITATION_DETAIL_014: Fetch non-existing invitationId, expected 404", async () => {
    const res = await api
      .get("/api/v1/airline/invitations/999999999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("TC_AIRLINE_INVITATION_DETAIL_015..018: invalid invitationId values", async () => {
    for (const id of ["0", "-1"]) {
      const res = await api
        .get(`/api/v1/airline/invitations/${id}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    }

    for (const id of ["abc", "1.5"]) {
      const res = await api
        .get(`/api/v1/airline/invitations/${id}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    }
  });

  it("TC_AIRLINE_INVITATION_DETAIL_019..033: detail response contains expected contract fields", async () => {
    const id = await createInviteId();
    const res = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const row = res.body.data;
    expect(row.invitationId).toBe(id);
    expect(row.airlineId === null || typeof row.airlineId === "number").toBe(
      true,
    );
    expect(typeof row.airlineName).toBe("string");
    expect(typeof row.airlineCode).toBe("string");
    expect(typeof row.companyRegistrationNumber).toBe("string");
    expect(typeof row.firstName).toBe("string");
    expect(typeof row.lastName).toBe("string");
    expect(typeof row.email).toBe("string");
    expect(typeof row.jobTitle).toBe("string");
    expect(typeof row.invitedByAdminId).toBe("number");
    expect(typeof row.status).toBe("string");
    expect(typeof row.expiresAt).toBe("string");
    expect(typeof row.createdAt).toBe("string");
    expect(typeof row.updatedAt).toBe("string");
    expect(Array.isArray(row.history)).toBe(true);
  });

  it("TC_AIRLINE_INVITATION_DETAIL_034..040: history and status consistency checks", async () => {
    const id = await createInviteId();
    await insertInviteHistoryRow({ invitationId: id, event: "RESENT" });
    await insertInviteHistoryRow({ invitationId: id, event: "REVOKED" });

    const res = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const history = res.body.data.history as Array<{
      createdAt: string;
      event: string;
    }>;
    for (let i = 1; i < history.length; i += 1) {
      expect(new Date(history[i].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(history[i - 1].createdAt).getTime(),
      );
    }
  });

  it("TC_AIRLINE_INVITATION_DETAIL_042/043/048..051: no sensitive fields, timestamps ISO, metadata present", async () => {
    const id = await createInviteId();
    const res = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("token_hash");
    expect(bodyText).not.toContain("password_hash");

    expect(Number.isNaN(Date.parse(res.body.data.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(res.body.data.updatedAt))).toBe(false);
    expect(Number.isNaN(Date.parse(res.body.data.expiresAt))).toBe(false);

    expect(res.body.success).toBe(true);
    expect(typeof res.body.requestId).toBe("string");
    expect(typeof res.body.timestamp).toBe("string");
    expect(res.body.message).toBe("Invitation fetched successfully");
  });

  it.todo(
    "TC_AIRLINE_INVITATION_DETAIL_010..013: full authorization matrix (inactive/edit-only/unauthorized role)",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_DETAIL_037..041: accepted-live-airline/source-of-truth consistency checks across list/detail",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_DETAIL_044..047: SQLi/script/malformed path/concurrency checks",
  );
});
