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

async function makeToken(
  role: "SUPER_ADMIN" | "STAFF",
  view = false,
): Promise<string> {
  const email = `${role.toLowerCase()}-matrix-${Date.now()}@e2e-airline.test`;
  const admin = await insertActiveAdmin({
    email,
    password: TEST_PASSWORD,
    role,
  });
  if (view) {
    await grantInvitePermission(admin.id, "VIEW");
  }
  return (await getAdminTokens(email, TEST_PASSWORD)).accessToken;
}

describe("GET /api/v1/airline/invitations/matrix", () => {
  let superToken = "";
  let staffViewToken = "";

  beforeAll(async () => {
    superToken = await makeToken("SUPER_ADMIN");
    staffViewToken = await makeToken("STAFF", true);

    const pending = validInvitePayload();
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(pending);

    const accepted = validInvitePayload();
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(accepted);
    const acceptedId = (await getLatestInvitationIdByAdminEmail(
      accepted.adminEmail,
    )) as number;
    await setInvitationStatus(acceptedId, "ACCEPTED", {
      acceptedAt: new Date(),
    });

    const revoked = validInvitePayload();
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(revoked);
    const revokedId = (await getLatestInvitationIdByAdminEmail(
      revoked.adminEmail,
    )) as number;
    await setInvitationStatus(revokedId, "REVOKED", { revokedAt: new Date() });

    const expired = validInvitePayload();
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(expired);
    const expiredId = (await getLatestInvitationIdByAdminEmail(
      expired.adminEmail,
    )) as number;
    await setInvitationStatus(expiredId, "PENDING", {
      expiresAt: new Date(Date.now() - 60_000),
    });
  });

  afterAll(async () => {
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await endPool();
  });

  it("TC_AIRLINE_INVITATION_MATRIX_001: Fetch invitation matrix by Super Admin, expected 200", async () => {
    const res = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_MATRIX_002: Fetch invitation matrix by Staff with VIEW access, expected 200", async () => {
    const res = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${staffViewToken}`);
    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_MATRIX_003..008: Matrix status buckets available, expected 200", async () => {
    const res = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalSent).toBeGreaterThanOrEqual(4);
    expect(res.body.data.pending).toBeGreaterThanOrEqual(1);
    expect(res.body.data.accepted).toBeGreaterThanOrEqual(1);
    expect(res.body.data.expired).toBeGreaterThanOrEqual(1);
    expect(res.body.data.revoked).toBeGreaterThanOrEqual(1);
  });

  it("TC_AIRLINE_INVITATION_MATRIX_009/010/011: auth failures", async () => {
    const noAuth = await api.get("/api/v1/airline/invitations/matrix");
    expect(noAuth.status).toBe(401);

    const invalid = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", "Bearer invalid.token");
    expect(invalid.status).toBe(401);

    const expired = await api
      .get("/api/v1/airline/invitations/matrix")
      .set(
        "Authorization",
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDF9.x",
      );
    expect(expired.status).toBe(401);
  });

  it("TC_AIRLINE_INVITATION_MATRIX_016..024: response structure and metadata", async () => {
    const res = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.totalSent).toBe("number");
    expect(typeof res.body.data.accepted).toBe("number");
    expect(typeof res.body.data.pending).toBe("number");
    expect(typeof res.body.data.expired).toBe("number");
    expect(typeof res.body.data.revoked).toBe("number");
    expect(res.body.success).toBe(true);
    expect(typeof res.body.requestId).toBe("string");
    expect(typeof res.body.timestamp).toBe("string");
    expect(res.body.message).toBe("Invitation matrix fetched successfully");
  });

  it("TC_AIRLINE_INVITATION_MATRIX_025: totalSent equals accepted + pending + expired + revoked, expected 200", async () => {
    const res = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    const { totalSent, accepted, pending, expired, revoked } = res.body.data;
    expect(totalSent).toBe(accepted + pending + expired + revoked);
  });

  it("TC_AIRLINE_INVITATION_MATRIX_035..040: counts are non-negative and integers", async () => {
    const res = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${superToken}`);
    const values = Object.values(res.body.data) as number[];

    for (const v of values) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it.todo(
    "TC_AIRLINE_INVITATION_MATRIX_012..015: remaining authorization matrix scenarios",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_MATRIX_026..034: dynamic lifecycle updates after create/accept/revoke/resend actions",
  );
  it.todo(
    "TC_AIRLINE_INVITATION_MATRIX_041..043: malformed auth header, concurrency, method-restriction checks",
  );
});
