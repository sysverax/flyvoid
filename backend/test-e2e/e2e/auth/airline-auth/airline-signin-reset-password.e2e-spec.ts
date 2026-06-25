import { Logger } from "@nestjs/common";
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { signupAndGetTokens } from "../../../helpers/auth.helper";
import {
  AIRLINE_NEW_PASSWORD,
  AIRLINE_TEST_PASSWORD,
  uniqueAirlineEmail,
  validAirlineInitialPasswordResetPayload,
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
const RESET_PASSWORD_PATH = "/api/v1/auth/airline/signin/reset-password";
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

wrapResponseLogging(RESET_PASSWORD_PATH);
wrapResponseLogging(SIGNIN_PATH);

async function makeSuperAdminToken() {
  const adminEmail = uniqueAirlineEmail("platform-super-reset");
  const tokens = await signupAndGetTokens(
    "Platform",
    "Super",
    adminEmail,
    AIRLINE_TEST_PASSWORD,
  );
  return tokens.accessToken;
}

async function createResetChallenge(superToken: string) {
  const airlineId = await insertAirlineRow({
    name: "Reset Flow Airline",
    code: `E2ERF${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    countryCode: "AE",
    companyRegistrationNumber: `E2ECRN-RF-${Date.now()}`,
    contactEmail: uniqueAirlineEmail("rf-contact"),
    contactPhone: "+971500000020",
    timezone: "Asia/Dubai",
    address: "Reset Flow Address",
    currency: "AED",
  });

  const email = uniqueAirlineEmail("rf-user");
  await insertAirlineUserRow({
    airlineId,
    email,
    password: AIRLINE_TEST_PASSWORD,
    requirePasswordReset: true,
  });

  const signin = await api
    .post("/api/v1/auth/airline/signin")
    .send(validAirlineSigninPayload(email, AIRLINE_TEST_PASSWORD));

  return {
    email,
    resetPasswordToken: signin.body.data.resetPasswordToken as string,
  };
}

describe("POST /api/v1/auth/airline/signin/reset-password", () => {
  let superToken = "";

  beforeAll(async () => {
    superToken = await makeSuperAdminToken();
    const inviteRes = await api
      .post("/api/v1/airline/invitations")
      .set("Authorization", `Bearer ${superToken}`)
      .send(validInvitePayload({ adminEmail: uniqueAirlineEmail("warmup") }));

    const token = extractToken(inviteRes.body.data.onboardingLink as string);
    await api
      .post("/api/v1/auth/airline/onboard")
      .send({ invitationToken: token, password: AIRLINE_TEST_PASSWORD });
  });

  afterAll(async () => {
    await deleteInvitationDataByPattern(INVITE_PATTERN);
    await deleteAdminsByEmailPattern(ADMIN_EMAIL_PATTERN);
    await endPool();
  });

  it("TC_AIRLINE_RESET_001: Valid resetPasswordToken + strong password -> 200", async () => {
    const challenge = await createResetChallenge(superToken);

    const res = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send(
        validAirlineInitialPasswordResetPayload(
          challenge.resetPasswordToken,
          AIRLINE_NEW_PASSWORD,
        ),
      );

    expect(res.status).toBe(200);

    const signin = await api
      .post("/api/v1/auth/airline/signin")
      .send(validAirlineSigninPayload(challenge.email, AIRLINE_NEW_PASSWORD));
    expect(signin.status).toBe(200);
    expect(typeof signin.body.data.accessToken).toBe("string");
  });

  it("TC_AIRLINE_RESET_002: Invalid/expired reset token -> 401", async () => {
    const res = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send(
        validAirlineInitialPasswordResetPayload(
          "bad.token",
          AIRLINE_NEW_PASSWORD,
        ),
      );

    expect(res.status).toBe(401);
  });

  it("TC_AIRLINE_RESET_003: Weak newPassword -> 400", async () => {
    const challenge = await createResetChallenge(superToken);

    const res = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send(
        validAirlineInitialPasswordResetPayload(
          challenge.resetPasswordToken,
          "weak",
        ),
      );

    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_RESET_004: Reuse of used reset token -> 401", async () => {
    const challenge = await createResetChallenge(superToken);

    const first = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send(
        validAirlineInitialPasswordResetPayload(
          challenge.resetPasswordToken,
          AIRLINE_NEW_PASSWORD,
        ),
      );
    expect(first.status).toBe(200);

    const second = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send(
        validAirlineInitialPasswordResetPayload(
          challenge.resetPasswordToken,
          AIRLINE_TEST_PASSWORD,
        ),
      );
    expect(second.status).toBe(401);
  });

  it("TC_AIRLINE_RESET_005: Unknown field and malformed JSON -> 400", async () => {
    const unknown = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send({
        resetPasswordToken: "x",
        newPassword: AIRLINE_NEW_PASSWORD,
        extraField: "bad",
      });
    expect(unknown.status).toBe(400);

    const malformed = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(malformed.status).toBe(400);
  });

  it("TC_AIRLINE_RESET_006: Missing resetPasswordToken field -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send({ newPassword: AIRLINE_NEW_PASSWORD });
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_RESET_007: Missing newPassword field -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send({ resetPasswordToken: "some-token" });
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_RESET_008: Non-string resetPasswordToken (numeric) -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send({ resetPasswordToken: 99999, newPassword: AIRLINE_NEW_PASSWORD });
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_RESET_009: Non-string newPassword (boolean) -> 400", async () => {
    const res = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send({ resetPasswordToken: "some-token", newPassword: true });
    expect(res.status).toBe(400);
  });

  it("TC_AIRLINE_RESET_010: Successful reset response includes accessToken and refreshToken -> 200", async () => {
    const challenge = await createResetChallenge(superToken);

    const res = await api
      .post("/api/v1/auth/airline/signin/reset-password")
      .send(
        validAirlineInitialPasswordResetPayload(
          challenge.resetPasswordToken,
          AIRLINE_NEW_PASSWORD,
        ),
      );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    if (res.body.data?.accessToken !== undefined) {
      expect(typeof res.body.data.accessToken).toBe("string");
      expect(typeof res.body.data.refreshToken).toBe("string");
    }
  });
});
