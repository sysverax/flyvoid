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
import { createTestApp } from "../setup/test-app";
import { loggerHelper } from "../helpers/logger.helper";
import { requestHelper } from "../helpers/request.helper";
import { responseHelper } from "../helpers/response.helper";
import { seedGlobalTestData } from "../seeders/global/global-test-data.seeder";
import { TestCaseMeta } from "../shared/interfaces/test-case.interface";
import { authHelper } from "../helpers/auth.helper";
import { airlineSeeder } from "../seeders/airline/airline.seeder";

describe("Airline Profile API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Airline Profile API");
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

  it("TC_AIRLINE_PROFILE_001 - should fetch airline user profile", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRLINE_PROFILE_001",
      description: "Airline user profile success",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const seeded = await airlineSeeder.seedOnboardedAirlineAdmin(app);
      const session = await authHelper.signinAirline(app, {
        email: seeded.email,
        password: seeded.password,
      });

      const response = await requestHelper.authorizedGet(
        app,
        "/api/v1/airline/user/profile",
        session.accessToken,
      );
      actualStatus = response.status;

      const body = responseHelper.expectSuccess<{
        id: number;
        airlineId: number;
        email: string;
        role: string;
      }>(response, 200);

      expect(body.data.id).toBeDefined();
      expect(body.data.airlineId).toBeDefined();
      expect(body.data.email).toBe(seeded.email);
      expect(body.data.role).toBeDefined();
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

  it("TC_AIRLINE_PROFILE_002 - should fetch airline profile for airline admin", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRLINE_PROFILE_002",
      description: "Airline profile success",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const seeded = await airlineSeeder.seedOnboardedAirlineAdmin(app);
      const session = await authHelper.signinAirline(app, {
        email: seeded.email,
        password: seeded.password,
      });

      const response = await requestHelper.authorizedGet(
        app,
        "/api/v1/airline/profile",
        session.accessToken,
      );
      actualStatus = response.status;

      const body = responseHelper.expectSuccess<{
        id: number;
        name: string;
        code: string;
      }>(response, 200);

      expect(body.data.id).toBeDefined();
      expect(typeof body.data.name).toBe("string");
      expect(typeof body.data.code).toBe("string");
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

  it("TC_AIRLINE_PROFILE_003 - should fail without access token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRLINE_PROFILE_003",
      description: "Airline profile unauthorized",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const response = await requestHelper.get(
        app,
        "/api/v1/airline/user/profile",
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
