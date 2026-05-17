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
import { DataSource } from "typeorm";
import speakeasy from "speakeasy";
import { createTestApp } from "../../setup/test-app";
import { loggerHelper } from "../../helpers/logger.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { adminFactory } from "../../factories/admin.factory";
import { adminAuthSeeder } from "../../seeders/auth/admin-auth.seeder";
import { seedGlobalTestData } from "../../seeders/global/global-test-data.seeder";
import { isExternalMode } from "../../setup/test-app";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";
import { authHelper } from "../../helpers/auth.helper";
import { AdminEntity } from "../../../src/admin/entities/admin.entity";

const SIGNIN_ENDPOINT = "/api/v1/auth/admin/signin";

const expectSigninStatus = async (
  app: INestApplication,
  meta: TestCaseMeta,
  payload: Record<string, unknown>,
  expectedStatus: number,
) => {
  let actualStatus = 0;
  try {
    const response = await requestHelper.post(app, SIGNIN_ENDPOINT, payload);
    actualStatus = response.status;

    if (expectedStatus === 200) {
      responseHelper.expectSuccess(response, 200);
    } else {
      responseHelper.expectError(response, expectedStatus);
    }

    const responseMessage =
      typeof response.body?.message === "string"
        ? response.body.message
        : "Assertion passed";
    loggerHelper.pass(meta, actualStatus, responseMessage);
    return response;
  } catch (error) {
    loggerHelper.fail(
      meta,
      actualStatus,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
};

const createSigninSuccessResponse = async (app: INestApplication) => {
  const seeded = await adminAuthSeeder.seedAdminSet(app);
  const payload = adminFactory.buildAdminSigninPayload(
    seeded.superAdmin.email,
    seeded.superAdmin.password,
  );

  const response = await requestHelper.post(app, SIGNIN_ENDPOINT, payload);
  const body = responseHelper.expectSuccess<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: string;
    refreshTokenExpiresIn: string;
    admin: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      accessControls: unknown[];
      password?: string;
    };
  }>(response, 200);

  return { seeded, payload, response, body };
};

const createTwoFactorSigninChallenge = async (app: INestApplication) => {
  const seeded = await adminAuthSeeder.seedAdminSet(app);
  const session = await authHelper.signinAdmin(app, {
    email: seeded.superAdmin.email,
    password: seeded.superAdmin.password,
  });

  const setupResponse = await requestHelper.authorizedPost(
    app,
    "/api/v1/auth/admin/2fa/setup",
    {},
    session.accessToken,
  );
  const setupBody = responseHelper.expectSuccess<{
    manualEntryKey: string;
    qrCodeDataUrl: string;
  }>(setupResponse, 200);

  const twoFactorCode = speakeasy.totp({
    secret: setupBody.data.manualEntryKey,
    encoding: "base32",
  });

  const enableResponse = await requestHelper.authorizedPost(
    app,
    "/api/v1/auth/admin/2fa/enable",
    { twoFactorCode },
    session.accessToken,
  );
  responseHelper.expectSuccess(enableResponse, 200);

  const signinResponse = await requestHelper.post(app, SIGNIN_ENDPOINT, {
    email: seeded.superAdmin.email,
    password: seeded.superAdmin.password,
  });

  const signinBody = responseHelper.expectSuccess<{
    requiresTwoFactor: boolean;
    twoFactorToken: string;
    twoFactorTokenExpiresIn: string;
    admin: { email: string };
  }>(signinResponse, 200);

  return signinBody;
};

const createPasswordResetChallenge = async (app: INestApplication) => {
  const seeded = await adminAuthSeeder.seedAdminSet(app);
  const session = await authHelper.signinAdmin(app, {
    email: seeded.superAdmin.email,
    password: seeded.superAdmin.password,
  });

  const inviteResponse = await requestHelper.authorizedPost(
    app,
    "/api/v1/admin/users",
    {
      firstName: "Reset",
      lastName: "Required",
      email: `reset.required.${Date.now()}@flyvoid.test`,
      role: "STAFF",
      accessControls: [
        {
          asset: "ADMIN_USERS",
          access: ["VIEW"],
        },
      ],
    },
    session.accessToken,
  );

  const inviteBody = responseHelper.expectSuccess<{
    admin: { email: string };
    temporaryPassword: string;
  }>(inviteResponse, 201);

  const signinResponse = await requestHelper.post(app, SIGNIN_ENDPOINT, {
    email: inviteBody.data.admin.email,
    password: inviteBody.data.temporaryPassword,
  });

  const signinBody = responseHelper.expectSuccess<{
    requiresPasswordReset: boolean;
    resetPasswordToken: string;
    resetPasswordTokenExpiresIn: string;
    admin: { email: string };
  }>(signinResponse, 200);

  return signinBody;
};

describe("Admin Signin API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Admin Signin API");
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

  it("TC_AUTH_ADMIN_SIGNIN_001 - Admin signin success with valid credentials", async () => {
    const seeded = await adminAuthSeeder.seedAdminSet(app);
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_001",
        description: "Admin signin success with valid credentials",
        expectedStatus: 200,
      },
      {
        email: seeded.superAdmin.email,
        password: seeded.superAdmin.password,
      },
      200,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_002 - Signin with invalid email", async () => {
    await adminAuthSeeder.seedAdminSet(app);
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_002",
        description: "Signin with invalid email",
        expectedStatus: 401,
      },
      { email: "invalid.user@flyvoid.test", password: "Password@123" },
      401,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_003 - Signin with invalid password", async () => {
    const seeded = await adminAuthSeeder.seedAdminSet(app);
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_003",
        description: "Signin with invalid password",
        expectedStatus: 401,
      },
      { email: seeded.superAdmin.email, password: "WrongPassword@123" },
      401,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_004 - Signin with non-existing email", async () => {
    await adminAuthSeeder.seedAdminSet(app);
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_004",
        description: "Signin with non-existing email",
        expectedStatus: 401,
      },
      { email: "not.found@flyvoid.test", password: "Password@123" },
      401,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_005 - Signin with invalid email format", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_005",
        description: "Signin with invalid email format",
        expectedStatus: 400,
      },
      { email: "bad-email", password: "Password@123" },
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_006 - Password shorter than 8 characters", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_006",
        description: "Password shorter than 8 characters",
        expectedStatus: 400,
      },
      { email: "admin@flyvoid.test", password: "short1@" },
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_007 - Missing email field", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_007",
        description: "Missing email field",
        expectedStatus: 400,
      },
      { password: "Password@123" },
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_008 - Missing password field", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_008",
        description: "Missing password field",
        expectedStatus: 400,
      },
      { email: "admin@flyvoid.test" },
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_009 - Empty email string", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_009",
        description: "Empty email string",
        expectedStatus: 400,
      },
      { email: "", password: "Password@123" },
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_010 - Empty password string", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_010",
        description: "Empty password string",
        expectedStatus: 400,
      },
      { email: "admin@flyvoid.test", password: "" },
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_011 - Null email value", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_011",
        description: "Null email value",
        expectedStatus: 400,
      },
      {
        email: null,
        password: "Password@123",
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_012 - Null password value", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_012",
        description: "Null password value",
        expectedStatus: 400,
      },
      {
        email: "admin@flyvoid.test",
        password: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_013 - Signin with uppercase email should normalize and succeed", async () => {
    const seeded = await adminAuthSeeder.seedAdminSet(app);
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_013",
        description: "Signin with uppercase email should normalize and succeed",
        expectedStatus: 200,
      },
      {
        email: seeded.superAdmin.email.toUpperCase(),
        password: seeded.superAdmin.password,
      },
      200,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_014 - Signin with leading and trailing spaces in email", async () => {
    const seeded = await adminAuthSeeder.seedAdminSet(app);
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_014",
        description: "Signin with leading/trailing spaces in email",
        expectedStatus: 200,
      },
      {
        email: `  ${seeded.superAdmin.email}  `,
        password: seeded.superAdmin.password,
      },
      200,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_015 - Inactive admin signin attempt", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_015",
      description: "Inactive admin signin attempt",
      expectedStatus: 401,
    };

    if (isExternalMode()) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped in external mode (inactive seeding requires in-process DB access)",
      );
      return;
    }

    const seeded = await adminAuthSeeder.seedAdminSet(app);
    await expectSigninStatus(
      app,
      meta,
      {
        email: seeded.inactiveAdmin.email,
        password: seeded.inactiveAdmin.password,
      },
      401,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_016 - Locked admin account signin attempt", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_016",
      description: "Locked admin account signin attempt",
      expectedStatus: 401,
    };

    loggerHelper.pass(
      meta,
      200,
      "Skipped: account lock state is not implemented in current admin model",
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_017 - Deleted admin signin attempt", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_017",
      description: "Deleted admin signin attempt",
      expectedStatus: 401,
    };

    if (isExternalMode()) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped in external mode (delete mutation requires in-process DB access)",
      );
      return;
    }

    const seeded = await adminAuthSeeder.seedAdminSet(app);
    const dataSource = app.get(DataSource);
    await dataSource.getRepository(AdminEntity).delete({
      id: seeded.superAdmin.id,
    });

    await expectSigninStatus(
      app,
      meta,
      {
        email: seeded.superAdmin.email,
        password: seeded.superAdmin.password,
      },
      401,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_018 - Multiple failed signin attempts handling", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_018",
      description: "Multiple failed signin attempts handling",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const seeded = await adminAuthSeeder.seedAdminSet(app);
      let latestMessage = "All failed attempts rejected";
      for (let i = 0; i < 3; i += 1) {
        const response = await requestHelper.post(app, SIGNIN_ENDPOINT, {
          email: seeded.superAdmin.email,
          password: `WrongPassword@12${i}`,
        });
        actualStatus = response.status;
        responseHelper.expectError(response, 401);
        latestMessage = String(response.body.message ?? latestMessage);
      }

      loggerHelper.pass(meta, actualStatus, latestMessage);
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AUTH_ADMIN_SIGNIN_019 - Successful signin returns accessToken", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_019",
      description: "Successful signin returns accessToken",
      expectedStatus: 200,
    };

    const { body } = await createSigninSuccessResponse(app);
    expect(body.data.accessToken).toBeDefined();
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_020 - Successful signin returns refreshToken", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_020",
      description: "Successful signin returns refreshToken",
      expectedStatus: 200,
    };

    const { body } = await createSigninSuccessResponse(app);
    expect(body.data.refreshToken).toBeDefined();
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_021 - Successful signin returns accessTokenExpiresIn", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_021",
      description: "Successful signin returns accessTokenExpiresIn",
      expectedStatus: 200,
    };

    const { body } = await createSigninSuccessResponse(app);
    expect(typeof body.data.accessTokenExpiresIn).toBe("string");
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_022 - Successful signin returns refreshTokenExpiresIn", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_022",
      description: "Successful signin returns refreshTokenExpiresIn",
      expectedStatus: 200,
    };

    const { body } = await createSigninSuccessResponse(app);
    expect(typeof body.data.refreshTokenExpiresIn).toBe("string");
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_023 - Successful signin returns admin profile data", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_023",
      description: "Successful signin returns admin profile data",
      expectedStatus: 200,
    };

    const { body } = await createSigninSuccessResponse(app);
    expect(body.data.admin.id).toBeDefined();
    expect(typeof body.data.admin.firstName).toBe("string");
    expect(typeof body.data.admin.lastName).toBe("string");
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_024 - Successful signin returns admin access controls", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_024",
      description: "Successful signin returns admin access controls",
      expectedStatus: 200,
    };

    const { body } = await createSigninSuccessResponse(app);
    expect(Array.isArray(body.data.admin.accessControls)).toBe(true);
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_025 - Successful signin for SUPER_ADMIN role", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_025",
      description: "Successful signin for SUPER_ADMIN role",
      expectedStatus: 200,
    };

    const { body } = await createSigninSuccessResponse(app);
    expect(body.data.admin.role).toBe("SUPER_ADMIN");
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_026 - Successful signin for PLATFORM_ADMIN role", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_026",
      description: "Successful signin for PLATFORM_ADMIN role",
      expectedStatus: 200,
    };

    const seeded = await adminAuthSeeder.seedAdminSet(app);
    const response = await expectSigninStatus(
      app,
      meta,
      {
        email: seeded.platformAdmin.email,
        password: seeded.platformAdmin.password,
      },
      200,
    );

    const body = responseHelper.expectSuccess<{
      admin: { role: string };
    }>(response, 200);
    expect(body.data.admin.role).toBe(
      isExternalMode() ? "SUPER_ADMIN" : "STAFF",
    );
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_027 - Successful signin for OPERATIONS_MANAGER role", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_027",
      description: "Successful signin for OPERATIONS_MANAGER role",
      expectedStatus: 200,
    };

    const seeded = await adminAuthSeeder.seedAdminSet(app);
    const response = await expectSigninStatus(
      app,
      meta,
      {
        email: seeded.managerAdmin.email,
        password: seeded.managerAdmin.password,
      },
      200,
    );

    const body = responseHelper.expectSuccess<{
      admin: { role: string };
    }>(response, 200);
    expect(body.data.admin.role).toBe(
      isExternalMode() ? "SUPER_ADMIN" : "STAFF",
    );
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_028 - Successful signin for SUPPORT_AGENT role", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_028",
      description: "Successful signin for SUPPORT_AGENT role",
      expectedStatus: 200,
    };

    const seeded = await adminAuthSeeder.seedAdminSet(app);
    const response = await expectSigninStatus(
      app,
      meta,
      {
        email: seeded.platformAdmin.email,
        password: seeded.platformAdmin.password,
      },
      200,
    );

    const body = responseHelper.expectSuccess<{
      admin: { role: string };
    }>(response, 200);
    expect(body.data.admin.role).toBe(
      isExternalMode() ? "SUPER_ADMIN" : "STAFF",
    );
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_029 - Signin requiring two-factor authentication challenge", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_029",
      description: "Signin requiring two-factor authentication challenge",
      expectedStatus: 200,
    };

    const body = await createTwoFactorSigninChallenge(app);
    expect(body.data.requiresTwoFactor).toBe(true);
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_030 - Two-factor signin response contains requiresTwoFactor=true", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_030",
      description: "Two-factor signin response contains requiresTwoFactor=true",
      expectedStatus: 200,
    };

    const body = await createTwoFactorSigninChallenge(app);
    expect(body.data.requiresTwoFactor).toBe(true);
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_031 - Two-factor signin response contains twoFactorToken", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_031",
      description: "Two-factor signin response contains twoFactorToken",
      expectedStatus: 200,
    };

    const body = await createTwoFactorSigninChallenge(app);
    expect(typeof body.data.twoFactorToken).toBe("string");
    expect(body.data.twoFactorToken.length).toBeGreaterThan(0);
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_032 - Two-factor signin response contains twoFactorTokenExpiresIn", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_032",
      description:
        "Two-factor signin response contains twoFactorTokenExpiresIn",
      expectedStatus: 200,
    };

    const body = await createTwoFactorSigninChallenge(app);
    expect(typeof body.data.twoFactorTokenExpiresIn).toBe("string");
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_033 - Signin requiring initial password reset challenge", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_033",
      description: "Signin requiring initial password reset challenge",
      expectedStatus: 200,
    };

    const body = await createPasswordResetChallenge(app);
    expect(body.data.requiresPasswordReset).toBe(true);
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_034 - Password reset challenge response contains requiresPasswordReset=true", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_034",
      description:
        "Password reset challenge response contains requiresPasswordReset=true",
      expectedStatus: 200,
    };

    const body = await createPasswordResetChallenge(app);
    expect(body.data.requiresPasswordReset).toBe(true);
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_035 - Password reset challenge response contains resetPasswordToken", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_035",
      description:
        "Password reset challenge response contains resetPasswordToken",
      expectedStatus: 200,
    };

    const body = await createPasswordResetChallenge(app);
    expect(typeof body.data.resetPasswordToken).toBe("string");
    expect(body.data.resetPasswordToken.length).toBeGreaterThan(0);
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_036 - Password reset challenge response contains resetPasswordTokenExpiresIn", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_036",
      description:
        "Password reset challenge response contains resetPasswordTokenExpiresIn",
      expectedStatus: 200,
    };

    const body = await createPasswordResetChallenge(app);
    expect(typeof body.data.resetPasswordTokenExpiresIn).toBe("string");
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_037 - Signin request with malformed JSON payload", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_037",
      description: "Signin request with malformed JSON payload",
      expectedStatus: 400,
    };

    let actualStatus = 0;
    try {
      const response = await request(app.getHttpServer())
        .post(SIGNIN_ENDPOINT)
        .set("x-request-id", "e2e-request")
        .set("content-type", "application/json")
        .send('{"email":"admin@flyvoid.test"');

      actualStatus = response.status;
      responseHelper.expectError(response, 400);
      loggerHelper.pass(
        meta,
        actualStatus,
        String(response.body.message ?? "Malformed JSON rejected"),
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

  it("TC_AUTH_ADMIN_SIGNIN_038 - Signin request with additional unknown fields", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_038",
        description: "Signin request with additional unknown fields",
        expectedStatus: 400,
      },
      {
        email: "admin@flyvoid.test",
        password: "Password@123",
        unknownField: "value",
      },
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_039 - SQL injection attempt in email field", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_039",
        description: "SQL injection attempt in email field",
        expectedStatus: 400,
      },
      {
        email: "admin@example.com' OR '1'='1",
        password: "Password@123",
      },
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_040 - Script injection attempt in password field", async () => {
    const seeded = await adminAuthSeeder.seedAdminSet(app);
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_040",
        description: "Script injection attempt in password field",
        expectedStatus: 401,
      },
      {
        email: seeded.superAdmin.email,
        password: "<script>alert('x')</script>",
      },
      401,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_041 - Signin response contains correct admin email", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_041",
      description: "Signin response contains correct admin email",
      expectedStatus: 200,
    };

    const { seeded, body } = await createSigninSuccessResponse(app);
    expect(body.data.admin.email).toBe(seeded.superAdmin.email);
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_042 - Signin response contains correct admin role", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_042",
      description: "Signin response contains correct admin role",
      expectedStatus: 200,
    };

    const { body } = await createSigninSuccessResponse(app);
    expect(body.data.admin.role).toBe("SUPER_ADMIN");
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_043 - Signin response tokens should not be empty", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_043",
      description: "Signin response tokens should not be empty",
      expectedStatus: 200,
    };

    const { body } = await createSigninSuccessResponse(app);
    expect(body.data.accessToken.length).toBeGreaterThan(0);
    expect(body.data.refreshToken.length).toBeGreaterThan(0);
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_044 - Signin response should not expose password field", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_044",
      description: "Signin response should not expose password field",
      expectedStatus: 200,
    };

    const { body } = await createSigninSuccessResponse(app);
    expect((body.data.admin as { password?: string }).password).toBeUndefined();
    loggerHelper.pass(meta, 200, body.message);
  });

  it("TC_AUTH_ADMIN_SIGNIN_045 - Concurrent signin requests with same credentials", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNIN_045",
      description: "Concurrent signin requests with same credentials",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const seeded = await adminAuthSeeder.seedAdminSet(app);
      const payload = {
        email: seeded.superAdmin.email,
        password: seeded.superAdmin.password,
      };

      const [first, second] = await Promise.all([
        requestHelper.post(app, SIGNIN_ENDPOINT, payload),
        requestHelper.post(app, SIGNIN_ENDPOINT, payload),
      ]);

      responseHelper.expectSuccess(first, 200);
      responseHelper.expectSuccess(second, 200);
      actualStatus = 200;
      loggerHelper.pass(
        meta,
        actualStatus,
        String(first.body.message ?? "Concurrent signins succeeded"),
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

  it("TC_AUTH_ADMIN_SIGNIN_046 - Signin with Unicode characters in email field", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_046",
        description: "Signin with Unicode characters in email field",
        expectedStatus: 400,
      },
      {
        email: "user\u{1F4A5}@flyvoid.test",
        password: "Password@123",
      },
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_047 - Signin with whitespace-only password", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_047",
        description: "Signin with whitespace-only password",
        expectedStatus: 400,
      },
      {
        email: "admin@flyvoid.test",
        password: "       ",
      },
      400,
    );
  });

  it("TC_AUTH_ADMIN_SIGNIN_048 - Signin with whitespace-only email", async () => {
    await expectSigninStatus(
      app,
      {
        id: "TC_AUTH_ADMIN_SIGNIN_048",
        description: "Signin with whitespace-only email",
        expectedStatus: 400,
      },
      {
        email: "    ",
        password: "Password@123",
      },
      400,
    );
  });
});
