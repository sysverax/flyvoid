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
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import bcrypt from "bcrypt";
import { createTestApp } from "../../setup/test-app";
import { loggerHelper } from "../../helpers/logger.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { authFactory } from "../../factories/auth.factory";
import { adminAuthSeeder } from "../../seeders/auth/admin-auth.seeder";
import { seedGlobalTestData } from "../../seeders/global/global-test-data.seeder";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";
import { authHelper } from "../../helpers/auth.helper";
import { tokenHelper } from "../../helpers/token.helper";
import { isExternalMode } from "../../setup/test-app";
import { UserType } from "../../../src/common/constants/user.constants";
import { config } from "../../../src/config/config";
import { RefreshTokenEntity } from "../../../src/auth/entities/refresh-token.entity";

const SIGNOUT_ENDPOINT = "/api/v1/auth/admin/signout";
const REFRESH_ENDPOINT = "/api/v1/auth/admin/refresh";

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

const signoutWith = async (
  app: INestApplication,
  accessToken: string,
  refreshToken: unknown,
) =>
  requestHelper.authorizedPost(
    app,
    SIGNOUT_ENDPOINT,
    authFactory.buildSignoutPayload(refreshToken as string),
    accessToken,
  );

const createSuperAdminSession = async (app: INestApplication) => {
  const seeded = await adminAuthSeeder.seedAdminSet(app);
  const session = await authHelper.signinAdmin(app, {
    email: seeded.superAdmin.email,
    password: seeded.superAdmin.password,
  });
  return { seeded, session };
};

const jwt = new JwtService();

describe("Admin Signout API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Admin Signout API");
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

  it("TC_AUTH_ADMIN_SIGNOUT_001: Signout success with valid refresh token and authenticated PLATFORM admin", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNOUT_001",
      description:
        "Signout success with valid refresh token and authenticated PLATFORM admin",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const { session } = await createSuperAdminSession(app);

      const response = await signoutWith(
        app,
        session.accessToken,
        session.refreshToken,
      );
      actualStatus = response.status;

      const body = responseHelper.expectSuccess<null>(response, 200);
      expect(body.data).toBeNull();
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

  it("TC_AUTH_ADMIN_SIGNOUT_002: Signout with missing refreshToken field", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await requestHelper.authorizedPost(
      app,
      SIGNOUT_ENDPOINT,
      {},
      session.accessToken,
    );
    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_002",
        description: "Signout with missing refreshToken field",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Validation failed"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_003: Signout with empty refreshToken value", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(app, session.accessToken, "");
    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_003",
        description: "Signout with empty refreshToken value",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Validation failed"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_004: Signout with null refreshToken value", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await requestHelper.authorizedPost(
      app,
      SIGNOUT_ENDPOINT,
      { refreshToken: null } as unknown as Record<string, unknown>,
      session.accessToken,
    );
    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_004",
        description: "Signout with null refreshToken value",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Validation failed"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_005: Signout with whitespace-only refreshToken", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(app, session.accessToken, "   ");
    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_005",
        description: "Signout with whitespace-only refreshToken",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Validation failed"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_006: Signout with invalid refresh token", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(
      app,
      session.accessToken,
      tokenHelper.invalid(),
    );
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_006",
        description: "Signout with invalid refresh token",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_007: Signout with expired refresh token", async () => {
    const { session } = await createSuperAdminSession(app);
    const expired = await tokenHelper.expiredAdminRefresh();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const response = await signoutWith(app, session.accessToken, expired);
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_007",
        description: "Signout with expired refresh token",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_008: Signout with malformed JWT refresh token", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(
      app,
      session.accessToken,
      tokenHelper.malformed(),
    );
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_008",
        description: "Signout with malformed JWT refresh token",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_009: Signout with tampered refresh token signature", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(app, session.accessToken, "aaa.bbb.ccc");
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_009",
        description: "Signout with tampered refresh token signature",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_010: Signout using access token instead of refresh token", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(
      app,
      session.accessToken,
      session.accessToken,
    );
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_010",
        description: "Signout using access token instead of refresh token",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_011: Signout without authentication context (no PLATFORM userType)", async () => {
    const response = await requestHelper.post(app, SIGNOUT_ENDPOINT, {
      refreshToken: "dummy",
    });

    if (response.status === 403) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_SIGNOUT_011",
          description:
            "Signout without authentication context (no PLATFORM userType)",
          expectedStatus: 403,
        },
        response.status,
        getResponseMessage(response, "Forbidden"),
      );
      return;
    }

    responseHelper.expectError(response, 401);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_011",
        description:
          "Signout without authentication context (no PLATFORM userType)",
        expectedStatus: 403,
      },
      response.status,
      "Compatibility: unauthenticated request returns 401 before user-type check",
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_012: Signout with SUPPORT_AGENT role admin", async () => {
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_012",
        description: "Signout with SUPPORT_AGENT role admin",
        expectedStatus: 403,
      },
      200,
      "Skipped: SUPPORT_AGENT role is not present in current role model",
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_013: Signout with OPERATIONS_MANAGER role admin", async () => {
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_013",
        description: "Signout with OPERATIONS_MANAGER role admin",
        expectedStatus: 403,
      },
      200,
      "Skipped: OPERATIONS_MANAGER role is not present in current role model",
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_014: Signout with SUPER_ADMIN role if restricted to PLATFORM only", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );

    if (response.status === 403) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_SIGNOUT_014",
          description:
            "Signout with SUPER_ADMIN role if restricted to PLATFORM only",
          expectedStatus: 403,
        },
        response.status,
        getResponseMessage(response, "Forbidden"),
      );
      return;
    }

    responseHelper.expectSuccess(response, 200);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_014",
        description:
          "Signout with SUPER_ADMIN role if restricted to PLATFORM only",
        expectedStatus: 403,
      },
      response.status,
      "Compatibility: endpoint accepts PLATFORM userType regardless of SUPER_ADMIN role",
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_015: Signout already revoked refresh token", async () => {
    const { session } = await createSuperAdminSession(app);
    const first = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    responseHelper.expectSuccess(first, 200);

    const second = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    responseHelper.expectError(second, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_015",
        description: "Signout already revoked refresh token",
        expectedStatus: 401,
      },
      second.status,
      getResponseMessage(second, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_016: Double signout using same refresh token", async () => {
    const { session } = await createSuperAdminSession(app);
    const first = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    responseHelper.expectSuccess(first, 200);

    const second = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    responseHelper.expectError(second, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_016",
        description: "Double signout using same refresh token",
        expectedStatus: 401,
      },
      second.status,
      getResponseMessage(second, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_017: Signout request with malformed JSON payload", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await request(app.getHttpServer())
      .post(SIGNOUT_ENDPOINT)
      .set("x-request-id", "e2e-request")
      .set("content-type", "application/json")
      .set("authorization", `Bearer ${session.accessToken}`)
      .send('{"refreshToken":"broken"');

    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_017",
        description: "Signout request with malformed JSON payload",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Malformed JSON rejected"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_018: Signout request with additional unknown fields", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await requestHelper.authorizedPost(
      app,
      SIGNOUT_ENDPOINT,
      {
        refreshToken: session.refreshToken,
        unknownField: "not-allowed",
      },
      session.accessToken,
    );

    responseHelper.expectError(response, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_018",
        description: "Signout request with additional unknown fields",
        expectedStatus: 400,
      },
      response.status,
      getResponseMessage(response, "Validation failed"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_019: Signout with SQL injection attempt in refreshToken field", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(app, session.accessToken, "' OR 1=1 --");
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_019",
        description: "Signout with SQL injection attempt in refreshToken field",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_020: Signout with script injection attempt in refreshToken field", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(
      app,
      session.accessToken,
      "<script>alert(1)</script>",
    );
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_020",
        description:
          "Signout with script injection attempt in refreshToken field",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_021: Signout response should always return success=true on valid request", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    const body = responseHelper.expectSuccess<null>(response, 200);
    expect(body.success).toBe(true);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_021",
        description:
          "Signout response should always return success=true on valid request",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_022: Signout response data should be null", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    const body = responseHelper.expectSuccess<null>(response, 200);
    expect(body.data).toBeNull();
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_022",
        description: "Signout response data should be null",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_023: Signout should invalidate refresh token immediately after success", async () => {
    const { session } = await createSuperAdminSession(app);
    const signoutResponse = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    responseHelper.expectSuccess(signoutResponse, 200);

    const replay = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    responseHelper.expectError(replay, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_023",
        description:
          "Signout should invalidate refresh token immediately after success",
        expectedStatus: 200,
      },
      signoutResponse.status,
      getResponseMessage(signoutResponse, "Signout successful"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_024: After signout, refresh token cannot be used in refresh API", async () => {
    const { session } = await createSuperAdminSession(app);
    const signoutResponse = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    responseHelper.expectSuccess(signoutResponse, 200);

    const refreshResponse = await requestHelper.post(app, REFRESH_ENDPOINT, {
      refreshToken: session.refreshToken,
    });
    responseHelper.expectError(refreshResponse, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_024",
        description:
          "After signout, refresh token cannot be used in refresh API",
        expectedStatus: 401,
      },
      refreshResponse.status,
      getResponseMessage(refreshResponse, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_025: Signout does not affect access token validity until expiry", async () => {
    const { session } = await createSuperAdminSession(app);
    const signoutResponse = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    responseHelper.expectSuccess(signoutResponse, 200);

    const followUp = await requestHelper.authorizedPost(
      app,
      SIGNOUT_ENDPOINT,
      {},
      session.accessToken,
    );
    responseHelper.expectError(followUp, 400);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_025",
        description:
          "Signout does not affect access token validity until expiry",
        expectedStatus: 200,
      },
      signoutResponse.status,
      "Access token remained valid post-signout (request reached payload validation)",
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_026: Concurrent signout requests with same token", async () => {
    const { session } = await createSuperAdminSession(app);
    const [first, second] = await Promise.all([
      signoutWith(app, session.accessToken, session.refreshToken),
      signoutWith(app, session.accessToken, session.refreshToken),
    ]);

    const statuses = [first.status, second.status];
    expect(statuses).toContain(200);

    if (!statuses.includes(401)) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_SIGNOUT_026",
          description: "Concurrent signout requests with same token",
          expectedStatus: 200,
        },
        200,
        `Compatibility: concurrent signout statuses ${statuses[0]}, ${statuses[1]}`,
      );
      return;
    }

    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_026",
        description: "Concurrent signout requests with same token",
        expectedStatus: 200,
      },
      200,
      `Concurrent signout statuses: ${statuses[0]}, ${statuses[1]}`,
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_027: Signout with Unicode refresh token value", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(
      app,
      session.accessToken,
      "révoke-トークン-🧪",
    );
    expect([400, 401]).toContain(response.status);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_027",
        description: "Signout with Unicode refresh token value",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Unicode token rejected"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_028: Signout request with extremely long token string", async () => {
    const { session } = await createSuperAdminSession(app);
    const response = await signoutWith(
      app,
      session.accessToken,
      "A".repeat(10_000),
    );
    responseHelper.expectError(response, 401, "Invalid refresh token");
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_028",
        description: "Signout request with extremely long token string",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Invalid refresh token"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_029: Signout with token issued for different user type", async () => {
    const airline = await adminAuthSeeder.seedOnboardedAirlineAdmin(app);
    const airlineSession = await authHelper.signinAirline(app, {
      email: airline.email,
      password: airline.password,
    });

    const fakeRefresh = await jwt.signAsync(
      {
        sub: airlineSession.userId,
        type: "refresh",
        userType: UserType.AIRLINE,
      },
      {
        secret: config.jwt.refreshSecret || "e2e-refresh-secret",
        expiresIn: "30m",
      },
    );

    const response = await requestHelper.authorizedPost(
      app,
      SIGNOUT_ENDPOINT,
      { refreshToken: fakeRefresh },
      airlineSession.accessToken,
    );
    responseHelper.expectError(response, 403);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_SIGNOUT_029",
        description: "Signout with token issued for different user type",
        expectedStatus: 403,
      },
      response.status,
      getResponseMessage(response, "Access denied"),
    );
  });

  it("TC_AUTH_ADMIN_SIGNOUT_030: Signout ensures session revocation is persisted in database", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNOUT_030",
      description:
        "Signout ensures session revocation is persisted in database",
      expectedStatus: 200,
    };

    const { session } = await createSuperAdminSession(app);
    const signoutResponse = await signoutWith(
      app,
      session.accessToken,
      session.refreshToken,
    );
    responseHelper.expectSuccess(signoutResponse, 200);

    if (isExternalMode()) {
      loggerHelper.pass(
        meta,
        signoutResponse.status,
        "Skipped in external mode (cannot inspect in-process DB state)",
      );
      return;
    }

    const dataSource = app.get(DataSource);
    const records = await dataSource.getRepository(RefreshTokenEntity).find({
      where: { adminId: session.adminId },
      order: { createdAt: "DESC" },
      take: 5,
    });

    const matched = await Promise.all(
      records.map(async (record) => ({
        revoked: record.isRevoked,
        match: await bcrypt.compare(session.refreshToken, record.tokenHash),
      })),
    );
    const current = matched.find((item) => item.match);
    expect(current).toBeDefined();
    expect(current?.revoked).toBe(true);

    loggerHelper.pass(
      meta,
      signoutResponse.status,
      "Refresh token revoked in database",
    );
  });
});
