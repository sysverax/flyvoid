import { Logger } from "@nestjs/common";
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
const INVITATION_MATRIX_PATH = "/api/v1/airline/invitations/matrix";

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

function wrapResponseLogging(path: string) {
  const originalGet = api.get.bind(api);

  (api as typeof api & { get: typeof api.get }).get = ((
    requestPath: string,
  ) => {
    const request = originalGet(requestPath);

    if (requestPath !== path) {
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

wrapResponseLogging(INVITATION_MATRIX_PATH);

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
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
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

  it("TC_AIRLINE_INVITATION_MATRIX_012..015: remaining authorization matrix scenarios", async () => {
    // TC_012: Inactive admin — get token before deactivating
    const inactiveEmail = `matrix-inactive-${Date.now()}@e2e-airline.test`;
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
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${inactiveToken}`);
    expect([401, 403]).toContain(inactiveRes.status);

    // TC_013: STAFF with EDIT-only (no VIEW) → 403
    const editOnlyEmail = `matrix-edit-only-${Date.now()}@e2e-airline.test`;
    const editOnlyAdmin = await insertActiveAdmin({
      email: editOnlyEmail,
      password: TEST_PASSWORD,
      role: "STAFF",
    });
    await grantInvitePermission(editOnlyAdmin.id, "EDIT");
    const editOnlyToken = (await getAdminTokens(editOnlyEmail, TEST_PASSWORD))
      .accessToken;
    const editOnlyRes = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${editOnlyToken}`);
    expect(editOnlyRes.status).toBe(403);

    // TC_014: STAFF with no permissions → 403
    const noPermEmail = `matrix-no-perm-${Date.now()}@e2e-airline.test`;
    await insertActiveAdmin({
      email: noPermEmail,
      password: TEST_PASSWORD,
      role: "STAFF",
    });
    const noPermToken = (await getAdminTokens(noPermEmail, TEST_PASSWORD))
      .accessToken;
    const noPermRes = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${noPermToken}`);
    expect(noPermRes.status).toBe(403);

    // TC_015: SUPER_ADMIN remains authorized
    const superRes = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${superToken}`);
    expect(superRes.status).toBe(200);
  });

  it("TC_AIRLINE_INVITATION_MATRIX_026..034: counts update correctly across invitation lifecycle events", async () => {
    type Matrix = {
      totalSent: number;
      pending: number;
      accepted: number;
      revoked: number;
      expired: number;
    };

    const snapshot = async (): Promise<Matrix> =>
      (
        await api
          .get("/api/v1/airline/invitations/matrix")
          .set("Authorization", `Bearer ${superToken}`)
      ).body.data as Matrix;

    const before = await snapshot();

    // TC_026/030: create → totalSent +1, pending +1
    const newPayload = validInvitePayload();
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(newPayload);
    const newId = (await getLatestInvitationIdByAdminEmail(
      newPayload.adminEmail,
    )) as number;

    const afterCreate = await snapshot();
    expect(afterCreate.totalSent).toBe(before.totalSent + 1);
    expect(afterCreate.pending).toBe(before.pending + 1);

    // TC_028: revoke pending → revoked +1, pending back to baseline
    await setInvitationStatus(newId, "REVOKED", { revokedAt: new Date() });
    const afterRevoke = await snapshot();
    expect(afterRevoke.revoked).toBe(before.revoked + 1);
    expect(afterRevoke.pending).toBe(before.pending);

    // TC_027: accept a fresh invitation → accepted +1
    const acceptPayload = validInvitePayload();
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(acceptPayload);
    const acceptId = (await getLatestInvitationIdByAdminEmail(
      acceptPayload.adminEmail,
    )) as number;
    await setInvitationStatus(acceptId, "ACCEPTED", { acceptedAt: new Date() });
    const afterAccept = await snapshot();
    expect(afterAccept.accepted).toBe(before.accepted + 1);

    // TC_029: expire a fresh pending invitation → expired increases
    const expirePayload = validInvitePayload();
    await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(expirePayload);
    const expireId = (await getLatestInvitationIdByAdminEmail(
      expirePayload.adminEmail,
    )) as number;
    await setInvitationStatus(expireId, "PENDING", {
      expiresAt: new Date(Date.now() - 60_000),
    });
    const afterExpire = await snapshot();
    expect(afterExpire.expired).toBeGreaterThan(before.expired);

    // TC_034: totalSent must equal sum of all buckets at every snapshot
    expect(afterExpire.totalSent).toBe(
      afterExpire.accepted +
        afterExpire.pending +
        afterExpire.expired +
        afterExpire.revoked,
    );
  });

  it("TC_AIRLINE_INVITATION_MATRIX_041..043: malformed auth and method-restriction checks", async () => {
    // TC_041: Malformed Authorization header (no Bearer prefix)
    const malformedAuth = await api
      .get("/api/v1/airline/invitations/matrix")
      .set("Authorization", "Token somevalue");
    expect(malformedAuth.status).toBe(401);

    // TC_043: Wrong HTTP method — POST on a read-only matrix endpoint
    const wrongMethod = await api
      .post("/api/v1/airline/invitations/matrix")
      .set("Authorization", `Bearer ${superToken}`)
      .send({});
    expect([404, 405]).toContain(wrongMethod.status);
  });

  it.todo(
    "TC_AIRLINE_INVITATION_MATRIX_042: concurrent matrix reads return consistent data",
  );
});
