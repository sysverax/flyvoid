import { Logger } from "@nestjs/common";
import { api } from "../../../helpers/http-client.helper";
import { endPool, query } from "../../../helpers/db-client.helper";
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
const INVITATION_DETAIL_PATH = "/api/v1/airline/invitations/";

function logResponseMessage(testCaseName: string, response: any): void {
  const message = response?.body?.message ?? response?.text ?? "";

  if (message) {
    Logger.log(`[${testCaseName}] Response message: ${message}`, "E2E");
  }
}

function getCurrentTestName(): string {
  return (
    (
      expect as unknown as { getState?: () => { currentTestName?: string } }
    ).getState?.()?.currentTestName ?? "unknown-test"
  );
}

function wrapResponseLogging(pathPrefix: string) {
  const originalGet = api.get.bind(api);

  (api as typeof api & { get: typeof api.get }).get = ((
    requestPath: string,
  ) => {
    const request = originalGet(requestPath);

    if (!requestPath.startsWith(pathPrefix)) {
      return request;
    }

    const originalEnd = request.end.bind(request);
    const wrappedEnd = (callback?: (err: any, res: any) => void) => {
      return Promise.resolve(originalEnd(callback)).then((response: any) => {
        logResponseMessage(getCurrentTestName(), response);
        return response;
      });
    };

    (request as typeof request & { end: typeof originalEnd }).end =
      wrappedEnd as typeof originalEnd;

    return request;
  }) as typeof api.get;
}

wrapResponseLogging(INVITATION_DETAIL_PATH);

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

  it("TC_AIRLINE_INVITATION_DETAIL_010..013: full authorization matrix — inactive/edit-only/no-perm/super", async () => {
    const id = await createInviteId();

    // TC_010: Inactive admin — obtain token first, then deactivate
    const inactiveEmail = `detail-inactive-${Date.now()}@e2e-airline.test`;
    await insertActiveAdmin({
      email: inactiveEmail,
      password: TEST_PASSWORD,
      role: "SUPER_ADMIN",
    });
    const inactiveToken = (await getAdminTokens(inactiveEmail, TEST_PASSWORD))
      .accessToken;
    await query("UPDATE admins SET is_active = false WHERE email = $1", [
      inactiveEmail,
    ]);
    const inactiveRes = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${inactiveToken}`);
    expect([401, 403]).toContain(inactiveRes.status);

    // TC_011: STAFF with EDIT-only (no VIEW) — should be 403
    const editOnlyEmail = `detail-edit-only-${Date.now()}@e2e-airline.test`;
    const editOnlyAdmin = await insertActiveAdmin({
      email: editOnlyEmail,
      password: TEST_PASSWORD,
      role: "STAFF",
    });
    await grantInvitePermission(editOnlyAdmin.id, "EDIT");
    const editOnlyToken = (await getAdminTokens(editOnlyEmail, TEST_PASSWORD))
      .accessToken;
    const editOnlyRes = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${editOnlyToken}`);
    expect(editOnlyRes.status).toBe(403);

    // TC_012: STAFF with no permissions — should be 403
    const noPermEmail = `detail-no-perm-${Date.now()}@e2e-airline.test`;
    await insertActiveAdmin({
      email: noPermEmail,
      password: TEST_PASSWORD,
      role: "STAFF",
    });
    const noPermToken = (await getAdminTokens(noPermEmail, TEST_PASSWORD))
      .accessToken;
    const noPermRes = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${noPermToken}`);
    expect(noPermRes.status).toBe(403);

    // TC_013: SUPER_ADMIN remains authorized
    const superRes = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(superRes.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_DETAIL_037..041: status-enum validity, history-status consistency, list consistency", async () => {
    const id = await createInviteId();
    const detail = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);

    // TC_037: status is one of the valid enum values
    expect(["PENDING", "ACCEPTED", "REVOKED"]).toContain(
      detail.body.data.status,
    );

    // TC_038/040: for PENDING, acceptedAt should be null or absent
    if (detail.body.data.status === "PENDING") {
      const acceptedAt = detail.body.data.acceptedAt;
      expect(acceptedAt === null || acceptedAt === undefined).toBe(true);
    }

    // TC_039: status matches latest history event after revoke
    await insertInviteHistoryRow({ invitationId: id, event: "REVOKED" });
    await setInvitationStatus(id, "REVOKED", { revokedAt: new Date() });
    const revokedDetail = await api
      .get(`/api/v1/airline/invitations/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(revokedDetail.status).toBe(200);
    expect(revokedDetail.body.data.status).toBe("REVOKED");
    const history = revokedDetail.body.data.history as Array<{ event: string }>;
    const lastEvent = history[history.length - 1]?.event;
    expect(lastEvent).toBe("REVOKED");

    // TC_041: detail data is consistent with the matching list entry
    const listRes = await api
      .get("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const listItem = (
      listRes.body.data.invitations as Array<{ invitationId: number }>
    ).find((inv) => inv.invitationId === id);
    expect(listItem).toBeDefined();
  });

  it("TC_AIRLINE_INVITATION_DETAIL_044..046: SQLi, script, and malformed path params rejected", async () => {
    // TC_044: SQL injection in path param — non-numeric → 400
    const sqli = await api
      .get("/api/v1/airline/invitations/1;DROP TABLE admins--")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(sqli.status).toBe(400);

    // TC_045: Script injection in path param — non-numeric → 400
    const script = await api
      .get("/api/v1/airline/invitations/%3Cscript%3Ealert(1)%3C%2Fscript%3E")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(script.status).toBe(400);

    // TC_046: Excessively large number that overflows integer range
    const overflow = await api
      .get("/api/v1/airline/invitations/999999999999999999999999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect([400, 404]).toContain(overflow.status);
  });

  it.todo(
    "TC_AIRLINE_INVITATION_DETAIL_047: concurrent detail reads return consistent data",
  );
});
