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
import { adminAuthSeeder } from "../seeders/auth/admin-auth.seeder";
import { seedGlobalTestData } from "../seeders/global/global-test-data.seeder";
import { TestCaseMeta } from "../shared/interfaces/test-case.interface";
import { authHelper } from "../helpers/auth.helper";

describe("Admin Profile API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Admin Profile API");
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

  it("TC_ADMIN_PROFILE_001 - should fetch logged-in admin profile", async () => {
    const meta: TestCaseMeta = {
      id: "TC_ADMIN_PROFILE_001",
      description: "Admin profile success",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const seeded = await adminAuthSeeder.seedAdminSet(app);
      const session = await authHelper.signinAdmin(app, {
        email: seeded.superAdmin.email,
        password: seeded.superAdmin.password,
      });

      const response = await requestHelper.authorizedGet(
        app,
        "/api/v1/admin/profile",
        session.accessToken,
      );
      actualStatus = response.status;

      const body = responseHelper.expectSuccess<{
        id: number;
        email: string;
        role: string;
      }>(response, 200);

      expect(body.data.id).toBeDefined();
      expect(body.data.email).toBe(seeded.superAdmin.email);
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

  it("TC_ADMIN_PROFILE_002 - should fail without access token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_ADMIN_PROFILE_002",
      description: "Admin profile unauthorized",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const response = await requestHelper.get(app, "/api/v1/admin/profile");
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
