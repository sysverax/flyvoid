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
  validTwoFactorVerifyPayload,
} from "../../../fixtures/airline-auth.fixture";
import { validInvitePayload } from "../../../fixtures/airline-invitation.fixture";
import { deleteInvitationDataByPattern } from "../../../seeders/airline-invitation.seeder";
import { describe, it } from "node:test";
import { beforeAll, afterAll, expect } from "@jest/globals";

const ADMIN_EMAIL_PATTERN = "%@e2e-airline-auth.test";
const INVITE_PATTERN = "E2E%";

function extractToken(onboardingLink: string): string {
  return new URL(onboardingLink).searchParams.get("token") as string;
}

async function makeSuperAdminToken() {
  const adminEmail = uniqueAirlineEmail("platform-super-2fa-verify");
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

async function setupEnabledTwoFactorUser(superToken: string) {
  const email = uniqueAirlineEmail("twofa-verify-user");
  await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);

  const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

  const setupRes = await api
    .post("/api/v1/auth/airline/2fa/setup")
    .set("Authorization", `Bearer ${tokens.accessToken}`);

  const secret = setupRes.body.data.manualEntryKey as string;

  const enableCode = speakeasy.totp({ secret, encoding: "base32" });
  await api
    .post("/api/v1/auth/airline/2fa/enable")
    .set("Authorization", `Bearer ${tokens.accessToken}`)
    .send({ twoFactorCode: enableCode });

  const challengeRes = await api
    .post("/api/v1/auth/airline/signin")
    .send(validAirlineSigninPayload(email, AIRLINE_TEST_PASSWORD));

  return {
    email,
    secret,
    twoFactorToken: challengeRes.body.data.twoFactorToken as string,
  };
}

describe("POST /api/v1/auth/airline/signin/2fa/verify", () => {
  let superToken = "";

  beforeAll(async () => {
    superToken = await makeSuperAdminToken();
  });

  afterAll(async () => {
    await deleteAdminsByEmailPattern(ADMIN_EMAIL_PATTERN);
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await endPool();
  });

  it("TC_AIRLINE_2FA_VERIFY_001: Valid challenge token + valid TOTP -> 200", async () => {
    const user = await setupEnabledTwoFactorUser(superToken);
    const code = speakeasy.totp({ secret: user.secret, encoding: "base32" });

    const res = await api
      .post("/api/v1/auth/airline/signin/2fa/verify")
      .send(validTwoFactorVerifyPayload(user.twoFactorToken, code));

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(typeof res.body.data.refreshToken).toBe("string");
  });

  it("TC_AIRLINE_2FA_VERIFY_002: Invalid or expired twoFactorToken -> 401", async () => {
    const res = await api
      .post("/api/v1/auth/airline/signin/2fa/verify")
      .send(validTwoFactorVerifyPayload("bad.token.value", "123456"));

    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_2FA_VERIFY_003: Wrong twoFactorCode -> 401", async () => {
    const user = await setupEnabledTwoFactorUser(superToken);

    const res = await api
      .post("/api/v1/auth/airline/signin/2fa/verify")
      .send(validTwoFactorVerifyPayload(user.twoFactorToken, "000000"));

    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_2FA_VERIFY_004: Non-2FA-enabled account attempt -> 401", async () => {
    const email = uniqueAirlineEmail("twofa-not-enabled");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);

    const signinRes = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload(email, AIRLINE_TEST_PASSWORD));

    expect(signinRes.body.data.requiresTwoFactor).toBeUndefined();

    const res = await api
      .post("/api/v1/auth/airline/signin/2fa/verify")
      .send(validTwoFactorVerifyPayload("some-challenge-token", "123456"));

    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_2FA_VERIFY_005: Validation missing fields/bad format -> 400", async () => {
    const missing = await api
      .post("/api/v1/auth/airline/signin/2fa/verify")
      .send({ twoFactorCode: "123456" });
    expect(missing.status).toBe(400);

    const format = await api
      .post("/api/v1/auth/airline/signin/2fa/verify")
      .send({ twoFactorToken: "abc", twoFactorCode: "12ab56" });
    expect(format.status).toBe(400);
  });

  it("TC_AIRLINE_2FA_VERIFY_006: Unknown field and malformed JSON -> 400", async () => {
    const unknown = await api
      .post("/api/v1/auth/airline/signin/2fa/verify")
      .send({ twoFactorToken: "abc", twoFactorCode: "123456", extra: "bad" });
    expect(unknown.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/signin/2fa/verify")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });
});
