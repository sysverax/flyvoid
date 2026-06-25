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
  validTwoFactorEnablePayload,
} from "../../../fixtures/airline-auth.fixture";
import { validInvitePayload } from "../../../fixtures/airline-invitation.fixture";
import { deleteInvitationDataByPattern } from "../../../seeders/airline-invitation.seeder";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const ADMIN_EMAIL_PATTERN = "%@e2e-airline-auth.test";
const INVITE_PATTERN = "E2E%";
const SETUP_PATH = "/api/v1/auth/airline/2fa/setup";
const ENABLE_PATH = "/api/v1/auth/airline/2fa/enable";

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

wrapResponseLogging(SETUP_PATH);
wrapResponseLogging(ENABLE_PATH);

async function makeSuperAdminToken() {
  const adminEmail = uniqueAirlineEmail("platform-super-2fa-setup");
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

describe("POST /api/v1/auth/airline/2fa/setup & /2fa/enable", () => {
  let superToken = "";

  beforeAll(async () => {
    superToken = await makeSuperAdminToken();
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(ADMIN_EMAIL_PATTERN);
    await endPool();
  });

  it("TC_AIRLINE_2FA_SETUP_001: Setup with valid bearer token -> 200", async () => {
    const email = uniqueAirlineEmail("setup-user");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const res = await api
      .post("/api/v1/auth/airline/2fa/setup")
      .set("Authorization", `Bearer ${tokens.accessToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.manualEntryKey).toBe("string");
    expect(
      (res.body.data.qrCodeDataUrl as string).startsWith(
        "data:image/png;base64,",
      ),
    ).toBe(true);
  });

  it("TC_AIRLINE_2FA_SETUP_002: Setup without/invalid token -> 401", async () => {
    const noToken = await api.post("/api/v1/auth/airline/2fa/setup");
    expect(noToken.status).toBe(401);

    const badToken = await api
      .post("/api/v1/auth/airline/2fa/setup")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(badToken.status).toBe(401);
  });

  it("TC_AIRLINE_2FA_SETUP_003: 2FA already enabled — repeat setup attempt -> 409", async () => {
    const email = uniqueAirlineEmail("setup-already-enabled");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const setup = await api
      .post("/api/v1/auth/airline/2fa/setup")
      .set("Authorization", `Bearer ${tokens.accessToken}`);
    expect(setup.status).toBe(200);

    const secret = setup.body.data.manualEntryKey as string;
    const code = speakeasy.totp({ secret, encoding: "base32" });

    await api
      .post("/api/v1/auth/airline/2fa/enable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ twoFactorCode: code });

    const repeat = await api
      .post("/api/v1/auth/airline/2fa/setup")
      .set("Authorization", `Bearer ${tokens.accessToken}`);
    expect(repeat.status).toBe(409);
  });

  it("TC_AIRLINE_2FA_ENABLE_001: Enable with valid TOTP after setup -> 200", async () => {
    const email = uniqueAirlineEmail("enable-user");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const setup = await api
      .post("/api/v1/auth/airline/2fa/setup")
      .set("Authorization", `Bearer ${tokens.accessToken}`);
    const manualEntryKey = setup.body.data.manualEntryKey as string;

    const code = speakeasy.totp({ secret: manualEntryKey, encoding: "base32" });
    const enable = await api
      .post("/api/v1/auth/airline/2fa/enable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send(validTwoFactorEnablePayload(code));

    expect(enable.status).toBe(200);
    expect(Array.isArray(enable.body.data.recoveryCodes)).toBe(true);
    expect(enable.body.data.recoveryCodes.length).toBeGreaterThan(0);
  });

  it("TC_AIRLINE_2FA_ENABLE_002: Wrong TOTP or no setup context -> 401", async () => {
    const email = uniqueAirlineEmail("enable-wrong-totp");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    await api
      .post("/api/v1/auth/airline/2fa/setup")
      .set("Authorization", `Bearer ${tokens.accessToken}`);

    const wrongTotp = await api
      .post("/api/v1/auth/airline/2fa/enable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send(validTwoFactorEnablePayload("000000"));
    expect(wrongTotp.status).toBe(401);

    const emailNoSetup = uniqueAirlineEmail("enable-no-setup");
    await onboardAirlineUser(superToken, emailNoSetup, AIRLINE_TEST_PASSWORD);
    const tokensNoSetup = await getAirlineTokens(
      emailNoSetup,
      AIRLINE_TEST_PASSWORD,
    );

    const noSetup = await api
      .post("/api/v1/auth/airline/2fa/enable")
      .set("Authorization", `Bearer ${tokensNoSetup.accessToken}`)
      .send(validTwoFactorEnablePayload("123456"));
    expect(noSetup.status).toBe(401);
  });

  it("TC_AIRLINE_2FA_ENABLE_003: Without/invalid bearer token -> 401", async () => {
    const noToken = await api
      .post("/api/v1/auth/airline/2fa/enable")
      .send(validTwoFactorEnablePayload("123456"));
    expect(noToken.status).toBe(401);

    const badToken = await api
      .post("/api/v1/auth/airline/2fa/enable")
      .set("Authorization", "Bearer badtoken")
      .send(validTwoFactorEnablePayload("123456"));
    expect(badToken.status).toBe(401);
  });

  it("TC_AIRLINE_2FA_ENABLE_004: Validation unknown fields/malformed JSON -> 400", async () => {
    const email = uniqueAirlineEmail("enable-validation");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    await api
      .post("/api/v1/auth/airline/2fa/setup")
      .set("Authorization", `Bearer ${tokens.accessToken}`);

    const unknown = await api
      .post("/api/v1/auth/airline/2fa/enable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ twoFactorCode: "123456", unknown: "bad" });
    expect(unknown.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/2fa/enable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_2FA_ENABLE_005: Missing twoFactorCode field -> 400", async () => {
    const email = uniqueAirlineEmail("enable-missing-code");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    await api
      .post("/api/v1/auth/airline/2fa/setup")
      .set("Authorization", `Bearer ${tokens.accessToken}`);

    const res = await api
      .post("/api/v1/auth/airline/2fa/enable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_2FA_ENABLE_006: Non-string twoFactorCode (numeric) -> 400", async () => {
    const email = uniqueAirlineEmail("enable-numeric-code");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    await api
      .post("/api/v1/auth/airline/2fa/setup")
      .set("Authorization", `Bearer ${tokens.accessToken}`);

    const res = await api
      .post("/api/v1/auth/airline/2fa/enable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ twoFactorCode: 123456 });
    expect(res.status).toBe(400);
  });
});
