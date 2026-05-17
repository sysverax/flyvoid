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
import { adminAuthSeeder } from "../../seeders/auth/admin-auth.seeder";
import { seedGlobalTestData } from "../../seeders/global/global-test-data.seeder";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";
import { airlineFactory } from "../../factories/airline.factory";

describe("Airline Signup API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Airline Signup API");
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

  it("TC_AUTH_AIRLINE_SIGNUP_001 - should onboard airline admin successfully", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_SIGNUP_001",
      description: "Airline onboarding success",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const invite = await adminAuthSeeder.seedAirlineInvite(app);
      const payload = airlineFactory.buildOnboardPayload(
        invite.invitationToken,
      );

      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/onboard",
        payload,
      );
      actualStatus = response.status;

      const body = responseHelper.expectSuccess<{
        userId: number;
        airlineId: number;
        email: string;
      }>(response, 200);
      expect(body.data.userId).toBeDefined();
      expect(body.data.airlineId).toBeDefined();
      expect(body.data.email).toBe(invite.invitedAdminEmail);

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

  it("TC_AUTH_AIRLINE_SIGNUP_002 - should fail with invalid invitation token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_SIGNUP_002",
      description: "Invalid invitation token",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/onboard",
        airlineFactory.buildOnboardPayload("invalid-token"),
      );
      actualStatus = response.status;

      responseHelper.expectError(
        response,
        401,
        "Invalid or expired invitation token",
      );
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

  it("TC_AUTH_AIRLINE_SIGNUP_003 - should fail when invitation token is reused", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_SIGNUP_003",
      description: "Reused invitation token",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const invite = await adminAuthSeeder.seedAirlineInvite(app);
      const payload = airlineFactory.buildOnboardPayload(
        invite.invitationToken,
      );

      const first = await requestHelper.post(
        app,
        "/api/v1/auth/airline/onboard",
        payload,
      );
      responseHelper.expectSuccess(first, 200);

      const second = await requestHelper.post(
        app,
        "/api/v1/auth/airline/onboard",
        payload,
      );
      actualStatus = second.status;

      responseHelper.expectError(
        second,
        401,
        "Invalid or expired invitation token",
      );
      loggerHelper.pass(meta, actualStatus, second.body.message as string);
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
