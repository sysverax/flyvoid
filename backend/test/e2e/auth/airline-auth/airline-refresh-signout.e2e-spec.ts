import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { signupAndGetTokens } from "../../../helpers/auth.helper";
import { getAirlineTokens } from "../../../helpers/airline-auth.helper";
import {
  AIRLINE_NEW_PASSWORD,
  AIRLINE_TEST_PASSWORD,
  uniqueAirlineEmail,
  refreshTokenPayload,
  signoutPayload,
  validAirlineForgotPasswordSendOtpPayload,
  validAirlineForgotPasswordVerifyOtpPayload,
  validAirlineForgotPasswordResetPayload,
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
  const adminEmail = uniqueAirlineEmail("platform-super-refresh");
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

describe("Airline refresh and signout", () => {
  let superToken = "";
  let email = "";

  beforeAll(async () => {
    superToken = await makeSuperAdminToken();
    email = uniqueAirlineEmail("refresh-user");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(ADMIN_EMAIL_PATTERN);
    await endPool();
  });

  it("TC_AIRLINE_REFRESH_001: valid refresh token rotation -> 200", async () => {
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const res = await api
      .post("/api/v1/auth/airline/refresh")
      .send(refreshTokenPayload(tokens.refreshToken));

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe("string");
    expect(typeof res.body.data.refreshToken).toBe("string");
    expect(res.body.data.refreshToken).not.toBe(tokens.refreshToken);
  });

  it("TC_AIRLINE_REFRESH_002: invalid/expired/revoked refresh token -> 401", async () => {
    const bad = await api
      .post("/api/v1/auth/airline/refresh")
      .send(refreshTokenPayload("bad.token"));
    expect(bad.status).toBe(401);

    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);
    const signout = await api
      .post("/api/v1/auth/airline/signout")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send(signoutPayload(tokens.refreshToken));
    expect(signout.status).toBe(200);

    const revoked = await api
      .post("/api/v1/auth/airline/refresh")
      .send(refreshTokenPayload(tokens.refreshToken));
    expect(revoked.status).toBe(401);
  });

  it("TC_AIRLINE_REFRESH_003: validation unknown fields/malformed JSON -> 400", async () => {
    const unknown = await api
      .post("/api/v1/auth/airline/refresh")
      .send({ refreshToken: "x", unknown: "bad" });
    expect(unknown.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/refresh")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_REFRESH_004: Refresh token invalidated after forgot-password reset -> 401", async () => {
    const refreshEmail = uniqueAirlineEmail("refresh-after-reset");
    await onboardAirlineUser(superToken, refreshEmail, AIRLINE_TEST_PASSWORD);

    const { refreshToken } = await getAirlineTokens(
      refreshEmail,
      AIRLINE_TEST_PASSWORD,
    );

    await api
      .post("/api/v1/auth/airline/forgot-password/send-otp")
      .send(validAirlineForgotPasswordSendOtpPayload(refreshEmail));

    const verifyRes = await api
      .post("/api/v1/auth/airline/forgot-password/verify-otp")
      .send(validAirlineForgotPasswordVerifyOtpPayload(refreshEmail, "444444"));
    const resetToken = (
      verifyRes.body.data as { resetPasswordToken: string }
    ).resetPasswordToken;

    await api
      .post("/api/v1/auth/airline/forgot-password")
      .send(
        validAirlineForgotPasswordResetPayload(resetToken, AIRLINE_NEW_PASSWORD),
      );

    const res = await api
      .post("/api/v1/auth/airline/refresh")
      .send(refreshTokenPayload(refreshToken));
    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_REFRESH_005: Missing refreshToken field -> 400", async () => {
    const res = await api.post("/api/v1/auth/airline/refresh").send({});
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_SIGNOUT_001: valid bearer + valid refresh token -> 200", async () => {
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const res = await api
      .post("/api/v1/auth/airline/signout")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send(signoutPayload(tokens.refreshToken));

    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_SIGNOUT_002: missing/invalid bearer token -> 401", async () => {
    const noToken = await api
      .post("/api/v1/auth/airline/signout")
      .send(signoutPayload("some-token"));
    expect(noToken.status).toBe(401);

    const badToken = await api
      .post("/api/v1/auth/airline/signout")
      .set("Authorization", "Bearer badtoken")
      .send(signoutPayload("some-token"));
    expect(badToken.status).toBe(401);
  });

  it("TC_AIRLINE_SIGNOUT_003: token belongs to another user or revoked token -> 401", async () => {
    const email2 = uniqueAirlineEmail("refresh-user-2");
    await onboardAirlineUser(superToken, email2, AIRLINE_TEST_PASSWORD);

    const user1 = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);
    const user2 = await getAirlineTokens(email2, AIRLINE_TEST_PASSWORD);

    const mismatch = await api
      .post("/api/v1/auth/airline/signout")
      .set("Authorization", `Bearer ${user1.accessToken}`)
      .send(signoutPayload(user2.refreshToken));
    expect(mismatch.status).toBe(401);

    await api
      .post("/api/v1/auth/airline/signout")
      .set("Authorization", `Bearer ${user1.accessToken}`)
      .send(signoutPayload(user1.refreshToken));

    const revoked = await api
      .post("/api/v1/auth/airline/signout")
      .set("Authorization", `Bearer ${user1.accessToken}`)
      .send(signoutPayload(user1.refreshToken));
    expect(revoked.status).toBe(401);
  });

  it("TC_AIRLINE_SIGNOUT_004: validation unknown fields/malformed JSON -> 400", async () => {
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const unknown = await api
      .post("/api/v1/auth/airline/signout")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ refreshToken: tokens.refreshToken, extra: "bad" });
    expect(unknown.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/signout")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_SIGNOUT_005: Using own accessToken as body refreshToken field -> 401", async () => {
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const res = await api
      .post("/api/v1/auth/airline/signout")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send(signoutPayload(tokens.accessToken));
    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_SIGNOUT_006: Tampered refreshToken signature in body -> 401", async () => {
    const tokens = await getAirlineTokens(email, AIRLINE_TEST_PASSWORD);

    const parts = tokens.refreshToken.split(".");
    parts[2] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const tampered = parts.join(".");

    const res = await api
      .post("/api/v1/auth/airline/signout")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send(signoutPayload(tampered));
    expect(res.status).toBe(401);
  });
});
