import * as speakeasy from "speakeasy";
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { signupAndGetTokens } from "../../../helpers/auth.helper";
import { getAirlineTokens } from "../../../helpers/airline-auth.helper";
import {
  AIRLINE_TEST_PASSWORD,
  uniqueAirlineEmail,
  validTwoFactorDisablePayload,
  validTwoFactorRecoverPayload,
} from "../../../fixtures/airline-auth.fixture";
import { validInvitePayload } from "../../../fixtures/airline-invitation.fixture";
import { deleteInvitationDataByPattern } from "../../../seeders/airline-invitation.seeder";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const ADMIN_EMAIL_PATTERN = "%@e2e-airline-auth.test";
const INVITE_PATTERN = "E2E%";

function extractToken(onboardingLink: string): string {
  return new URL(onboardingLink).searchParams.get("token") as string;
}

async function makeSuperAdminToken() {
  const adminEmail = uniqueAirlineEmail("platform-super-2fa-disable");
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

async function setupEnabledUser(superToken: string) {
  const email = uniqueAirlineEmail("twofa-disable-user");
  await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
  const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

  const setup = await api
    .post("/api/v1/auth/airline/2fa/setup")
    .set("Authorization", `Bearer ${tokens.accessToken}`);

  const secret = setup.body.data.manualEntryKey as string;
  const code = speakeasy.totp({ secret, encoding: "base32" });

  const enable = await api
    .post("/api/v1/auth/airline/2fa/enable")
    .set("Authorization", `Bearer ${tokens.accessToken}`)
    .send({ twoFactorCode: code });

  return {
    email,
    accessToken: tokens.accessToken,
    secret,
    recoveryCodes: enable.body.data.recoveryCodes as string[],
  };
}

describe("POST /api/v1/auth/airline/2fa/disable & /2fa/recover", () => {
  let superToken = "";

  beforeAll(async () => {
    superToken = await makeSuperAdminToken();
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(ADMIN_EMAIL_PATTERN);
    await endPool();
  });

  it("TC_AIRLINE_2FA_DISABLE_001: Disable with valid bearer + valid TOTP -> 200", async () => {
    const user = await setupEnabledUser(superToken);
    const code = speakeasy.totp({ secret: user.secret, encoding: "base32" });

    const res = await api
      .post("/api/v1/auth/airline/2fa/disable")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send(validTwoFactorDisablePayload(code));

    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_2FA_DISABLE_002: Wrong TOTP or not-enabled state -> 401", async () => {
    const user = await setupEnabledUser(superToken);

    const wrong = await api
      .post("/api/v1/auth/airline/2fa/disable")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send(validTwoFactorDisablePayload("000000"));
    expect(wrong.status).toBe(401);

    const email = uniqueAirlineEmail("disable-not-enabled");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const notEnabled = await api
      .post("/api/v1/auth/airline/2fa/disable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send(validTwoFactorDisablePayload("123456"));
    expect(notEnabled.status).toBe(401);
  });

  it("TC_AIRLINE_2FA_DISABLE_003: Without/invalid bearer token and malformed JSON -> 401/400", async () => {
    const noToken = await api
      .post("/api/v1/auth/airline/2fa/disable")
      .send(validTwoFactorDisablePayload("123456"));
    expect(noToken.status).toBe(401);

    const badToken = await api
      .post("/api/v1/auth/airline/2fa/disable")
      .set("Authorization", "Bearer invalid")
      .send(validTwoFactorDisablePayload("123456"));
    expect(badToken.status).toBe(401);

    const email = uniqueAirlineEmail("disable-malformed");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const malformed = await api
      .post("/api/v1/auth/airline/2fa/disable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_2FA_DISABLE_004: Unknown field in disable payload -> 400", async () => {
    const email = uniqueAirlineEmail("disable-unknown-field");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const res = await api
      .post("/api/v1/auth/airline/2fa/disable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ twoFactorCode: "123456", extra: "bad" });
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_2FA_DISABLE_005: Missing twoFactorCode field -> 400", async () => {
    const email = uniqueAirlineEmail("disable-missing-code");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const res = await api
      .post("/api/v1/auth/airline/2fa/disable")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_2FA_RECOVER_001: Valid email/password/recoveryCode disables 2FA -> 200", async () => {
    const user = await setupEnabledUser(superToken);
    const recoveryCode = user.recoveryCodes[0];

    const res = await api
      .post("/api/v1/auth/airline/2fa/recover")
      .send(
        validTwoFactorRecoverPayload(
          user.email,
          AIRLINE_TEST_PASSWORD,
          recoveryCode,
        ),
      );

    expect(res.status).toBe(200);

    const signin = await api
      .post("/api/v1/auth/airline/signin")
      .send({ email: user.email, password: AIRLINE_TEST_PASSWORD });

    expect(signin.status).toBe(200);
    expect(signin.body.data.requiresTwoFactor).toBeUndefined();
    expect(typeof signin.body.data.accessToken).toBe("string");
  });

  it("TC_AIRLINE_2FA_RECOVER_002: Invalid credentials/recovery code/non-enabled -> 401", async () => {
    const user = await setupEnabledUser(superToken);

    const wrongPassword = await api
      .post("/api/v1/auth/airline/2fa/recover")
      .send(
        validTwoFactorRecoverPayload(
          user.email,
          "WrongPass@999",
          user.recoveryCodes[0],
        ),
      );
    expect(wrongPassword.status).toBe(401);

    const wrongCode = await api
      .post("/api/v1/auth/airline/2fa/recover")
      .send(
        validTwoFactorRecoverPayload(
          user.email,
          AIRLINE_TEST_PASSWORD,
          "BADCODE123",
        ),
      );
    expect(wrongCode.status).toBe(401);

    const email = uniqueAirlineEmail("recover-not-enabled");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);

    const notEnabled = await api
      .post("/api/v1/auth/airline/2fa/recover")
      .send(
        validTwoFactorRecoverPayload(
          email,
          AIRLINE_TEST_PASSWORD,
          "ANYCODE123",
        ),
      );
    expect(notEnabled.status).toBe(401);
  });

  it("TC_AIRLINE_2FA_RECOVER_003: Validation unknown fields/malformed JSON -> 400", async () => {
    const unknown = await api.post("/api/v1/auth/airline/2fa/recover").send({
      email: "bad",
      password: "short",
      recoveryCode: "x",
      unknown: "bad",
    });
    expect(unknown.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/2fa/recover")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_2FA_RECOVER_004: Recovery code is single-use — reuse after successful recovery -> 401", async () => {
    const user = await setupEnabledUser(superToken);
    const recoveryCode = user.recoveryCodes[0];

    const first = await api
      .post("/api/v1/auth/airline/2fa/recover")
      .send(
        validTwoFactorRecoverPayload(
          user.email,
          AIRLINE_TEST_PASSWORD,
          recoveryCode,
        ),
      );
    expect(first.status).toBe(200);

    const second = await api
      .post("/api/v1/auth/airline/2fa/recover")
      .send(
        validTwoFactorRecoverPayload(
          user.email,
          AIRLINE_TEST_PASSWORD,
          recoveryCode,
        ),
      );
    expect(second.status).toBe(401);
  });

  it("TC_AIRLINE_2FA_RECOVER_005: Missing required fields -> 400", async () => {
    const missingCode = await api
      .post("/api/v1/auth/airline/2fa/recover")
      .send({ email: "test@example.com", password: AIRLINE_TEST_PASSWORD });
    expect(missingCode.status).toBe(400);

    const missingEmail = await api
      .post("/api/v1/auth/airline/2fa/recover")
      .send({ password: AIRLINE_TEST_PASSWORD, recoveryCode: "SOMECODE123" });
    expect(missingEmail.status).toBe(400);
  });
});
