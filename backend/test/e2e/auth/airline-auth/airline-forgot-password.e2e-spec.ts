import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { signupAndGetTokens } from "../../../helpers/auth.helper";
import {
  AIRLINE_NEW_PASSWORD,
  AIRLINE_TEST_PASSWORD,
  uniqueAirlineEmail,
  validAirlineForgotPasswordResetPayload,
  validAirlineForgotPasswordSendOtpPayload,
  validAirlineForgotPasswordVerifyOtpPayload,
  validAirlineSigninPayload,
} from "../../../fixtures/airline-auth.fixture";
import { validInvitePayload } from "../../../fixtures/airline-invitation.fixture";
import { deleteInvitationDataByPattern } from "../../../seeders/airline-invitation.seeder";
import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";

const ADMIN_EMAIL_PATTERN = "%@e2e-airline-auth.test";
const INVITE_PATTERN = "E2E%";
const STATIC_OTP = "444444";

function extractToken(onboardingLink: string): string {
  return new URL(onboardingLink).searchParams.get("token") as string;
}

async function makeSuperAdminToken() {
  const adminEmail = uniqueAirlineEmail("platform-super-forgot");
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

describe("Airline forgot password flow", () => {
  let superToken = "";
  let email = "";

  beforeAll(async () => {
    superToken = await makeSuperAdminToken();
    email = uniqueAirlineEmail("forgot-flow");
    await onboardAirlineUser(superToken, email, AIRLINE_TEST_PASSWORD);
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(ADMIN_EMAIL_PATTERN);
    await endPool();
  });

  it("TC_AIRLINE_FORGOT_SEND_001: send-otp for existing active account -> 200", async () => {
    const res = await api
      .post("/api/v1/auth/airline/forgot-password/send-otp")
      .send(validAirlineForgotPasswordSendOtpPayload(email));

    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_FORGOT_SEND_002: send-otp for unknown account remains generic -> 200", async () => {
    const res = await api
      .post("/api/v1/auth/airline/forgot-password/send-otp")
      .send(
        validAirlineForgotPasswordSendOtpPayload(
          uniqueAirlineEmail("ghost-forgot"),
        ),
      );

    expect(res.status).toBe(200);
  });

  it("TC_AIRLINE_FORGOT_SEND_003: send-otp validation and malformed JSON -> 400", async () => {
    const invalid = await api
      .post("/api/v1/auth/airline/forgot-password/send-otp")
      .send({ email: "not-email" });
    expect(invalid.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/forgot-password/send-otp")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_FORGOT_SEND_004: send-otp with unknown field -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/forgot-password/send-otp")
      .send({ email, extra: "bad" });
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_FORGOT_SEND_005: send-otp missing email field -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/forgot-password/send-otp")
      .send({});
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_FORGOT_VERIFY_001: verify-otp with valid static OTP -> 200", async () => {
    await api
      .post("/api/v1/auth/airline/forgot-password/send-otp")
      .send(validAirlineForgotPasswordSendOtpPayload(email));

    const verify = await api
      .post("/api/v1/auth/airline/forgot-password/verify-otp")
      .send(validAirlineForgotPasswordVerifyOtpPayload(email, STATIC_OTP));

    expect(verify.status).toBe(200);
    expect(typeof verify.body.data.resetPasswordToken).toBe("string");
  });

  it("TC_AIRLINE_FORGOT_VERIFY_002: invalid OTP/non-existing/no prior send -> 401", async () => {
    const invalid = await api
      .post("/api/v1/auth/airline/forgot-password/verify-otp")
      .send(validAirlineForgotPasswordVerifyOtpPayload(email, "000000"));
    expect(invalid.status).toBe(401);

    const missingFlow = await api
      .post("/api/v1/auth/airline/forgot-password/verify-otp")
      .send(
        validAirlineForgotPasswordVerifyOtpPayload(
          uniqueAirlineEmail("ghost2"),
          STATIC_OTP,
        ),
      );
    expect(missingFlow.status).toBe(401);
  });

  it("TC_AIRLINE_FORGOT_VERIFY_003: verify-otp validation and malformed JSON -> 400", async () => {
    const invalid = await api
      .post("/api/v1/auth/airline/forgot-password/verify-otp")
      .send({ email, otp: "12ab56" });
    expect(invalid.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/forgot-password/verify-otp")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_FORGOT_VERIFY_004: verify-otp with unknown field -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/forgot-password/verify-otp")
      .send({ email, otp: STATIC_OTP, extra: "bad" });
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_FORGOT_VERIFY_005: verify-otp missing otp field -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/forgot-password/verify-otp")
      .send({ email });
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_FORGOT_RESET_001: valid reset token + strong password -> 200", async () => {
    await api
      .post("/api/v1/auth/airline/forgot-password/send-otp")
      .send(validAirlineForgotPasswordSendOtpPayload(email));

    const verify = await api
      .post("/api/v1/auth/airline/forgot-password/verify-otp")
      .send(validAirlineForgotPasswordVerifyOtpPayload(email, STATIC_OTP));

    const resetToken = verify.body.data.resetPasswordToken as string;

    const reset = await api
      .post("/api/v1/auth/airline/forgot-password")
      .send(
        validAirlineForgotPasswordResetPayload(
          resetToken,
          AIRLINE_NEW_PASSWORD,
        ),
      );

    expect(reset.status).toBe(200);

    const signin = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload(email, AIRLINE_NEW_PASSWORD));
    expect(signin.status).toBe(200);
  });

  it("TC_AIRLINE_FORGOT_RESET_002: invalid/reused token and weak password -> 401/400", async () => {
    const invalidToken = await api
      .post("/api/v1/auth/airline/forgot-password")
      .send(
        validAirlineForgotPasswordResetPayload(
          "bad.token",
          AIRLINE_TEST_PASSWORD,
        ),
      );
    expect(invalidToken.status).toBe(401);

    await api
      .post("/api/v1/auth/airline/forgot-password/send-otp")
      .send(validAirlineForgotPasswordSendOtpPayload(email));
    const verify = await api
      .post("/api/v1/auth/airline/forgot-password/verify-otp")
      .send(validAirlineForgotPasswordVerifyOtpPayload(email, STATIC_OTP));

    const token = verify.body.data.resetPasswordToken as string;
    const first = await api
      .post("/api/v1/auth/airline/forgot-password")
      .send(
        validAirlineForgotPasswordResetPayload(token, AIRLINE_TEST_PASSWORD),
      );
    expect(first.status).toBe(200);

    const reused = await api
      .post("/api/v1/auth/airline/forgot-password")
      .send(
        validAirlineForgotPasswordResetPayload(token, AIRLINE_NEW_PASSWORD),
      );
    expect(reused.status).toBe(401);

    const weak = await api
      .post("/api/v1/auth/airline/forgot-password")
      .send(validAirlineForgotPasswordResetPayload(token, "weak"));
    expect(weak.status).toBe(400);
  });

  it("TC_AIRLINE_FORGOT_RESET_003: unknown field and malformed JSON -> 400", async () => {
    const unknown = await api
      .post("/api/v1/auth/airline/forgot-password")
      .send({
        resetPasswordToken: "x",
        newPassword: AIRLINE_TEST_PASSWORD,
        unknown: "bad",
      });
    expect(unknown.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/forgot-password")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_FORGOT_RESET_004: Missing required fields -> 400", async () => {
    const missingToken = await api
      .post("/api/v1/auth/airline/forgot-password")
      .send({ newPassword: AIRLINE_TEST_PASSWORD });
    expect(missingToken.status).toBe(400);

    const missingPassword = await api
      .post("/api/v1/auth/airline/forgot-password")
      .send({ resetPasswordToken: "some-token" });
    expect(missingPassword.status).toBe(400);
  });

  it("TC_AIRLINE_FORGOT_RESET_005: Type coercion — numeric resetPasswordToken -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/forgot-password")
      .send({ resetPasswordToken: 99999, newPassword: AIRLINE_TEST_PASSWORD });
    expect(res.status).toBe(400);
  });
});
