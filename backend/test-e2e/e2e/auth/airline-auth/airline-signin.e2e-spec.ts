import { Logger } from "@nestjs/common";
import * as speakeasy from "speakeasy";
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { signupAndGetTokens } from "../../../helpers/auth.helper";
import { getAirlineTokens } from "../../../helpers/airline-auth.helper";
import {
  AIRLINE_TEST_PASSWORD,
  uniqueAirlineEmail,
  validAirlineSigninPayload,
} from "../../../fixtures/airline-auth.fixture";
import { validInvitePayload } from "../../../fixtures/airline-invitation.fixture";
import {
  deleteInvitationDataByPattern,
  insertAirlineRow,
  insertAirlineUserRow,
} from "../../../seeders/airline-invitation.seeder";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const ADMIN_EMAIL_PATTERN = "%@e2e-airline-auth.test";
const INVITE_PATTERN = "E2E%";
const SIGNIN_PATH = "/api/v1/auth/airline/signin";

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

wrapResponseLogging(SIGNIN_PATH);

async function makeSuperAdminToken() {
  const adminEmail = uniqueAirlineEmail("platform-super-signin");
  const tokens = await signupAndGetTokens(
    "Platform",
    "Super",
    adminEmail,
    AIRLINE_TEST_PASSWORD,
  );
  return tokens.accessToken;
}

async function onboardAirlineUser(
  superToken: string,
  email: string,
  password: string,
) {
  const inviteRes = await api
    .post("/api/v1/airline/invitations")
    .set("Authorization", `Bearer ${superToken}`)
    .send(validInvitePayload({ adminEmail: email }));

  const token = extractToken(inviteRes.body.data.onboardingLink as string);

  const onboardRes = await api
    .post("/api/v1/auth/airline/onboard")
    .send({ invitationToken: token, password });

  if (onboardRes.status !== 200) {
    throw new Error(`onboardAirlineUser failed: ${onboardRes.status}`);
  }
}

describe("POST /api/v1/auth/airline/signin", () => {
  let superToken = "";
  let activeEmail = "";

  beforeAll(async () => {
    superToken = await makeSuperAdminToken();

    activeEmail = uniqueAirlineEmail("signin-active");
    await onboardAirlineUser(superToken, activeEmail, AIRLINE_TEST_PASSWORD);
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(ADMIN_EMAIL_PATTERN);
    await endPool();
  });

  it("TC_AIRLINE_SIGNIN_001: Signin success with valid credentials -> 200", async () => {
    const res = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload(activeEmail, AIRLINE_TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(typeof res.body.data.refreshToken).toBe("string");
  });

  it("TC_AIRLINE_SIGNIN_002: Invalid email/password/non-existing account -> 401", async () => {
    const invalidPassword = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload(activeEmail, "WrongPass@999"));
    expect(invalidPassword.status).toBe(401);

    const nonExisting = await api
      .post("/api/v1/auth/airline/signin")
      .send(
        validAirlineSigninPayload(
          uniqueAirlineEmail("ghost"),
          AIRLINE_TEST_PASSWORD,
        ),
      );
    expect(nonExisting.status).toBe(401);
  });

  it("TC_AIRLINE_SIGNIN_003: Inactive airline account signin -> 401", async () => {
    const airlineId = await insertAirlineRow({
      name: "Inactive Airline",
      code: `E2EIN${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      countryCode: "AE",
      companyRegistrationNumber: `E2ECRN-INACTIVE-${Date.now()}`,
      contactEmail: uniqueAirlineEmail("inactive-contact"),
      contactPhone: "+971500000010",
      timezone: "Asia/Dubai",
      address: "Inactive Address",
      currency: "AED",
    });

    const inactiveEmail = uniqueAirlineEmail("inactive-user");
    await insertAirlineUserRow({
      airlineId,
      email: inactiveEmail,
      password: AIRLINE_TEST_PASSWORD,
      isActive: false,
    });

    const res = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload(inactiveEmail, AIRLINE_TEST_PASSWORD));

    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_SIGNIN_004: Validation for invalid format/missing fields/short password -> 400", async () => {
    const invalidEmail = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload("not-an-email", AIRLINE_TEST_PASSWORD));
    expect(invalidEmail.status).toBe(400);

    const missingEmail = await api
      .post("/api/v1/auth/airline/signin")
      .send({ password: AIRLINE_TEST_PASSWORD });
    expect(missingEmail.status).toBe(400);

    const shortPassword = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload(activeEmail, "short"));
    expect(shortPassword.status).toBe(400);
  });

  it("TC_AIRLINE_SIGNIN_005: RequiresPasswordReset challenge response -> 200", async () => {
    const airlineId = await insertAirlineRow({
      name: "Reset Challenge Airline",
      code: `E2ERC${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      countryCode: "AE",
      companyRegistrationNumber: `E2ECRN-RESET-${Date.now()}`,
      contactEmail: uniqueAirlineEmail("reset-contact"),
      contactPhone: "+971500000011",
      timezone: "Asia/Dubai",
      address: "Reset Address",
      currency: "AED",
    });

    const resetEmail = uniqueAirlineEmail("reset-user");
    await insertAirlineUserRow({
      airlineId,
      email: resetEmail,
      password: AIRLINE_TEST_PASSWORD,
      requirePasswordReset: true,
    });

    const res = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload(resetEmail, AIRLINE_TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.data.requiresPasswordReset).toBe(true);
    expect(typeof res.body.data.resetPasswordToken).toBe("string");
  });

  it("TC_AIRLINE_SIGNIN_006: RequiresTwoFactor challenge response -> 200", async () => {
    const twoFaEmail = uniqueAirlineEmail("twofa-signin");
    await onboardAirlineUser(superToken, twoFaEmail, AIRLINE_TEST_PASSWORD);

    const tokens = await getAirlineTokens(twoFaEmail, AIRLINE_TEST_PASSWORD);

    const setupRes = await api
      .post("/api/v1/auth/airline/2fa/setup")
      .set("Authorization", `Bearer ${tokens.accessToken}`);
    const manualEntryKey = setupRes.body.data.manualEntryKey as string;

    const code = speakeasy.totp({ secret: manualEntryKey, encoding: "base32" });
    await api
      .post("/api/v1/auth/airline/2fa/enable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ twoFactorCode: code });

    const res = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload(twoFaEmail, AIRLINE_TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body.data.requiresTwoFactor).toBe(true);
    expect(typeof res.body.data.twoFactorToken).toBe("string");
  });

  it("TC_AIRLINE_SIGNIN_007: Unknown fields and malformed JSON -> 400", async () => {
    const unknown = await api.post("/api/v1/auth/airline/signin").send({
      email: activeEmail,
      password: AIRLINE_TEST_PASSWORD,
      unknown: "bad",
    });
    expect(unknown.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/signin")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_SIGNIN_008: Email case insensitivity -> 200", async () => {
    const res = await api
      .post("/api/v1/auth/airline/signin")
      .send(
        validAirlineSigninPayload(
          activeEmail.toUpperCase(),
          AIRLINE_TEST_PASSWORD,
        ),
      );
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe("string");
  });

  it("TC_AIRLINE_SIGNIN_009: Successful response includes token expiry fields -> 200", async () => {
    const res = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload(activeEmail, AIRLINE_TEST_PASSWORD));

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(typeof res.body.data.refreshToken).toBe("string");
    expect(typeof res.body.data.accessTokenExpiresIn).toBe("string");
    expect(typeof res.body.data.refreshTokenExpiresIn).toBe("string");
  });

  it("TC_AIRLINE_SIGNIN_010: Inactive airline (airline-level isActive=false) signin -> 401", async () => {
    const inactiveAirlineId = await insertAirlineRow({
      name: "Inactive Airline Corp",
      code: `E2EIAC${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      countryCode: "AE",
      companyRegistrationNumber: `E2ECRN-IAC-${Date.now()}`,
      contactEmail: uniqueAirlineEmail("iac-contact"),
      contactPhone: "+971500000030",
      timezone: "Asia/Dubai",
      address: "Inactive Corp Address",
      currency: "AED",
      isActive: false,
    });

    const inactiveAirlineUserEmail = uniqueAirlineEmail("iac-user");
    await insertAirlineUserRow({
      airlineId: inactiveAirlineId,
      email: inactiveAirlineUserEmail,
      password: AIRLINE_TEST_PASSWORD,
      isActive: true,
    });

    const res = await api
      .post("/api/v1/auth/airline/signin")
      .send(
        validAirlineSigninPayload(
          inactiveAirlineUserEmail,
          AIRLINE_TEST_PASSWORD,
        ),
      );
    expect(res.status).toBe(401);
  });
});
