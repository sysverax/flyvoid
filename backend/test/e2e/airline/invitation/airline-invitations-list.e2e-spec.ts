import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { insertActiveAdmin } from "../../../seeders/admin.seeder";
import {
  deleteInvitationDataByPattern,
  grantInvitePermission,
} from "../../../seeders/airline-invitation.seeder";
import { validInvitePayload } from "../../../fixtures/airline-invitation.fixture";
import { getAdminTokens } from "../../../helpers/auth.helper";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const EMAIL_PATTERN = "%@e2e-airline.test";
const INVITE_PATTERN = "E2E%";
const TEST_PASSWORD = "Password@123";

async function makeSuperAdminToken(tag: string): Promise<string> {
  const email = `${tag}-${Date.now()}@e2e-airline.test`;
  await insertActiveAdmin({
    email,
    password: TEST_PASSWORD,
    role: "SUPER_ADMIN",
  });
  return (await getAdminTokens(email, TEST_PASSWORD)).accessToken;
}

async function makeStaffViewToken(tag: string): Promise<string> {
  const email = `${tag}-${Date.now()}@e2e-airline.test`;
  const admin = await insertActiveAdmin({
    email,
    password: TEST_PASSWORD,
    role: "STAFF",
  });
  await grantInvitePermission(admin.id, "VIEW");
  return (await getAdminTokens(email, TEST_PASSWORD)).accessToken;
}

describe("GET /api/v1/airline/invitations", () => {
  let superToken = "";
  let staffViewToken = "";

  beforeAll(async () => {
    superToken = await makeSuperAdminToken("list-super");
    staffViewToken = await makeStaffViewToken("list-staff-view");

    for (let i = 0; i < 5; i += 1) {
      await api
        .post("/api/v1/airline/invitations")
        .set("Authorization", `Bearer ${superToken}`)
        .send(validInvitePayload());
    }
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  it("TC_AIRLINE_INVITATION_LIST_001: Get airline invitations as SUPER_ADMIN, expected 200", async () => {
    const res = await api
      .get("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("TC_AIRLINE_INVITATION_LIST_002: Get airline invitations as STAFF with INVITES_ONBOARDING VIEW access, expected 200", async () => {
    const res = await api
      .get("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${staffViewToken}`);
    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_LIST_003-015: default/custom pagination and key response fields, expected 200", async () => {
    const res = await api
      .get("/api/v1/airline/invitations?page=1&limit=2")
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.total).toBe("number");
    expect(typeof res.body.data.currentPage).toBe("number");
    expect(typeof res.body.data.limit).toBe("number");
    expect(Array.isArray(res.body.data.invitations)).toBe(true);

    if (res.body.data.invitations.length > 0) {
      const row = res.body.data.invitations[0];
      expect(row.invitationId).toBeDefined();
      expect(row.airlineId === null || typeof row.airlineId === "number").toBe(
        true,
      );
      expect(row.airlineName).toBeDefined();
      expect(row.airlineCode).toBeDefined();
      expect(row.firstName).toBeDefined();
      expect(row.lastName).toBeDefined();
      expect(row.email).toBeDefined();
      expect(row.jobTitle).toBeDefined();
      expect(row.invitedByAdminId).toBeDefined();
      expect(row.status).toBeDefined();
      expect(row.expiresAt).toBeDefined();
      expect(row.createdAt).toBeDefined();
      expect(row.updatedAt).toBeDefined();
    }
  });

  it("TC_AIRLINE_INVITATION_LIST_028: Request without access token, expected 401", async () => {
    const res = await api.get("/api/v1/airline/invitations");
    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_INVITATION_LIST_029: Request with invalid access token, expected 401", async () => {
    const res = await api
      .get("/api/v1/airline/invitations")
      .set("Authorization", "Bearer invalid.token");
    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_INVITATION_LIST_044-055: Query parameter validation (page/limit invalid), expected 400", async () => {
    const badQueries = [
      "page=0",
      "page=-1",
      "page=1.5",
      "page=abc",
      "page=true",
      "limit=0",
      "limit=-1",
      "limit=1.5",
      "limit=abc",
      "limit=true",
    ];

    for (const q of badQueries) {
      const res = await api
        .get(`/api/v1/airline/invitations?${q}`)
        .set("Authorization", `Bearer ${superToken}`);
      expect(res.status).toBe(400);
    }
  });

  it("TC_AIRLINE_INVITATION_LIST_056: Verify invitations sorted by latest createdAt first, expected 200", async () => {
    const res = await api
      .get("/api/v1/airline/invitations?page=1&limit=20")
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    const list = res.body.data.invitations as Array<{ createdAt: string }>;
    for (let i = 1; i < list.length; i += 1) {
      expect(new Date(list[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(list[i].createdAt).getTime(),
      );
    }
  });

  it("TC_AIRLINE_INVITATION_LIST_066/067: Extremely large page accepted, extremely large limit rejected", async () => {
    const hugePage = await api
      .get("/api/v1/airline/invitations?page=999999999")
      .set("Authorization", `Bearer ${superToken}`);
    expect(hugePage.status).toBe(200);

    const hugeLimit = await api
      .get("/api/v1/airline/invitations?limit=1000")
      .set("Authorization", `Bearer ${superToken}`);
    expect(hugeLimit.status).toBe(400);
  });

  it("TC_AIRLINE_INVITATION_LIST_068: Additional unknown query parameter ignored safely, expected 200", async () => {
    const res = await api
      .get("/api/v1/airline/invitations?foo=bar")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  it.todo(
    "TC_AIRLINE_INVITATION_LIST_030-043: Remaining authz/pagination scenario variants",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_LIST_057-063: Status/data-integrity variants require deterministic status seeding per invite",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_LIST_064/065/069/070: SQLi and duplicate query-key parser edge behavior verification",
  );
});
