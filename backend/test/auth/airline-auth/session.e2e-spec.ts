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

describe("Airline Session API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Airline Session API");
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

  it("TC_AUTH_AIRLINE_REFRESH_001 - should refresh successfully", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_REFRESH_001",
      description: "Airline refresh success",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const seeded = await adminAuthSeeder.seedOnboardedAirlineAdmin(app);
      const session = await authHelper.signinAirline(app, {
        email: seeded.email,
        password: seeded.password,
      });

      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/refresh",
        authFactory.buildRefreshTokenPayload(session.refreshToken),
      );
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

  it("TC_AUTH_AIRLINE_REFRESH_002 - should fail with malformed refresh token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_REFRESH_002",
      description: "Malformed refresh token",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/refresh",
        authFactory.buildRefreshTokenPayload(tokenHelper.malformed()),
      );
      actualStatus = response.status;

      responseHelper.expectError(response, 401);
      loggerHelper.pass(
        meta,
        actualStatus,
        String(response.body.message ?? "Invalid refresh token"),
      );
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AUTH_AIRLINE_SIGNOUT_001 - should signout successfully", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_SIGNOUT_001",
      description: "Airline signout success",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const seeded = await adminAuthSeeder.seedOnboardedAirlineAdmin(app);
      const session = await authHelper.signinAirline(app, {
        email: seeded.email,
        password: seeded.password,
      });

      const response = await requestHelper.authorizedPost(
        app,
        "/api/v1/auth/airline/signout",
        authFactory.buildSignoutPayload(session.refreshToken),
        session.accessToken,
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

  it("TC_AUTH_AIRLINE_SIGNOUT_002 - should fail without access token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_SIGNOUT_002",
      description: "Airline signout unauthorized",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/signout",
        authFactory.buildSignoutPayload(tokenHelper.malformed()),
      );
      actualStatus = response.status;

      responseHelper.expectError(response, 401);
      loggerHelper.pass(
        meta,
        actualStatus,
        String(response.body.message ?? "Unauthorized"),
      );
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });
});
