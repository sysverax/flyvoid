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
import { randomUUID } from "node:crypto";
import { createTestApp } from "../setup/test-app";
import { loggerHelper } from "../helpers/logger.helper";
import { requestHelper } from "../helpers/request.helper";
import { responseHelper } from "../helpers/response.helper";
import { adminAuthSeeder } from "../seeders/admin/admin.seeder";
import { seedGlobalTestData } from "../seeders/global/global-test-data.seeder";
import { TestCaseMeta } from "../shared/interfaces/test-case.interface";
import { authHelper } from "../helpers/auth.helper";

const uniqueEmail = (prefix: string): string => {
  const id = randomUUID().replace(/-/g, "").slice(0, 10);
  return `${prefix}.${Date.now()}.${id}@flyvoid.test`;
};

describe("Admin Users APIs", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Admin Users APIs");
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

  it("TC_ADMIN_USERS_001 - should invite admin user with access controls", async () => {
    const meta: TestCaseMeta = {
      id: "TC_ADMIN_USERS_001",
      description: "Invite admin user success with access controls",
      expectedStatus: 201,
    };

    let actualStatus = 0;
    try {
      const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
      const session = await authHelper.signinAdmin(app, {
        email: seededSuperAdmin.email,
        password: seededSuperAdmin.password,
      });
      const invitePayload = {
        firstName: "Staff",
        lastName: "Member",
        email: uniqueEmail("staff"),
        role: "STAFF",
        accessControls: [
          {
            asset: "ADMIN_USERS",
            access: ["EDIT"],
          },
        ],
      };

      const response = await requestHelper.authorizedPost(
        app,
        "/api/v1/admin/users",
        invitePayload,
        session.accessToken,
      );
      actualStatus = response.status;

      const body = responseHelper.expectSuccess<{
        admin: { id: number; email: string; role: string };
        temporaryPassword: string;
      }>(response, 201);

      expect(body.data.admin.id).toBeDefined();
      expect(body.data.admin.email).toBe(invitePayload.email);
      expect(body.data.admin.role).toBe("STAFF");
      expect(typeof body.data.temporaryPassword).toBe("string");

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

  it("TC_ADMIN_USERS_002 - should fail invite when accessControls is missing", async () => {
    const meta: TestCaseMeta = {
      id: "TC_ADMIN_USERS_002",
      description: "Invite admin validation failure without access controls",
      expectedStatus: 400,
    };

    let actualStatus = 0;
    try {
      const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
      const session = await authHelper.signinAdmin(app, {
        email: seededSuperAdmin.email,
        password: seededSuperAdmin.password,
      });
      const response = await requestHelper.authorizedPost(
        app,
        "/api/v1/admin/users",
        {
          firstName: "Staff",
          lastName: "Member",
          email: uniqueEmail("staff-missing-ac"),
          role: "STAFF",
        },
        session.accessToken,
      );
      actualStatus = response.status;

      responseHelper.expectError(response, 400);
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

  it("TC_ADMIN_USERS_003 - should update admin user with access controls", async () => {
    const meta: TestCaseMeta = {
      id: "TC_ADMIN_USERS_003",
      description: "Update admin user success with access controls",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
      const session = await authHelper.signinAdmin(app, {
        email: seededSuperAdmin.email,
        password: seededSuperAdmin.password,
      });
      const response = await requestHelper.authorizedPatch(
        app,
        `/api/v1/admin/users/${session.adminId}`,
        {
          firstName: "UpdatedSuper",
          accessControls: [
            {
              asset: "PAYMENTS",
              access: ["EXPORT"],
            },
          ],
        },
        session.accessToken,
      );
      actualStatus = response.status;

      const body = responseHelper.expectSuccess<{
        id: number;
        firstName: string;
        role: string;
      }>(response, 200);

      expect(body.data.id).toBe(session.adminId);
      expect(body.data.firstName).toBe("UpdatedSuper");
      expect(body.data.role).toBe("SUPER_ADMIN");

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

  it("TC_ADMIN_USERS_004 - should return paginated admin users", async () => {
    const meta: TestCaseMeta = {
      id: "TC_ADMIN_USERS_004",
      description: "List admin users with pagination metadata",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
      const session = await authHelper.signinAdmin(app, {
        email: seededSuperAdmin.email,
        password: seededSuperAdmin.password,
      });
      const response = await requestHelper.authorizedGet(
        app,
        "/api/v1/admin/users?page=1&limit=2",
        session.accessToken,
      );
      actualStatus = response.status;

      const body = responseHelper.expectSuccess<{
        total: number;
        currentPage: number;
        limit: number;
        users: Array<{ id: number; email: string }>;
      }>(response, 200);

      expect(typeof body.data.total).toBe("number");
      expect(body.data.currentPage).toBe(1);
      expect(body.data.limit).toBe(2);
      expect(Array.isArray(body.data.users)).toBe(true);

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
});
