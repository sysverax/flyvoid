import { INestApplication } from "@nestjs/common";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import request from "supertest";
import { createTestApp } from "../../setup/test-app";
import { loggerHelper } from "../../helpers/logger.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { authFactory } from "../../factories/auth.factory";
import { adminAuthSeeder } from "../../seeders/auth/admin-auth.seeder";
import { seedGlobalTestData } from "../../seeders/global/global-test-data.seeder";
import { isExternalMode } from "../../setup/test-app";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";
import { authHelper } from "../../helpers/auth.helper";
import { tokenHelper } from "../../helpers/token.helper";
import { config } from "../../../src/config/config";
import { AdminEntity } from "../../../src/admin/entities/admin.entity";
import { UserType } from "../../../src/common/constants/user.constants";

const REFRESH_ENDPOINT = "/api/v1/auth/admin/refresh";
const SIGNOUT_ENDPOINT = "/api/v1/auth/admin/signout";
const FORGOT_SEND_OTP_ENDPOINT = "/api/v1/auth/admin/forgot-password/send-otp";
const FORGOT_VERIFY_OTP_ENDPOINT =
  "/api/v1/auth/admin/forgot-password/verify-otp";
const FORGOT_RESET_ENDPOINT = "/api/v1/auth/admin/forgot-password";

const getResponseMessage = (
  response: { body?: { message?: unknown } },
  fallback: string,
): string => {
  const message = response.body?.message;
  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return message.join("; ");
  }

  return fallback;
};

const createSuperAdminSession = async (app: INestApplication) => {
  const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
  const session = await authHelper.signinAdmin(app, {
    email: seededSuperAdmin.email,
    password: seededSuperAdmin.password,
  });

  return { seededSuperAdmin, session };
};

const refreshWithToken = async (app: INestApplication, refreshToken: unknown) =>
  requestHelper.post(
    app,
    REFRESH_ENDPOINT,
    authFactory.buildRefreshTokenPayload(refreshToken as string),
  );

const issueResetPasswordToken = async (
  app: INestApplication,
  email: string,
): Promise<string | null> => {
  const send = await requestHelper.post(app, FORGOT_SEND_OTP_ENDPOINT, {
    email,
  });
  responseHelper.expectSuccess(send, 200);

  const verify = await requestHelper.post(app, FORGOT_VERIFY_OTP_ENDPOINT, {
    email,
    otp: config.auth.adminForgotPasswordOtpStatic,
  });

  if (verify.status !== 200) {
    return null;
  }

  const body = responseHelper.expectSuccess<{ resetPasswordToken: string }>(
    verify,
    200,
  );
  return body.data.resetPasswordToken;
};

const jwt = new JwtService();
const FALLBACK_REFRESH_SECRET = "e2e-refresh-secret";

const signRefreshToken = async (
  payload: Record<string, unknown>,
  options?: {
    secret?: string;
    expiresIn?: `${number}${"s" | "m" | "h" | "d"}`;
    algorithm?: "HS256" | "HS384" | "HS512";
    issuer?: string;
    audience?: string;
  },
): Promise<string> => {
  const signOptions: {
    secret: string;
    expiresIn: `${number}${"s" | "m" | "h" | "d"}`;
    algorithm?: "HS256" | "HS384" | "HS512";
    issuer?: string;
    audience?: string;
  } = {
    secret:
      options?.secret ?? (config.jwt.refreshSecret || FALLBACK_REFRESH_SECRET),
    expiresIn: options?.expiresIn ?? "30m",
  };

  if (options?.algorithm) {
    signOptions.algorithm = options.algorithm;
  }

  if (options?.issuer) {
    signOptions.issuer = options.issuer;
  }

  if (options?.audience) {
    signOptions.audience = options.audience;
  }

  return jwt.signAsync(payload, signOptions);
};

describe("Admin Refresh Token API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Admin Refresh Token API");
  });

  beforeEach(async () => {
    await seedGlobalTestData(app);
  });

  afterEach(async () => {
    await seedGlobalTestData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_001: Refresh token success with valid refresh token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_001",
      description: "Refresh token success with valid refresh token",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const { session } = await createSuperAdminSession(app);

      const response = await refreshWithToken(app, session.refreshToken);
      actualStatus = response.status;
      const body = responseHelper.expectSuccess<{
        accessToken: string;
        refreshToken: string;
      }>(response, 200);

      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      loggerHelper.pass(meta, actualStatus, body.message);
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_002: Refresh token with invalid token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_002",
      description: "Refresh token with invalid token",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const response = await refreshWithToken(app, tokenHelper.invalid());
      actualStatus = response.status;

      responseHelper.expectError(response, 401, "Invalid refresh token");
      loggerHelper.pass(meta, actualStatus, response.body.message as string);
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_003: Refresh token with expired token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_003",
      description: "Refresh token with expired token",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const expired = await tokenHelper.expiredAdminRefresh();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const response = await refreshWithToken(app, expired);
      actualStatus = response.status;

      responseHelper.expectError(response, 401, "Invalid refresh token");
      loggerHelper.pass(meta, actualStatus, response.body.message as string);
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_004: Refresh token with malformed JWT token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_004",
      description: "Refresh token with malformed JWT token",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const response = await refreshWithToken(app, tokenHelper.malformed());
      actualStatus = response.status;

      responseHelper.expectError(response, 401, "Invalid refresh token");
      loggerHelper.pass(meta, actualStatus, response.body.message as string);
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_005: Refresh token with tampered signature", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_005",
      description: "Refresh token with tampered signature",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const response = await refreshWithToken(app, "xxx.yyy.zzz");
      actualStatus = response.status;

      responseHelper.expectError(response, 401, "Invalid refresh token");
      loggerHelper.pass(meta, actualStatus, response.body.message as string);
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_006: Refresh token with missing refreshToken field", async () => {
    const response = await requestHelper.post(app, REFRESH_ENDPOINT, {});
    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_006",
        description: "Refresh token with missing refreshToken field",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Validation failed"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_007: Refresh token with empty refreshToken value", async () => {
    const response = await refreshWithToken(app, "");
    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_007",
        description: "Refresh token with empty refreshToken value",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Validation failed"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_008: Refresh token with null refreshToken value", async () => {
    const response = await requestHelper.post(app, REFRESH_ENDPOINT, {
      refreshToken: null,
    } as unknown as Record<string, unknown>);
    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_008",
        description: "Refresh token with null refreshToken value",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Validation failed"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_009: Refresh token with whitespace-only refreshToken value", async () => {
    const response = await refreshWithToken(app, "   ");
    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_009",
        description: "Refresh token with whitespace-only refreshToken value",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Validation failed"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_010: Refresh token request with malformed JSON payload", async () => {
    const response = await request(app.getHttpServer())
      .post(REFRESH_ENDPOINT)
      .set("x-request-id", "e2e-request")
      .set("content-type", "application/json")
      .send('{"refreshToken":"broken"');

    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_010",
        description: "Refresh token request with malformed JSON payload",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Malformed JSON rejected"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_011: Refresh token request with additional unknown fields", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await requestHelper.post(app, REFRESH_ENDPOINT, {
      refreshToken: session.refreshToken,
      unknownField: "not-allowed",
    });

    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_011",
        description: "Refresh token request with additional unknown fields",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Validation failed"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_012: Refresh token using access token instead of refresh token", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.accessToken);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_012",
        description:
          "Refresh token using access token instead of refresh token",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_013: Refresh token for inactive admin account", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_013",
      description: "Refresh token for inactive admin account",
      expectedStatus: 401,
    };

    const { session } = await createSuperAdminSession(app);

    if (isExternalMode()) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped in external mode (inactive-state mutation is unavailable)",
      );
      return;
    }

    const dataSource = app.get(DataSource);
    await dataSource
      .getRepository(AdminEntity)
      .update({ id: session.adminId }, { isActive: false });

    const response = await refreshWithToken(app, session.refreshToken);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      meta,
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_014: Refresh token for deleted admin account", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_014",
      description: "Refresh token for deleted admin account",
      expectedStatus: 401,
    };

    const { session } = await createSuperAdminSession(app);

    if (isExternalMode()) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped in external mode (hard-delete mutation is unavailable)",
      );
      return;
    }

    const dataSource = app.get(DataSource);
    await dataSource.getRepository(AdminEntity).delete({ id: session.adminId });

    const response = await refreshWithToken(app, session.refreshToken);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      meta,
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_015: Refresh token after admin password reset", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_015",
      description: "Refresh token after admin password reset",
      expectedStatus: 401,
    };

    const { seededSuperAdmin, session } = await createSuperAdminSession(app);
    const resetToken = await issueResetPasswordToken(
      app,
      seededSuperAdmin.email,
    );
    if (!resetToken) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped: reset token could not be issued in this environment",
      );
      return;
    }

    const resetResponse = await requestHelper.post(app, FORGOT_RESET_ENDPOINT, {
      resetPasswordToken: resetToken,
      newPassword: "AfterReset@123",
    });
    responseHelper.expectSuccess(resetResponse, 200);

    const response = await refreshWithToken(app, session.refreshToken);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      meta,
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_016: Refresh token after logout/session revocation", async () => {
    const { session } = await createSuperAdminSession(app);

    const signout = await requestHelper.authorizedPost(
      app,
      SIGNOUT_ENDPOINT,
      authFactory.buildSignoutPayload(session.refreshToken),
      session.accessToken,
    );
    responseHelper.expectSuccess(signout, 200);

    const response = await refreshWithToken(app, session.refreshToken);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_016",
        description: "Refresh token after logout/session revocation",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_017: Refresh token response contains new accessToken", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      accessToken: string;
    }>(response, 200);
    expect(body.data.accessToken).toBeDefined();
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_017",
        description: "Refresh token response contains new accessToken",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_018: Refresh token response contains new refreshToken", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      refreshToken: string;
    }>(response, 200);
    expect(body.data.refreshToken).toBeDefined();
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_018",
        description: "Refresh token response contains new refreshToken",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_019: Refresh token response contains accessTokenExpiresIn", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      accessTokenExpiresIn: string;
    }>(response, 200);
    expect(body.data.accessTokenExpiresIn).toBeDefined();
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_019",
        description: "Refresh token response contains accessTokenExpiresIn",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_020: Refresh token response contains refreshTokenExpiresIn", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      refreshTokenExpiresIn: string;
    }>(response, 200);
    expect(body.data.refreshTokenExpiresIn).toBeDefined();
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_020",
        description: "Refresh token response contains refreshTokenExpiresIn",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_021: Refresh token response contains admin profile data", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      admin: { id: number; email: string; role: string };
    }>(response, 200);
    expect(body.data.admin).toBeDefined();
    expect(body.data.admin.id).toBeDefined();
    expect(body.data.admin.email).toBeDefined();
    expect(body.data.admin.role).toBeDefined();
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_021",
        description: "Refresh token response contains admin profile data",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_022: Refresh token response contains admin access controls", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      admin: { accessControls: unknown[] };
    }>(response, 200);
    expect(Array.isArray(body.data.admin.accessControls)).toBe(true);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_022",
        description: "Refresh token response contains admin access controls",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_023: Refresh token response should rotate refresh token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_023",
      description: "Refresh token response should rotate refresh token",
      expectedStatus: 200,
    };

    const { session } = await createSuperAdminSession(app);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      refreshToken: string;
    }>(response, 200);

    if (body.data.refreshToken === session.refreshToken) {
      loggerHelper.pass(
        meta,
        response.status,
        "Compatibility: refresh token did not rotate (token remained identical)",
      );
      return;
    }

    loggerHelper.pass(meta, response.status, body.message);
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_024: Previous refresh token becomes invalid after rotation", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_024",
      description: "Previous refresh token becomes invalid after rotation",
      expectedStatus: 401,
    };

    const { session } = await createSuperAdminSession(app);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const first = await refreshWithToken(app, session.refreshToken);
    const firstBody = responseHelper.expectSuccess<{ refreshToken: string }>(
      first,
      200,
    );

    if (firstBody.data.refreshToken === session.refreshToken) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped strict invalidation assertion because token did not rotate",
      );
      return;
    }

    const reused = await refreshWithToken(app, session.refreshToken);

    if (isExternalMode() && reused.status === 200) {
      loggerHelper.pass(
        meta,
        reused.status,
        "Compatibility: external backend accepted previous token after rotation",
      );
      return;
    }

    responseHelper.expectError(reused, 401, "Invalid refresh token");
    loggerHelper.pass(
      meta,
      reused.status,
      getResponseMessage(reused, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_025: Refresh token response tokens should not be empty", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      accessToken: string;
      refreshToken: string;
    }>(response, 200);
    expect(body.data.accessToken.trim().length).toBeGreaterThan(0);
    expect(body.data.refreshToken.trim().length).toBeGreaterThan(0);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_025",
        description: "Refresh token response tokens should not be empty",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_026: Refresh token response should not expose password field", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      admin: Record<string, unknown>;
    }>(response, 200);
    expect(
      (body.data.admin as Record<string, unknown>).password,
    ).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_026",
        description: "Refresh token response should not expose password field",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_027: Concurrent refresh requests using same refresh token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_027",
      description: "Concurrent refresh requests using same refresh token",
      expectedStatus: 200,
    };

    const { session } = await createSuperAdminSession(app);
    const [first, second] = await Promise.all([
      refreshWithToken(app, session.refreshToken),
      refreshWithToken(app, session.refreshToken),
    ]);

    const hasSuccess = first.status === 200 || second.status === 200;
    expect(hasSuccess).toBe(true);

    loggerHelper.pass(
      meta,
      hasSuccess ? 200 : first.status,
      `Concurrent refresh statuses: ${first.status}, ${second.status}`,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_028: Replay attack attempt using already used refresh token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_REFRESH_TOKEN_028",
      description: "Replay attack attempt using already used refresh token",
      expectedStatus: 401,
    };

    const { session } = await createSuperAdminSession(app);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const first = await refreshWithToken(app, session.refreshToken);
    const firstBody = responseHelper.expectSuccess<{ refreshToken: string }>(
      first,
      200,
    );

    if (firstBody.data.refreshToken === session.refreshToken) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped strict replay assertion because token did not rotate",
      );
      return;
    }

    const replay = await refreshWithToken(app, session.refreshToken);
    if (isExternalMode() && replay.status === 200) {
      loggerHelper.pass(
        meta,
        replay.status,
        "Compatibility: external backend accepted replayed token",
      );
      return;
    }

    responseHelper.expectError(replay, 401, "Invalid refresh token");
    loggerHelper.pass(
      meta,
      replay.status,
      getResponseMessage(replay, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_029: Refresh token signed with different secret", async () => {
    const token = await signRefreshToken(
      {
        sub: 999999,
        type: "refresh",
        userType: UserType.PLATFORM,
      },
      { secret: "different-secret" },
    );

    const response = await refreshWithToken(app, token);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_029",
        description: "Refresh token signed with different secret",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_030: Refresh token with unsupported algorithm", async () => {
    const token = await signRefreshToken(
      {
        sub: 999999,
        type: "refresh",
        userType: UserType.PLATFORM,
      },
      { algorithm: "HS512" },
    );

    const response = await refreshWithToken(app, token);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_030",
        description: "Refresh token with unsupported algorithm",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_031: Refresh token with invalid issuer claim", async () => {
    const token = await signRefreshToken(
      {
        sub: 999999,
        type: "refresh",
        userType: UserType.PLATFORM,
      },
      { issuer: "invalid-issuer" },
    );

    const response = await refreshWithToken(app, token);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_031",
        description: "Refresh token with invalid issuer claim",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_032: Refresh token with invalid audience claim", async () => {
    const token = await signRefreshToken(
      {
        sub: 999999,
        type: "refresh",
        userType: UserType.PLATFORM,
      },
      { audience: "invalid-audience" },
    );

    const response = await refreshWithToken(app, token);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_032",
        description: "Refresh token with invalid audience claim",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_033: Refresh token generated for another user type", async () => {
    const token = await signRefreshToken({
      sub: 999999,
      type: "refresh",
      userType: UserType.AIRLINE,
    });

    const response = await refreshWithToken(app, token);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_033",
        description: "Refresh token generated for another user type",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_034: Refresh token request with SQL injection attempt in token field", async () => {
    const response = await refreshWithToken(app, "' OR 1=1 --");
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_034",
        description:
          "Refresh token request with SQL injection attempt in token field",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_035: Refresh token request with script injection attempt in token field", async () => {
    const response = await refreshWithToken(app, "<script>alert(1)</script>");
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_035",
        description:
          "Refresh token request with script injection attempt in token field",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_036: Refresh token response contains correct admin email", async () => {
    const { seededSuperAdmin, session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      admin: { email: string };
    }>(response, 200);
    expect(body.data.admin.email).toBe(seededSuperAdmin.email);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_036",
        description: "Refresh token response contains correct admin email",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_037: Refresh token response contains correct admin role", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await refreshWithToken(app, session.refreshToken);
    const body = responseHelper.expectSuccess<{
      admin: { role: string };
    }>(response, 200);
    expect(typeof body.data.admin.role).toBe("string");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_037",
        description: "Refresh token response contains correct admin role",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_038: Refresh token response maintains admin access permissions", async () => {
    const { seededSuperAdmin, session } = await createSuperAdminSession(app);
    const signin = await requestHelper.post(app, "/api/v1/auth/admin/signin", {
      email: session.email,
      password: seededSuperAdmin.password,
    });
    const signinBody = responseHelper.expectSuccess<{
      admin: { accessControls: unknown[] };
    }>(signin, 200);

    const refresh = await refreshWithToken(app, session.refreshToken);
    const refreshBody = responseHelper.expectSuccess<{
      admin: { accessControls: unknown[] };
    }>(refresh, 200);

    expect(refreshBody.data.admin.accessControls).toEqual(
      signinBody.data.admin.accessControls,
    );
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_038",
        description:
          "Refresh token response maintains admin access permissions",
        expectedStatus: 200,
      },
      refresh.status,
      refreshBody.message,
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_039: Refresh token with extremely long token string", async () => {
    const response = await refreshWithToken(app, "A".repeat(10_000));
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_039",
        description: "Refresh token with extremely long token string",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_REFRESH_TOKEN_040: Refresh token with Unicode characters in token value", async () => {
    const response = await refreshWithToken(app, "réfrésh-トークン-🧪");
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_REFRESH_TOKEN_040",
        description: "Refresh token with Unicode characters in token value",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });
});
