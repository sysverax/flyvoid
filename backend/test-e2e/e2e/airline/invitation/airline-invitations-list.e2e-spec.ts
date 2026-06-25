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

  it("TC_AIRLINE_INVITATION_LIST_030..043: auth matrix, pagination details, and count consistency", async () => {
    // TC_030: Expired JWT → 401
    const expiredJwt = await api
      .get("/api/v1/airline/invitations")
      .set(
        "Authorization",
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDF9.x",
      );
    expect(expiredJwt.status).toBe(401);

    // TC_031: Inactive admin — get token before deactivating
    const inactiveEmail = `list-inactive-${Date.now()}@e2e-airline.test`;
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
      .get("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${inactiveToken}`);
    expect([401, 403]).toContain(inactiveRes.status);

    // TC_032: STAFF with EDIT-only (no VIEW) → 403
    const editOnlyEmail = `list-edit-only-${Date.now()}@e2e-airline.test`;
    const editOnlyAdmin = await insertActiveAdmin({
      email: editOnlyEmail,
      password: TEST_PASSWORD,
      role: "STAFF",
    });
    await grantInvitePermission(editOnlyAdmin.id, "EDIT");
    const editOnlyToken = (
      await getAdminTokens(editOnlyEmail, TEST_PASSWORD)
    ).accessToken;
    const editOnlyRes = await api
      .get("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${editOnlyToken}`);
    expect(editOnlyRes.status).toBe(403);

    // TC_033: STAFF with no permissions → 403
    const noPermEmail = `list-no-perm-${Date.now()}@e2e-airline.test`;
    await insertActiveAdmin({
      email: noPermEmail,
      password: TEST_PASSWORD,
      role: "STAFF",
    });
    const noPermToken = (
      await getAdminTokens(noPermEmail, TEST_PASSWORD)
    ).accessToken;
    const noPermRes = await api
      .get("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${noPermToken}`);
    expect(noPermRes.status).toBe(403);

    // TC_034: SUPER_ADMIN authorized → 200
    const superRes = await api
      .get("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`);
    expect(superRes.status).toBe(200);

    // TC_035: STAFF with VIEW authorized → 200
    const viewRes = await api
      .get("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${staffViewToken}`);
    expect(viewRes.status).toBe(200);

    // TC_036: limit=1 → at most 1 result per page
    const limit1Res = await api
      .get("/api/v1/airline/invitations?page=1&limit=1")
      .set("Authorization", `Bearer ${superToken}`);
    expect(limit1Res.status).toBe(200);
    expect(limit1Res.body.data.invitations.length).toBeLessThanOrEqual(1);

    // TC_037: page=2&limit=2 → currentPage and limit reflect query params
    const page2Res = await api
      .get("/api/v1/airline/invitations?page=2&limit=2")
      .set("Authorization", `Bearer ${superToken}`);
    expect(page2Res.status).toBe(200);
    expect(page2Res.body.data.currentPage).toBe(2);
    expect(page2Res.body.data.limit).toBe(2);

    // TC_038: out-of-range page → empty invitations array
    const outOfRange = await api
      .get("/api/v1/airline/invitations?page=999999&limit=10")
      .set("Authorization", `Bearer ${superToken}`);
    expect(outOfRange.status).toBe(200);
    expect(outOfRange.body.data.invitations).toHaveLength(0);

    // TC_039/040/041: total is consistent; currentPage and limit echo params
    const ref1 = await api
      .get("/api/v1/airline/invitations?page=1&limit=1")
      .set("Authorization", `Bearer ${superToken}`);
    const ref2 = await api
      .get("/api/v1/airline/invitations?page=1&limit=5")
      .set("Authorization", `Bearer ${superToken}`);
    expect(ref1.body.data.total).toBe(ref2.body.data.total);
    expect(ref1.body.data.currentPage).toBe(1);
    expect(ref1.body.data.limit).toBe(1);

    // TC_042: total increases when a new invitation is added
    const beforeTotal = ref1.body.data.total as number;
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(validInvitePayload());
    const afterRes = await api
      .get("/api/v1/airline/invitations?page=1&limit=1")
      .set("Authorization", `Bearer ${superToken}`);
    expect(afterRes.body.data.total).toBe(beforeTotal + 1);

    // TC_043: totalPages === ceil(total / limit)
    const pagesRes = await api
      .get("/api/v1/airline/invitations?page=1&limit=2")
      .set("Authorization", `Bearer ${superToken}`);
    const { total, limit, totalPages } = pagesRes.body.data as {
      total: number;
      limit: number;
      totalPages: number;
    };
    expect(totalPages).toBe(Math.ceil(total / limit));

    // TC_054/055: null/empty query params
    const emptyPage = await api
      .get("/api/v1/airline/invitations?page=")
      .set("Authorization", `Bearer ${superToken}`);
    expect([200, 400]).toContain(emptyPage.status);

    const emptyLimit = await api
      .get("/api/v1/airline/invitations?limit=")
      .set("Authorization", `Bearer ${superToken}`);
    expect([200, 400]).toContain(emptyLimit.status);
  });

  it("TC_AIRLINE_INVITATION_LIST_057..063: status data integrity across invitation lifecycle states", async () => {
    // Seed invitations for each status type
    const acceptedPayload = validInvitePayload();
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(acceptedPayload);
    const acceptedId = (await getLatestInvitationIdByAdminEmail(
      acceptedPayload.adminEmail,
    )) as number;
    await setInvitationStatus(acceptedId, "ACCEPTED", { acceptedAt: new Date() });

    const revokedPayload = validInvitePayload();
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(revokedPayload);
    const revokedId = (await getLatestInvitationIdByAdminEmail(
      revokedPayload.adminEmail,
    )) as number;
    await setInvitationStatus(revokedId, "REVOKED", { revokedAt: new Date() });

    const expiredPayload = validInvitePayload();
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(expiredPayload);
    const expiredId = (await getLatestInvitationIdByAdminEmail(
      expiredPayload.adminEmail,
    )) as number;
    await setInvitationStatus(expiredId, "PENDING", {
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await api
      .get("/api/v1/airline/invitations?page=1&limit=100")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);

    const invitations = res.body.data.invitations as Array<{
      invitationId: number;
      status: string;
      expiresAt: string;
      createdAt: string;
    }>;

    // TC_057: all status values must be from the valid enum set
    const validStatuses = ["PENDING", "ACCEPTED", "REVOKED"];
    for (const inv of invitations) {
      expect(validStatuses).toContain(inv.status);
    }

    // TC_058: accepted invitation has status ACCEPTED
    const acceptedItem = invitations.find(
      (inv) => inv.invitationId === acceptedId,
    );
    expect(acceptedItem?.status).toBe("ACCEPTED");

    // TC_059: revoked invitation has status REVOKED
    const revokedItem = invitations.find((inv) => inv.invitationId === revokedId);
    expect(revokedItem?.status).toBe("REVOKED");

    // TC_060: expired invitation has status PENDING and expiresAt in the past
    const expiredItem = invitations.find((inv) => inv.invitationId === expiredId);
    expect(expiredItem?.status).toBe("PENDING");
    expect(new Date(expiredItem?.expiresAt as string).getTime()).toBeLessThan(
      Date.now(),
    );

    // TC_061: createdAt is a valid ISO timestamp for every row
    for (const inv of invitations) {
      expect(Number.isNaN(Date.parse(inv.createdAt))).toBe(false);
    }

    // TC_062: no duplicate invitationIds in result
    const ids = invitations.map((inv) => inv.invitationId);
    expect(new Set(ids).size).toBe(ids.length);

    // TC_063: no sensitive fields exposed in the response
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("token_hash");
    expect(bodyText).not.toContain("password_hash");
  });

  it("TC_AIRLINE_INVITATION_LIST_064/065/069/070: SQL injection, script injection, duplicate keys, and case handling", async () => {
    // TC_064: SQL injection in page param — non-numeric → 400
    const sqli = await api
      .get("/api/v1/airline/invitations?page=1;DROP TABLE admins--")
      .set("Authorization", `Bearer ${superToken}`);
    expect(sqli.status).toBe(400);

    // TC_065: script injection in query param — safely handled (400 or 200 with empty filter)
    const script = await api
      .get(
        "/api/v1/airline/invitations?status=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
      )
      .set("Authorization", `Bearer ${superToken}`);
    expect([200, 400]).toContain(script.status);

    // TC_069: duplicate query key — server must handle gracefully
    const dupKeys = await api
      .get("/api/v1/airline/invitations?page=1&page=2")
      .set("Authorization", `Bearer ${superToken}`);
    expect(dupKeys.status).toBe(200);

    // TC_070: uppercase status value — 200 (filtered or ignored) or 400 (validation)
    const upperStatus = await api
      .get("/api/v1/airline/invitations?status=PENDING")
      .set("Authorization", `Bearer ${superToken}`);
    expect([200, 400]).toContain(upperStatus.status);
  });
});
