import { Logger } from "@nestjs/common";
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { signupAndGetTokens } from "../../../helpers/auth.helper";
import {
  AIRLINE_TEST_PASSWORD,
  uniqueAirlineEmail,
  validOnboardPayload,
} from "../../../fixtures/airline-auth.fixture";
import { validInvitePayload } from "../../../fixtures/airline-invitation.fixture";
import {
  deleteInvitationDataByPattern,
  getLatestInvitationIdByAdminEmail,
  insertAirlineRow,
  insertAirlineUserRow,
  setInvitationStatus,
} from "../../../seeders/airline-invitation.seeder";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const ADMIN_EMAIL_PATTERN = "%@e2e-airline-auth.test";
const INVITE_PATTERN = "E2E%";
const ONBOARD_PATH = "/api/v1/auth/airline/onboard";

function extractToken(onboardingLink: string): string {
  return new URL(onboardingLink).searchParams.get("token") as string;
}

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
  const originalPost = api.post.bind(api);

  (api as typeof api & { post: typeof api.post }).post = ((
    requestPath: string,
  ) => {
    const request = originalPost(requestPath);

    if (requestPath !== path) {
      return request;
    }

    const originalSend = request.send.bind(request);
    const wrappedSend = (body: string | object | undefined) => {
      return Promise.resolve(originalSend(body)).then((response: any) => {
        logResponseMessage(getCurrentTestName(), response);
        return response;
      });
    };

    (request as typeof request & { send: typeof originalSend }).send =
      wrappedSend as typeof originalSend;

    return request;
  }) as typeof api.post;
}

wrapResponseLogging(ONBOARD_PATH);

async function makeSuperAdminToken() {
  const adminEmail = uniqueAirlineEmail("platform-super");
  const tokens = await signupAndGetTokens(
    "Platform",
    "Super",
    adminEmail,
    AIRLINE_TEST_PASSWORD,
  );
  return tokens.accessToken;
}

async function createInvitationToken(
  superToken: string,
  overrides: Record<string, unknown> = {},
) {
  const payload = validInvitePayload({
    adminEmail: uniqueAirlineEmail("invitee"),
    ...overrides,
  });

  const inviteRes = await api
    .post("/api/v1/airline/invitations")
    .set("Authorization", `Bearer ${superToken}`)
    .send(payload);

  if (inviteRes.status !== 201) {
    throw new Error(
      `createInvitationToken failed: ${inviteRes.status} ${JSON.stringify(inviteRes.body)}`,
    );
  }

  return {
    token: extractToken(inviteRes.body.data.onboardingLink as string),
    payload,
  };
}

describe("POST /api/v1/auth/airline/onboard", () => {
  let superToken = "";

  beforeAll(async () => {
    superToken = await makeSuperAdminToken();
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(ADMIN_EMAIL_PATTERN);
    await endPool();
  });

  it("TC_AIRLINE_ONBOARD_001: Onboard with valid invitation token and password -> 200", async () => {
    const { token, payload } = await createInvitationToken(superToken);

    const res = await api
      .post("/api/v1/auth/airline/onboard")
      .send(validOnboardPayload(token, AIRLINE_TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.userId).toBe("number");
    expect(typeof res.body.data.airlineId).toBe("number");
    expect(res.body.data.email).toBe(payload.adminEmail.toLowerCase());
  });

  it("TC_AIRLINE_ONBOARD_002: Invalid invitation token -> 401", async () => {
    const res = await api
      .post("/api/v1/auth/airline/onboard")
      .send(validOnboardPayload("invalid-token", AIRLINE_TEST_PASSWORD));

    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_ONBOARD_003: Reusing accepted invitation token -> 409", async () => {
    const { token } = await createInvitationToken(superToken);

    const first = await api
      .post("/api/v1/auth/airline/onboard")
      .send(validOnboardPayload(token, AIRLINE_TEST_PASSWORD));
    expect(first.status).toBe(200);

    const second = await api
      .post("/api/v1/auth/airline/onboard")
      .send(validOnboardPayload(token, AIRLINE_TEST_PASSWORD));

    expect(second.status).toBe(409);
  });

  it("TC_AIRLINE_ONBOARD_004: Revoked invitation token -> 401", async () => {
    const { token, payload } = await createInvitationToken(superToken);
    const invitationId = await getLatestInvitationIdByAdminEmail(
      payload.adminEmail,
    );

    await setInvitationStatus(invitationId as number, "REVOKED", {
      revokedAt: new Date(),
    });

    const res = await api
      .post("/api/v1/auth/airline/onboard")
      .send(validOnboardPayload(token, AIRLINE_TEST_PASSWORD));

    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_ONBOARD_005: Expired invitation token -> 401", async () => {
    const { token, payload } = await createInvitationToken(superToken);
    const invitationId = await getLatestInvitationIdByAdminEmail(
      payload.adminEmail,
    );

    await setInvitationStatus(invitationId as number, "PENDING", {
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await api
      .post("/api/v1/auth/airline/onboard")
      .send(validOnboardPayload(token, AIRLINE_TEST_PASSWORD));

    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_ONBOARD_006: Conflict when airline code already exists -> 409", async () => {
    const inviteData = validInvitePayload({
      airlineCode: "E2ECONFLICTCODE",
      companyRegistrationNumber: `E2ECRN-CONFLICT-${Date.now()}`,
      adminEmail: uniqueAirlineEmail("onboard-conflict-code"),
    });

    await insertAirlineRow({
      name: "Existing Airline",
      code: inviteData.airlineCode,
      countryCode: inviteData.countryCode,
      companyRegistrationNumber: `E2ECRN-EXIST-${Date.now()}`,
      contactEmail: uniqueAirlineEmail("existing-airline-contact"),
      contactPhone: "+971500000001",
      timezone: inviteData.timezone,
      address: inviteData.address,
      currency: inviteData.currency,
    });

    const inviteRes = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(inviteData);

    expect(inviteRes.status).toBe(201);
    const token = extractToken(inviteRes.body.data.onboardingLink as string);

    const res = await api
      .post("/api/v1/auth/airline/onboard")
      .send(validOnboardPayload(token));
    expect(res.status).toBe(409);
  });

  it("TC_AIRLINE_ONBOARD_007: Conflict when admin email already exists -> 409", async () => {
    const existingEmail = uniqueAirlineEmail("existing-airline-admin");
    const airlineId = await insertAirlineRow({
      name: "Existing Airline 2",
      code: `E2EEX${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      countryCode: "AE",
      companyRegistrationNumber: `E2ECRN-EXIST2-${Date.now()}`,
      contactEmail: uniqueAirlineEmail("existing-airline-contact2"),
      contactPhone: "+971500000002",
      timezone: "Asia/Dubai",
      address: "Existing Address",
      currency: "AED",
    });
    await insertAirlineUserRow({
      airlineId,
      email: existingEmail,
      password: AIRLINE_TEST_PASSWORD,
    });

    const { token } = await createInvitationToken(superToken, {
      adminEmail: existingEmail,
    });

    const res = await api
      .post("/api/v1/auth/airline/onboard")
      .send(validOnboardPayload(token));
    expect(res.status).toBe(409);
  });

  it("TC_AIRLINE_ONBOARD_008: Validation errors for missing fields and weak password -> 400", async () => {
    const missing = await api
      .post("/api/v1/auth/airline/onboard")
      .send({ password: AIRLINE_TEST_PASSWORD });
    expect(missing.status).toBe(400);

    const weak = await api
      .post("/api/v1/auth/airline/onboard")
      .send(validOnboardPayload("some-token", "weak"));
    expect(weak.status).toBe(400);
  });

  it("TC_AIRLINE_ONBOARD_009: Unknown field and malformed JSON -> 400", async () => {
    const unknown = await api.post("/api/v1/auth/airline/onboard").send({
      ...validOnboardPayload("abc", AIRLINE_TEST_PASSWORD),
      extraField: "bad",
    });
    expect(unknown.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/onboard")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_ONBOARD_010: Conflict when company registration number already exists -> 409", async () => {
    const existingCrn = `E2ECRN-DUP-${Date.now()}`;

    await insertAirlineRow({
      name: "CRN Duplicate Airline",
      code: `E2EDUP${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      countryCode: "AE",
      companyRegistrationNumber: existingCrn,
      contactEmail: uniqueAirlineEmail("crn-dup-contact"),
      contactPhone: "+971500000098",
      timezone: "Asia/Dubai",
      address: "Duplicate CRN Address",
      currency: "AED",
    });

    const inviteData = validInvitePayload({
      companyRegistrationNumber: existingCrn,
      airlineCode: `E2ECRND${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      adminEmail: uniqueAirlineEmail("crn-dup-admin"),
    });

    const inviteRes = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(inviteData);
    expect(inviteRes.status).toBe(201);
    const token = extractToken(inviteRes.body.data.onboardingLink as string);

    const res = await api
      .post("/api/v1/auth/airline/onboard")
      .send(validOnboardPayload(token));
    expect(res.status).toBe(409);
  });

  it("TC_AIRLINE_ONBOARD_011: Missing password field -> 400", async () => {
    const { token } = await createInvitationToken(superToken);
    const res = await api
      .post("/api/v1/auth/airline/onboard")
      .send({ invitationToken: token });
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_ONBOARD_012: Non-string invitationToken (numeric) -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/onboard")
      .send({ invitationToken: 12345, password: AIRLINE_TEST_PASSWORD });
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_ONBOARD_013: Non-string password (boolean) -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/onboard")
      .send({ invitationToken: "some-token", password: true });
    expect(res.status).toBe(400);
  });
});
