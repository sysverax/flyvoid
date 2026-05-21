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
import { isExternalMode } from "../../setup/test-app";
import { seedGlobalTestData } from "../../seeders/global/global-test-data.seeder";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";
import { airlineFactory } from "../../factories/airline.factory";
import { airlineSeeder } from "../../seeders/airline/airline.seeder";

describe("Airline Signin API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Airline Signin API");
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

  it("TC_AUTH_AIRLINE_SIGNIN_001 - should signin successfully", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_SIGNIN_001",
      description: "Airline signin success",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const seeded = await airlineSeeder.seedOnboardedAirlineAdmin(app);
      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/signin",
        airlineFactory.buildAirlineSigninPayload(seeded.email, seeded.password),
      );
      actualStatus = response.status;

      const body = responseHelper.expectSuccess<{
        accessToken: string;
        refreshToken: string;
        user: { id: number; email: string };
      }>(response, 200);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.user.email).toBe(seeded.email);
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

  it("TC_AUTH_AIRLINE_SIGNIN_002 - should fail with invalid password", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_SIGNIN_002",
      description: "Invalid password",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const seeded = await airlineSeeder.seedOnboardedAirlineAdmin(app);
      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/signin",
        airlineFactory.buildAirlineSigninPayload(
          seeded.email,
          "WrongPassword@123",
        ),
      );
      actualStatus = response.status;

      responseHelper.expectError(response, 401, "Invalid credentials");
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

  it("TC_AUTH_AIRLINE_SIGNIN_003 - should fail for inactive account", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_SIGNIN_003",
      description: "Inactive airline account",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      if (isExternalMode()) {
        loggerHelper.pass(
          meta,
          200,
          "Skipped in external mode (inactive seeding requires in-process DB access)",
        );
        return;
      }

      const seeded = await airlineSeeder.seedOnboardedAirlineAdmin(app, {
        inactive: true,
      });
      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/signin",
        airlineFactory.buildAirlineSigninPayload(seeded.email, seeded.password),
      );
      actualStatus = response.status;

      responseHelper.expectError(response, 401, "Invalid credentials");
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

  it("TC_AUTH_AIRLINE_SIGNIN_004 - should fail for missing credentials", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_SIGNIN_004",
      description: "Missing credentials",
      expectedStatus: 400,
    };

    let actualStatus = 0;
    try {
      await airlineSeeder.seedOnboardedAirlineAdmin(app);
      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/signin",
        {
          email: "",
        },
      );
      actualStatus = response.status;

      responseHelper.expectError(response, 400);
      expect(
        Array.isArray(response.body.message) ||
          typeof response.body.message === "string",
      ).toBe(true);
      loggerHelper.pass(
        meta,
        actualStatus,
        String(response.body.message ?? "Validation failed as expected"),
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
