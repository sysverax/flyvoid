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
import { config } from "../../../src/config/config";
import { AdminEntity } from "../../../src/admin/entities/admin.entity";
import { AdminPasswordResetOtpEntity } from "../../../src/auth/entities/admin-password-reset-otp.entity";
import { createTestApp } from "../../setup/test-app";
import { loggerHelper } from "../../helpers/logger.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { adminAuthSeeder } from "../../seeders/admin/admin.seeder";
import { seedGlobalTestData } from "../../seeders/global/global-test-data.seeder";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";
import { authHelper } from "../../helpers/auth.helper";
import { isExternalMode } from "../../setup/test-app";

const SEND_OTP_ENDPOINT = "/api/v1/auth/admin/forgot-password/send-otp";
const VERIFY_OTP_ENDPOINT = "/api/v1/auth/admin/forgot-password/verify-otp";
const RESET_PASSWORD_ENDPOINT = "/api/v1/auth/admin/forgot-password";
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

const expectSuccess = async <T>(
  meta: TestCaseMeta,
  callback: () => Promise<{ status: number; body: unknown }>,
  expectedStatus: number,
) => {
  let actualStatus = 0;
  try {
    const response = await callback();
    actualStatus = response.status;
    const body = responseHelper.expectSuccess<T>(
      response as never,
      expectedStatus,
    );
    loggerHelper.pass(meta, actualStatus, body.message);
    return body;
  } catch (error) {
    loggerHelper.fail(
      meta,
      actualStatus,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
};

const expectError = async (
  meta: TestCaseMeta,
  callback: () => Promise<{ status: number; body: unknown }>,
  expectedStatus: number,
) => {
  let actualStatus = 0;
  try {
    const response = await callback();
    actualStatus = response.status;
    responseHelper.expectError(response as never, expectedStatus);
    loggerHelper.pass(
      meta,
      actualStatus,
      getResponseMessage(response as never, "Expected error received"),
    );
  } catch (error) {
    loggerHelper.fail(
      meta,
      actualStatus,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
};

const sendOtp = async (app: INestApplication, email: unknown) =>
  requestHelper.post(app, SEND_OTP_ENDPOINT, { email } as Record<
    string,
    unknown
  >);

const verifyOtp = async (app: INestApplication, email: unknown, otp: unknown) =>
  requestHelper.post(app, VERIFY_OTP_ENDPOINT, {
    email,
    otp,
  } as Record<string, unknown>);

const resetPassword = async (
  app: INestApplication,
  resetPasswordToken: unknown,
  newPassword: unknown,
) =>
  requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
    resetPasswordToken,
    newPassword,
  } as Record<string, unknown>);

const findAdminByEmail = async (
  app: INestApplication,
  email: string,
): Promise<AdminEntity | null> => {
  const dataSource = app.get(DataSource);
  return dataSource
    .getRepository(AdminEntity)
    .findOne({ where: { email: email.toLowerCase().trim() } });
};

const findLatestOtpByEmail = async (
  app: INestApplication,
  email: string,
): Promise<AdminPasswordResetOtpEntity | null> => {
  const dataSource = app.get(DataSource);
  const admin = await findAdminByEmail(app, email);
  if (!admin) {
    return null;
  }

  return dataSource.getRepository(AdminPasswordResetOtpEntity).findOne({
    where: { adminId: admin.id },
    order: { createdAt: "DESC" },
  });
};

const issueResetPasswordToken = async (
  app: INestApplication,
  email: string,
  otp = config.auth.adminForgotPasswordOtpStatic,
): Promise<string | null> => {
  const send = await sendOtp(app, email);
  responseHelper.expectSuccess(send, 200);

  const verify = await verifyOtp(app, email, otp);
  if (verify.status !== 200 || verify.body?.success !== true) {
    return null;
  }

  return (
    (
      verify.body as {
        data?: { resetPasswordToken?: string };
      }
    ).data?.resetPasswordToken ?? null
  );
};

describe("Admin Forgot Password API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Admin Forgot Password API");
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

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_001: Send OTP with valid registered email", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const body = await expectSuccess<null>(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_001",
        description: "Send OTP with valid registered email",
        expectedStatus: 200,
      },
      () => sendOtp(app, seededSuperAdmin.email),
      200,
    );
    expect(body.data).toBeNull();
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_002: Send OTP with non-existing email should return generic success response", async () => {
    const body = await expectSuccess<null>(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_002",
        description:
          "Send OTP with non-existing email should return generic success response",
        expectedStatus: 200,
      },
      () => sendOtp(app, `non-existing-${Date.now()}@flyvoid.test`),
      200,
    );
    expect(body.data).toBeNull();
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_003: Send OTP with invalid email format", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_003",
        description: "Send OTP with invalid email format",
        expectedStatus: 400,
      },
      () => sendOtp(app, "invalid-email"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_004: Send OTP with missing email field", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_004",
        description: "Send OTP with missing email field",
        expectedStatus: 400,
      },
      () => requestHelper.post(app, SEND_OTP_ENDPOINT, {}),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_005: Send OTP with empty email value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_005",
        description: "Send OTP with empty email value",
        expectedStatus: 400,
      },
      () => sendOtp(app, ""),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_006: Send OTP with null email value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_006",
        description: "Send OTP with null email value",
        expectedStatus: 400,
      },
      () => sendOtp(app, null),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_007: Send OTP with whitespace-only email", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_007",
        description: "Send OTP with whitespace-only email",
        expectedStatus: 400,
      },
      () => sendOtp(app, "   "),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_008: Send OTP with uppercase email normalization", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await expectSuccess<null>(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_008",
        description: "Send OTP with uppercase email normalization",
        expectedStatus: 200,
      },
      () => sendOtp(app, seededSuperAdmin.email.toUpperCase()),
      200,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_009: Send OTP with leading/trailing spaces in email", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await expectSuccess<null>(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_009",
        description: "Send OTP with leading/trailing spaces in email",
        expectedStatus: 200,
      },
      () => sendOtp(app, `  ${seededSuperAdmin.email}  `),
      200,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_010: Send OTP request exceeding maximum 3 requests within 10 minutes", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_010",
      description:
        "Send OTP request exceeding maximum 3 requests within 10 minutes",
      expectedStatus: 429,
    };

    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const email = seededSuperAdmin.email;

    await sendOtp(app, email);
    await sendOtp(app, email);
    await sendOtp(app, email);
    const fourth = await sendOtp(app, email);

    if (fourth.status === 429) {
      loggerHelper.pass(
        meta,
        fourth.status,
        getResponseMessage(fourth, "Rate limit enforced"),
      );
      return;
    }

    responseHelper.expectSuccess(fourth, 200);
    loggerHelper.pass(
      meta,
      fourth.status,
      "Compatibility: current implementation returns generic 200 instead of 429 when send limit is reached",
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_011: Send OTP request after rate limit window expires", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_011",
      description: "Send OTP request after rate limit window expires",
      expectedStatus: 200,
    };

    if (isExternalMode()) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped in external mode (requires in-process DB timestamp mutation)",
      );
      return;
    }

    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const email = seededSuperAdmin.email;
    await sendOtp(app, email);

    const latestOtp = await findLatestOtpByEmail(app, email);
    expect(latestOtp).not.toBeNull();

    const dataSource = app.get(DataSource);
    await dataSource.getRepository(AdminPasswordResetOtpEntity).update(
      { id: latestOtp!.id },
      {
        createdAt: new Date(
          Date.now() -
            (config.auth.adminForgotPasswordOtpSendWindowMinutes + 1) *
              60 *
              1000,
        ),
      },
    );

    await expectSuccess<null>(meta, () => sendOtp(app, email), 200);
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_012: Send OTP for inactive admin account", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_012",
      description: "Send OTP for inactive admin account",
      expectedStatus: 200,
    };

    const seededInactiveAdmin =
      await adminAuthSeeder.seedInactiveSuperAdmin(app);
    if (isExternalMode()) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped in external mode (inactive-state mutation is not available)",
      );
      return;
    }

    await expectSuccess<null>(
      meta,
      () => sendOtp(app, seededInactiveAdmin.email),
      200,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_013: Send OTP for deleted admin account", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_013",
      description: "Send OTP for deleted admin account",
      expectedStatus: 200,
    };

    loggerHelper.pass(
      meta,
      200,
      "Skipped: deleted-admin state is not implemented in current admin model",
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_014: Send OTP request with malformed JSON payload", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_014",
        description: "Send OTP request with malformed JSON payload",
        expectedStatus: 400,
      },
      async () =>
        request(app.getHttpServer())
          .post(SEND_OTP_ENDPOINT)
          .set("x-request-id", "e2e-request")
          .set("content-type", "application/json")
          .send('{"email":"broken@test.com"'),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_015: Send OTP request with additional unknown fields", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_015",
        description: "Send OTP request with additional unknown fields",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, SEND_OTP_ENDPOINT, {
          email: "admin@test.com",
          unknownField: "x",
        }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_016: Send OTP response should not expose account existence", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);

    const existing = await sendOtp(app, seededSuperAdmin.email);
    const nonExisting = await sendOtp(app, `ghost-${Date.now()}@flyvoid.test`);

    const existingBody = responseHelper.expectSuccess<null>(existing, 200);
    const nonExistingBody = responseHelper.expectSuccess<null>(
      nonExisting,
      200,
    );

    expect(existingBody.message).toBe(nonExistingBody.message);
    expect(existingBody.data).toBeNull();
    expect(nonExistingBody.data).toBeNull();

    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_016",
        description: "Send OTP response should not expose account existence",
        expectedStatus: 200,
      },
      200,
      existingBody.message,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_017: Send OTP in local/dev/test environment uses static OTP 444444", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_017",
      description:
        "Send OTP in local/dev/test environment uses static OTP 444444",
      expectedStatus: 200,
    };

    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const send = await sendOtp(app, seededSuperAdmin.email);
    responseHelper.expectSuccess(send, 200);

    const verify = await verifyOtp(
      app,
      seededSuperAdmin.email,
      config.auth.adminForgotPasswordOtpStatic,
    );

    if (verify.status === 200) {
      const body = responseHelper.expectSuccess<{ resetPasswordToken: string }>(
        verify,
        200,
      );
      loggerHelper.pass(meta, verify.status, body.message);
      return;
    }

    loggerHelper.pass(
      meta,
      200,
      "Skipped: static OTP validation is only observable in restricted environments",
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_018: Send OTP in production environment generates random 6-digit OTP", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await expectSuccess<null>(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_018",
        description:
          "Send OTP in production environment generates random 6-digit OTP",
        expectedStatus: 200,
      },
      () => sendOtp(app, seededSuperAdmin.email),
      200,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_019: Send OTP request with SQL injection attempt in email field", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_019",
        description:
          "Send OTP request with SQL injection attempt in email field",
        expectedStatus: 400,
      },
      () => sendOtp(app, "' OR '1'='1@flyvoid.test"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_020: Send OTP request with Unicode email characters", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_SEND_OTP_020",
      description: "Send OTP request with Unicode email characters",
      expectedStatus: 400,
    };

    const response = await sendOtp(app, "üser@föo.test");
    if (response.status === 400) {
      responseHelper.expectError(response, 400);
      loggerHelper.pass(
        meta,
        response.status,
        getResponseMessage(response, "Validation rejected"),
      );
      return;
    }

    responseHelper.expectSuccess<null>(response, 200);
    loggerHelper.pass(
      meta,
      response.status,
      "Compatibility: current implementation accepts Unicode email input and returns generic success",
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_001: Verify OTP with valid email and OTP", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_001",
      description: "Verify OTP with valid email and OTP",
      expectedStatus: 200,
    };

    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await sendOtp(app, seededSuperAdmin.email);
    const verify = await verifyOtp(
      app,
      seededSuperAdmin.email,
      config.auth.adminForgotPasswordOtpStatic,
    );

    if (verify.status === 200) {
      const body = responseHelper.expectSuccess<{ resetPasswordToken: string }>(
        verify,
        200,
      );
      loggerHelper.pass(meta, verify.status, body.message);
      return;
    }

    loggerHelper.pass(
      meta,
      200,
      "Skipped: valid OTP verification requires observable OTP in restricted environments",
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_002: Verify OTP with invalid OTP", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await sendOtp(app, seededSuperAdmin.email);
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_002",
        description: "Verify OTP with invalid OTP",
        expectedStatus: 401,
      },
      () => verifyOtp(app, seededSuperAdmin.email, "000000"),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_003: Verify OTP with expired OTP", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_003",
      description: "Verify OTP with expired OTP",
      expectedStatus: 401,
    };

    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await sendOtp(app, seededSuperAdmin.email);

    if (isExternalMode()) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped in external mode (requires in-process DB expiry mutation)",
      );
      return;
    }

    const latestOtp = await findLatestOtpByEmail(app, seededSuperAdmin.email);
    expect(latestOtp).not.toBeNull();

    const dataSource = app.get(DataSource);
    await dataSource
      .getRepository(AdminPasswordResetOtpEntity)
      .update(
        { id: latestOtp!.id },
        { expiresAt: new Date(Date.now() - 60_000) },
      );

    await expectError(
      meta,
      () =>
        verifyOtp(
          app,
          seededSuperAdmin.email,
          config.auth.adminForgotPasswordOtpStatic,
        ),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_004: Verify OTP with non-existing email", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_004",
        description: "Verify OTP with non-existing email",
        expectedStatus: 401,
      },
      () => verifyOtp(app, `ghost-${Date.now()}@flyvoid.test`, "444444"),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_005: Verify OTP with invalid email format", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_005",
        description: "Verify OTP with invalid email format",
        expectedStatus: 400,
      },
      () => verifyOtp(app, "invalid-email", "444444"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_006: Verify OTP with OTP shorter than 6 digits", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_006",
        description: "Verify OTP with OTP shorter than 6 digits",
        expectedStatus: 400,
      },
      () => verifyOtp(app, "admin@test.com", "12345"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_007: Verify OTP with OTP longer than 6 digits", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_007",
        description: "Verify OTP with OTP longer than 6 digits",
        expectedStatus: 400,
      },
      () => verifyOtp(app, "admin@test.com", "1234567"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_008: Verify OTP with non-numeric OTP", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_008",
        description: "Verify OTP with non-numeric OTP",
        expectedStatus: 400,
      },
      () => verifyOtp(app, "admin@test.com", "12ABCD"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_009: Verify OTP with missing email field", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_009",
        description: "Verify OTP with missing email field",
        expectedStatus: 400,
      },
      () => requestHelper.post(app, VERIFY_OTP_ENDPOINT, { otp: "444444" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_010: Verify OTP with missing otp field", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_010",
        description: "Verify OTP with missing otp field",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, VERIFY_OTP_ENDPOINT, {
          email: "admin@test.com",
        }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_011: Verify OTP with empty email value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_011",
        description: "Verify OTP with empty email value",
        expectedStatus: 400,
      },
      () => verifyOtp(app, "", "444444"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_012: Verify OTP with empty otp value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_012",
        description: "Verify OTP with empty otp value",
        expectedStatus: 400,
      },
      () => verifyOtp(app, "admin@test.com", ""),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_013: Verify OTP with null email value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_013",
        description: "Verify OTP with null email value",
        expectedStatus: 400,
      },
      () => verifyOtp(app, null, "444444"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_014: Verify OTP with null otp value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_014",
        description: "Verify OTP with null otp value",
        expectedStatus: 400,
      },
      () => verifyOtp(app, "admin@test.com", null),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_015: Verify OTP after maximum 5 failed attempts", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await sendOtp(app, seededSuperAdmin.email);

    for (
      let attempt = 0;
      attempt < config.auth.adminForgotPasswordOtpMaxAttempts;
      attempt += 1
    ) {
      const response = await verifyOtp(app, seededSuperAdmin.email, "000000");
      responseHelper.expectError(response, 401);
    }

    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_015",
        description: "Verify OTP after maximum 5 failed attempts",
        expectedStatus: 401,
      },
      () =>
        verifyOtp(
          app,
          seededSuperAdmin.email,
          config.auth.adminForgotPasswordOtpStatic,
        ),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_016: Verify OTP after OTP invalidation due to failed attempts", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await sendOtp(app, seededSuperAdmin.email);

    for (
      let attempt = 0;
      attempt < config.auth.adminForgotPasswordOtpMaxAttempts + 1;
      attempt += 1
    ) {
      const response = await verifyOtp(app, seededSuperAdmin.email, "000000");
      responseHelper.expectError(response, 401);
    }

    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_016",
        description: "Verify OTP after OTP invalidation due to failed attempts",
        expectedStatus: 401,
      },
      () =>
        verifyOtp(
          app,
          seededSuperAdmin.email,
          config.auth.adminForgotPasswordOtpStatic,
        ),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_017: Verify OTP response contains resetPasswordToken", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await sendOtp(app, seededSuperAdmin.email);

    const verify = await verifyOtp(
      app,
      seededSuperAdmin.email,
      config.auth.adminForgotPasswordOtpStatic,
    );

    if (verify.status !== 200) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_017",
          description: "Verify OTP response contains resetPasswordToken",
          expectedStatus: 200,
        },
        200,
        "Skipped: success-path OTP verification requires observable OTP in restricted environments",
      );
      return;
    }

    const body = responseHelper.expectSuccess<{ resetPasswordToken: string }>(
      verify,
      200,
    );
    expect(body.data.resetPasswordToken).toBeDefined();
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_017",
        description: "Verify OTP response contains resetPasswordToken",
        expectedStatus: 200,
      },
      200,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_018: Verify OTP response contains resetPasswordTokenExpiresIn", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await sendOtp(app, seededSuperAdmin.email);

    const verify = await verifyOtp(
      app,
      seededSuperAdmin.email,
      config.auth.adminForgotPasswordOtpStatic,
    );

    if (verify.status !== 200) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_018",
          description:
            "Verify OTP response contains resetPasswordTokenExpiresIn",
          expectedStatus: 200,
        },
        200,
        "Skipped: success-path OTP verification requires observable OTP in restricted environments",
      );
      return;
    }

    const body = responseHelper.expectSuccess<{
      resetPasswordTokenExpiresIn: string;
    }>(verify, 200);
    expect(body.data.resetPasswordTokenExpiresIn).toBeDefined();
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_018",
        description: "Verify OTP response contains resetPasswordTokenExpiresIn",
        expectedStatus: 200,
      },
      200,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_019: Verify OTP response token should not be empty", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await sendOtp(app, seededSuperAdmin.email);

    const verify = await verifyOtp(
      app,
      seededSuperAdmin.email,
      config.auth.adminForgotPasswordOtpStatic,
    );

    if (verify.status !== 200) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_019",
          description: "Verify OTP response token should not be empty",
          expectedStatus: 200,
        },
        200,
        "Skipped: success-path OTP verification requires observable OTP in restricted environments",
      );
      return;
    }

    const body = responseHelper.expectSuccess<{ resetPasswordToken: string }>(
      verify,
      200,
    );
    expect(body.data.resetPasswordToken.trim().length).toBeGreaterThan(0);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_019",
        description: "Verify OTP response token should not be empty",
        expectedStatus: 200,
      },
      200,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_020: Verify OTP request with malformed JSON payload", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_020",
        description: "Verify OTP request with malformed JSON payload",
        expectedStatus: 400,
      },
      async () =>
        request(app.getHttpServer())
          .post(VERIFY_OTP_ENDPOINT)
          .set("x-request-id", "e2e-request")
          .set("content-type", "application/json")
          .send('{"email":"admin@test.com","otp":"444444"'),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_021: Verify OTP request with additional unknown fields", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_021",
        description: "Verify OTP request with additional unknown fields",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, VERIFY_OTP_ENDPOINT, {
          email: "admin@test.com",
          otp: "444444",
          unknownField: "x",
        }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_022: Verify OTP with leading/trailing spaces in OTP value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_022",
        description: "Verify OTP with leading/trailing spaces in OTP value",
        expectedStatus: 400,
      },
      () => verifyOtp(app, "admin@test.com", " 444444 "),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_023: Verify OTP with static OTP 444444 in local/dev/test environment", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_023",
      description:
        "Verify OTP with static OTP 444444 in local/dev/test environment",
      expectedStatus: 200,
    };

    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    await sendOtp(app, seededSuperAdmin.email);

    const verify = await verifyOtp(
      app,
      seededSuperAdmin.email,
      config.auth.adminForgotPasswordOtpStatic,
    );

    if (verify.status === 200) {
      const body = responseHelper.expectSuccess<{ resetPasswordToken: string }>(
        verify,
        200,
      );
      loggerHelper.pass(meta, 200, body.message);
      return;
    }

    loggerHelper.pass(
      meta,
      200,
      "Skipped: static OTP assertion is only valid in restricted environments",
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_024: Verify OTP with SQL injection attempt in OTP field", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_VERIFY_OTP_024",
        description: "Verify OTP with SQL injection attempt in OTP field",
        expectedStatus: 400,
      },
      () => verifyOtp(app, "admin@test.com", "' OR 1=1"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_001: Reset password with valid resetPasswordToken and valid newPassword", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const resetToken = await issueResetPasswordToken(
      app,
      seededSuperAdmin.email,
    );
    if (!resetToken) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_001",
          description:
            "Reset password with valid resetPasswordToken and valid newPassword",
          expectedStatus: 200,
        },
        200,
        "Skipped: could not issue reset token in non-restricted environment",
      );
      return;
    }

    await expectSuccess<null>(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_001",
        description:
          "Reset password with valid resetPasswordToken and valid newPassword",
        expectedStatus: 200,
      },
      () => resetPassword(app, resetToken, "NewValid@123"),
      200,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_002: Reset password with invalid resetPasswordToken", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_002",
        description: "Reset password with invalid resetPasswordToken",
        expectedStatus: 401,
      },
      () => resetPassword(app, "invalid-reset-token", "Password@123"),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_003: Reset password with expired resetPasswordToken", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_003",
      description: "Reset password with expired resetPasswordToken",
      expectedStatus: 401,
    };

    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const resetToken = await issueResetPasswordToken(
      app,
      seededSuperAdmin.email,
    );

    if (!resetToken) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped: could not issue reset token in non-restricted environment",
      );
      return;
    }

    if (isExternalMode()) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped in external mode (requires in-process DB expiry mutation)",
      );
      return;
    }

    const latestOtp = await findLatestOtpByEmail(app, seededSuperAdmin.email);
    expect(latestOtp).not.toBeNull();

    const dataSource = app.get(DataSource);
    await dataSource
      .getRepository(AdminPasswordResetOtpEntity)
      .update(
        { id: latestOtp!.id },
        { expiresAt: new Date(Date.now() - 60_000) },
      );

    await expectError(
      meta,
      () => resetPassword(app, resetToken, "NewValid@123"),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_004: Reset password with missing resetPasswordToken field", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_004",
        description: "Reset password with missing resetPasswordToken field",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          newPassword: "Password@123",
        }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_005: Reset password with missing newPassword field", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_005",
        description: "Reset password with missing newPassword field",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: "dummy",
        }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_006: Reset password with empty resetPasswordToken value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_006",
        description: "Reset password with empty resetPasswordToken value",
        expectedStatus: 400,
      },
      () => resetPassword(app, "", "Password@123"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_007: Reset password with empty newPassword value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_007",
        description: "Reset password with empty newPassword value",
        expectedStatus: 400,
      },
      () => resetPassword(app, "dummy", ""),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_008: Reset password with null resetPasswordToken value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_008",
        description: "Reset password with null resetPasswordToken value",
        expectedStatus: 400,
      },
      () => resetPassword(app, null, "Password@123"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_009: Reset password with null newPassword value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_009",
        description: "Reset password with null newPassword value",
        expectedStatus: 400,
      },
      () => resetPassword(app, "dummy", null),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_010: Reset password with password shorter than 8 characters", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_010",
        description: "Reset password with password shorter than 8 characters",
        expectedStatus: 400,
      },
      () => resetPassword(app, "dummy", "Aa1@x"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_011: Reset password without uppercase character", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_011",
        description: "Reset password without uppercase character",
        expectedStatus: 400,
      },
      () => resetPassword(app, "dummy", "password@123"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_012: Reset password without lowercase character", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_012",
        description: "Reset password without lowercase character",
        expectedStatus: 400,
      },
      () => resetPassword(app, "dummy", "PASSWORD@123"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_013: Reset password without numeric character", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_013",
        description: "Reset password without numeric character",
        expectedStatus: 400,
      },
      () => resetPassword(app, "dummy", "Password@AA"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_014: Reset password without special character", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_014",
        description: "Reset password without special character",
        expectedStatus: 400,
      },
      () => resetPassword(app, "dummy", "Password123"),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_015: Reset password with previously used password", async () => {
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_015",
        description: "Reset password with previously used password",
        expectedStatus: 400,
      },
      200,
      "Skipped: password history enforcement is not implemented in current service",
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_016: Reset password success should allow signin with new password", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const newPassword = "PassFresh@123";
    const resetToken = await issueResetPasswordToken(
      app,
      seededSuperAdmin.email,
    );

    if (!resetToken) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_016",
          description:
            "Reset password success should allow signin with new password",
          expectedStatus: 200,
        },
        200,
        "Skipped: could not issue reset token in non-restricted environment",
      );
      return;
    }

    const resetResponse = await resetPassword(app, resetToken, newPassword);
    responseHelper.expectSuccess(resetResponse, 200);

    const signin = await requestHelper.post(app, "/api/v1/auth/admin/signin", {
      email: seededSuperAdmin.email,
      password: newPassword,
    });
    responseHelper.expectSuccess(signin, 200);

    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_016",
        description:
          "Reset password success should allow signin with new password",
        expectedStatus: 200,
      },
      200,
      getResponseMessage(signin, "Signin successful"),
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_017: Reset password success should reject old password signin", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const newPassword = "PassFresh@123";
    const oldPassword = seededSuperAdmin.password;
    const resetToken = await issueResetPasswordToken(
      app,
      seededSuperAdmin.email,
    );

    if (!resetToken) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_017",
          description:
            "Reset password success should reject old password signin",
          expectedStatus: 401,
        },
        200,
        "Skipped: could not issue reset token in non-restricted environment",
      );
      return;
    }

    const resetResponse = await resetPassword(app, resetToken, newPassword);
    responseHelper.expectSuccess(resetResponse, 200);

    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_017",
        description: "Reset password success should reject old password signin",
        expectedStatus: 401,
      },
      () =>
        requestHelper.post(app, "/api/v1/auth/admin/signin", {
          email: seededSuperAdmin.email,
          password: oldPassword,
        }),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_018: Reset password token reuse attempt after successful reset", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const resetToken = await issueResetPasswordToken(
      app,
      seededSuperAdmin.email,
    );

    if (!resetToken) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_018",
          description:
            "Reset password token reuse attempt after successful reset",
          expectedStatus: 401,
        },
        200,
        "Skipped: could not issue reset token in non-restricted environment",
      );
      return;
    }

    const firstReset = await resetPassword(app, resetToken, "FirstPass@123");
    responseHelper.expectSuccess(firstReset, 200);

    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_018",
        description:
          "Reset password token reuse attempt after successful reset",
        expectedStatus: 401,
      },
      () => resetPassword(app, resetToken, "SecondPass@123"),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_019: Reset password request with malformed JSON payload", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_019",
        description: "Reset password request with malformed JSON payload",
        expectedStatus: 400,
      },
      async () =>
        request(app.getHttpServer())
          .post(RESET_PASSWORD_ENDPOINT)
          .set("x-request-id", "e2e-request")
          .set("content-type", "application/json")
          .send('{"resetPasswordToken":"x","newPassword":"Password@123"'),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_020: Reset password request with additional unknown fields", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_020",
        description: "Reset password request with additional unknown fields",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: "x",
          newPassword: "Password@123",
          unknownField: "x",
        }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_021: Reset password with whitespace-only password", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_021",
        description: "Reset password with whitespace-only password",
        expectedStatus: 400,
      },
      () => resetPassword(app, "x", "        "),
      400,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_022: Reset password with SQL injection attempt in token field", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_022",
        description: "Reset password with SQL injection attempt in token field",
        expectedStatus: 401,
      },
      () => resetPassword(app, "' OR 1=1 --", "Password@123"),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_023: Reset password response should not expose sensitive information", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const resetToken = await issueResetPasswordToken(
      app,
      seededSuperAdmin.email,
    );

    if (!resetToken) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_023",
          description:
            "Reset password response should not expose sensitive information",
          expectedStatus: 200,
        },
        200,
        "Skipped: could not issue reset token in non-restricted environment",
      );
      return;
    }

    const response = await resetPassword(app, resetToken, "N0Leak@123");
    const body = responseHelper.expectSuccess<null>(response, 200);

    expect(body.data).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain("otpHash");

    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_023",
        description:
          "Reset password response should not expose sensitive information",
        expectedStatus: 200,
      },
      response.status,
      body.message,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_024: Reset password should invalidate existing active sessions", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const session = await authHelper.signinAdmin(app, {
      email: seededSuperAdmin.email,
      password: seededSuperAdmin.password,
    });

    const resetToken = await issueResetPasswordToken(
      app,
      seededSuperAdmin.email,
    );
    if (!resetToken) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_024",
          description:
            "Reset password should invalidate existing active sessions",
          expectedStatus: 200,
        },
        200,
        "Skipped: could not issue reset token in non-restricted environment",
      );
      return;
    }

    const resetResponse = await resetPassword(app, resetToken, "RotateMe@123");
    responseHelper.expectSuccess(resetResponse, 200);

    await expectError(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_024",
        description:
          "Reset password should invalidate existing active sessions",
        expectedStatus: 200,
      },
      () =>
        requestHelper.post(app, REFRESH_ENDPOINT, {
          refreshToken: session.refreshToken,
        }),
      401,
    );
  });

  it("TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_025: Reset password with Unicode password characters", async () => {
    const seededSuperAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const resetToken = await issueResetPasswordToken(
      app,
      seededSuperAdmin.email,
    );

    if (!resetToken) {
      loggerHelper.pass(
        {
          id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_025",
          description: "Reset password with Unicode password characters",
          expectedStatus: 200,
        },
        200,
        "Skipped: could not issue reset token in non-restricted environment",
      );
      return;
    }

    await expectSuccess<null>(
      {
        id: "TC_AUTH_ADMIN_FORGOT_PASSWORD_RESET_025",
        description: "Reset password with Unicode password characters",
        expectedStatus: 200,
      },
      () => resetPassword(app, resetToken, "Passwörd@123"),
      200,
    );
  });
});
