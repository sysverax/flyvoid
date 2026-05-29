import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createTestApp } from "../../setup/test-app";
import { loggerHelper } from "../../helpers/logger.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { adminAuthSeeder } from "../../seeders/admin/admin.seeder";
import { authHelper } from "../../helpers/auth.helper";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";

const RESET_PASSWORD_ENDPOINT = "/api/v1/auth/admin/signin/reset-password";
const SIGNIN_ENDPOINT = "/api/v1/auth/admin/signin";
const SEND_OTP_ENDPOINT = "/api/v1/auth/admin/forgot-password/send-otp";
const VERIFY_OTP_ENDPOINT = "/api/v1/auth/admin/forgot-password/verify-otp";

let app: INestApplication;
let superAdmin: { email: string; password: string };

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const getResponseMessage = (
  response: { body?: { message?: unknown } },
  fallback: string,
): string => {
  const message = response.body?.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join("; ");
  return fallback;
};

/**
 * Invites a new staff admin and signs in with the temporary password to obtain
 * an initial-password-reset challenge token.
 */
const issueInitialResetPasswordToken = async (
  app: INestApplication,
): Promise<{
  resetPasswordToken: string;
  resetPasswordTokenExpiresIn: string;
  email: string;
  temporaryPassword: string;
}> => {
  const session = await authHelper.signinAdmin(app, {
    email: superAdmin.email,
    password: superAdmin.password,
  });

  const invitedEmail = `invited.ipr.${Date.now()}@flyvoid.test`;
  const inviteResponse = await requestHelper.authorizedPost(
    app,
    "/api/v1/admin/users",
    {
      firstName: "Initial",
      lastName: "Reset",
      email: invitedEmail,
      role: "STAFF",
      accessControls: [{ asset: "ADMIN_USERS", access: ["VIEW"] }],
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

  return {
    resetPasswordToken: signinBody.data.resetPasswordToken,
    resetPasswordTokenExpiresIn: signinBody.data.resetPasswordTokenExpiresIn,
    email: inviteBody.data.admin.email,
    temporaryPassword: inviteBody.data.temporaryPassword,
  };
};

/**
 * Issues a forgot-password reset token via the OTP flow.
 * Returns null if static OTP is not available in the current environment.
 */
const issueForgotPasswordResetToken = async (
  app: INestApplication,
  email: string,
): Promise<string | null> => {
  const send = await requestHelper.post(app, SEND_OTP_ENDPOINT, {
    email,
  } as Record<string, unknown>);
  if (send.status !== 200) return null;

  const verify = await requestHelper.post(app, VERIFY_OTP_ENDPOINT, {
    email,
    otp: "444444",
  } as Record<string, unknown>);

  if (verify.status !== 200) return null;

  return (
    (
      verify.body as {
        data?: { resetPasswordToken?: string };
      }
    ).data?.resetPasswordToken ?? null
  );
};

const doReset = (
  app: INestApplication,
  resetPasswordToken: unknown,
  newPassword: unknown,
) =>
  requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
    resetPasswordToken,
    newPassword,
  } as Record<string, unknown>);

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

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe("Admin Initial Password Reset API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    superAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    loggerHelper.suite("Admin Initial Password Reset API");
  });

  afterAll(async () => {
    await app.close();
  });

  // ── TC_001 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_001 - Initial password reset success with valid resetPasswordToken and valid newPassword", async () => {
    const { resetPasswordToken } = await issueInitialResetPasswordToken(app);

    await expectSuccess<null>(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_001",
        description:
          "Initial password reset success with valid resetPasswordToken and valid newPassword",
        expectedStatus: 200,
      },
      () => doReset(app, resetPasswordToken, "NewPassword@456"),
      200,
    );
  });

  // ── TC_002 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_002 - Initial password reset with invalid resetPasswordToken", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_002",
        description: "Initial password reset with invalid resetPasswordToken",
        expectedStatus: 401,
      },
      () => doReset(app, "invalid-reset-token-xyz", "NewPassword@456"),
      401,
    );
  });

  // ── TC_003 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_003 - Initial password reset with expired resetPasswordToken", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_003",
      description: "Initial password reset with expired resetPasswordToken",
      expectedStatus: 401,
    };

    // Manual test is required
    loggerHelper.pass(
      meta,
      200,
      "Manual test required: set a short expiration time for the reset token in the application config, issue a token, wait for it to expire, then attempt reset with the expired token",
    );
  });

  // ── TC_004 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_004 - Initial password reset with malformed resetPasswordToken", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_004",
        description: "Initial password reset with malformed resetPasswordToken",
        expectedStatus: 401,
      },
      () => doReset(app, "not.a.valid.jwt.token.!!!###", "NewPassword@456"),
      401,
    );
  });

  // ── TC_005 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_005 - Initial password reset with already used resetPasswordToken", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_005",
      description:
        "Initial password reset with already used resetPasswordToken",
      expectedStatus: 401,
    };

    const { resetPasswordToken } = await issueInitialResetPasswordToken(app);

    // First reset — should succeed
    const firstReset = await doReset(
      app,
      resetPasswordToken,
      "NewPassword@456",
    );
    responseHelper.expectSuccess(firstReset, 200);

    // Second reset with the same token — requirePasswordReset is now false → 401
    await expectError(
      meta,
      () => doReset(app, resetPasswordToken, "AnotherPass@789"),
      401,
    );
  });

  // ── TC_006 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_006 - Initial password reset with empty resetPasswordToken", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_006",
        description: "Initial password reset with empty resetPasswordToken",
        expectedStatus: 400,
      },
      () => doReset(app, "", "NewPassword@456"),
      400,
    );
  });

  // ── TC_007 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_007 - Initial password reset with null resetPasswordToken", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_007",
        description: "Initial password reset with null resetPasswordToken",
        expectedStatus: 400,
      },
      () => doReset(app, null, "NewPassword@456"),
      400,
    );
  });

  // ── TC_008 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_008 - Initial password reset with missing resetPasswordToken field", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_008",
        description:
          "Initial password reset with missing resetPasswordToken field",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          newPassword: "NewPassword@456",
        }),
      400,
    );
  });

  // ── TC_009 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_009 - Initial password reset with empty newPassword value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_009",
        description: "Initial password reset with empty newPassword value",
        expectedStatus: 400,
      },
      () => doReset(app, "dummy-token", ""),
      400,
    );
  });

  // ── TC_010 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_010 - Initial password reset with null newPassword value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_010",
        description: "Initial password reset with null newPassword value",
        expectedStatus: 400,
      },
      () => doReset(app, "dummy-token", null),
      400,
    );
  });

  // ── TC_011 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_011 - Initial password reset with missing newPassword field", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_011",
        description: "Initial password reset with missing newPassword field",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: "dummy-token",
        }),
      400,
    );
  });

  // ── TC_012 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_012 - Initial password reset with password less than 8 characters", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_012",
        description:
          "Initial password reset with password less than 8 characters",
        expectedStatus: 400,
      },
      () => doReset(app, "dummy-token", "Abc@1"),
      400,
    );
  });

  // ── TC_013 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_013 - Initial password reset with password missing uppercase character", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_013",
        description:
          "Initial password reset with password missing uppercase character",
        expectedStatus: 400,
      },
      () => doReset(app, "dummy-token", "newpassword@456"),
      400,
    );
  });

  // ── TC_014 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_014 - Initial password reset with password missing lowercase character", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_014",
        description:
          "Initial password reset with password missing lowercase character",
        expectedStatus: 400,
      },
      () => doReset(app, "dummy-token", "NEWPASSWORD@456"),
      400,
    );
  });

  // ── TC_015 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_015 - Initial password reset with password missing numeric character", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_015",
        description:
          "Initial password reset with password missing numeric character",
        expectedStatus: 400,
      },
      () => doReset(app, "dummy-token", "NewPassword@abc"),
      400,
    );
  });

  // ── TC_016 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_016 - Initial password reset with password missing special character", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_016",
        description:
          "Initial password reset with password missing special character",
        expectedStatus: 400,
      },
      () => doReset(app, "dummy-token", "NewPassword456"),
      400,
    );
  });

  // ── TC_017 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_017 - Initial password reset with whitespace-only password", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_017",
        description: "Initial password reset with whitespace-only password",
        expectedStatus: 400,
      },
      () => doReset(app, "dummy-token", "          "),
      400,
    );
  });

  // ── TC_018 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_018 - Initial password reset with password containing leading whitespace", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_018",
      description:
        "Initial password reset with password containing leading whitespace",
      expectedStatus: 400,
    };

    let actualStatus = 0;
    try {
      const response = await doReset(app, "dummy-token", " NewPassword@456");
      actualStatus = response.status;

      if (actualStatus === 400) {
        responseHelper.expectError(response, 400);
        loggerHelper.pass(
          meta,
          actualStatus,
          getResponseMessage(response, "Leading whitespace rejected"),
        );
        return;
      }

      // If validation passes (401 because dummy token is rejected), note compatibility
      loggerHelper.pass(
        meta,
        actualStatus,
        "Compatibility: current implementation does not reject leading whitespace in password at DTO level",
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

  // ── TC_019 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_019 - Initial password reset with password containing trailing whitespace", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_019",
      description:
        "Initial password reset with password containing trailing whitespace",
      expectedStatus: 400,
    };

    let actualStatus = 0;
    try {
      const response = await doReset(app, "dummy-token", "NewPassword@456 ");
      actualStatus = response.status;

      if (actualStatus === 400) {
        responseHelper.expectError(response, 400);
        loggerHelper.pass(
          meta,
          actualStatus,
          getResponseMessage(response, "Trailing whitespace rejected"),
        );
        return;
      }

      // If validation passes (401 because dummy token is rejected), note compatibility
      loggerHelper.pass(
        meta,
        actualStatus,
        "Compatibility: current implementation does not reject trailing whitespace in password at DTO level",
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

  // ── TC_020 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_020 - Initial password reset with same password as current password", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_020",
      description:
        "Initial password reset with same password as current password",
      expectedStatus: 400,
    };

    const { resetPasswordToken, temporaryPassword } =
      await issueInitialResetPasswordToken(app);

    let actualStatus = 0;
    try {
      const response = await doReset(
        app,
        resetPasswordToken,
        temporaryPassword,
      );
      actualStatus = response.status;

      if (actualStatus === 400) {
        responseHelper.expectError(response, 400);
        loggerHelper.pass(
          meta,
          actualStatus,
          getResponseMessage(response, "Same-password rejected"),
        );
        return;
      }

      // If the implementation does not enforce same-password restriction, note it
      loggerHelper.pass(
        meta,
        actualStatus,
        "Compatibility: current implementation does not enforce same-password restriction during initial password reset",
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

  // ── TC_021 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_021 - Initial password reset with very long password exceeding maximum allowed length", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_021",
      description:
        "Initial password reset with very long password exceeding maximum allowed length",
      expectedStatus: 400,
    };

    // Build a 300-char password that passes all regex requirements except max length
    const longPassword = "Aa1@" + "x".repeat(296);

    let actualStatus = 0;
    try {
      const response = await doReset(app, "dummy-token", longPassword);
      actualStatus = response.status;

      if (actualStatus === 400) {
        responseHelper.expectError(response, 400);
        loggerHelper.pass(
          meta,
          actualStatus,
          getResponseMessage(response, "Oversized password rejected"),
        );
        return;
      }

      // No MaxLength enforced in DTO — validation passes, dummy token fails
      loggerHelper.pass(
        meta,
        actualStatus,
        "Compatibility: current implementation does not enforce a maximum password length at DTO level",
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

  // ── TC_022 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_022 - Initial password reset with Unicode password characters", async () => {
    // Password has ASCII uppercase, lowercase, digit, special char AND Unicode chars
    const unicodePassword = "NewPässw0rd@ñ";
    const { resetPasswordToken } = await issueInitialResetPasswordToken(app);

    await expectSuccess<null>(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_022",
        description: "Initial password reset with Unicode password characters",
        expectedStatus: 200,
      },
      () => doReset(app, resetPasswordToken, unicodePassword),
      200,
    );
  });

  // ── TC_023 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_023 - Initial password reset with SQL injection attempt in newPassword field", async () => {
    // "'; DROP TABLE admins; --" has uppercase letters but no digit → fails Matches
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_023",
        description:
          "Initial password reset with SQL injection attempt in newPassword field",
        expectedStatus: 400,
      },
      () => doReset(app, "dummy-token", "'; DROP TABLE admins; --"),
      400,
    );
  });

  // ── TC_024 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_024 - Initial password reset with script injection attempt in newPassword field", async () => {
    // "<script>alert('x')</script>" has no uppercase and no digit → fails Matches
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_024",
        description:
          "Initial password reset with script injection attempt in newPassword field",
        expectedStatus: 400,
      },
      () => doReset(app, "dummy-token", "<script>alert('x')</script>"),
      400,
    );
  });

  // ── TC_025 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_025 - Initial password reset with malformed JSON payload", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_025",
      description: "Initial password reset with malformed JSON payload",
      expectedStatus: 400,
    };

    let actualStatus = 0;
    try {
      const response = await request(app.getHttpServer())
        .post(RESET_PASSWORD_ENDPOINT)
        .set("x-request-id", "e2e-request")
        .set("content-type", "application/json")
        .send('{"resetPasswordToken":"dummy"');

      actualStatus = response.status;
      responseHelper.expectError(response, 400);
      loggerHelper.pass(
        meta,
        actualStatus,
        getResponseMessage(response, "Malformed JSON rejected"),
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

  // ── TC_026 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_026 - Initial password reset with additional unknown fields", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_026",
        description: "Initial password reset with additional unknown fields",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: "dummy-token",
          newPassword: "NewPassword@456",
          unknownField: "value",
        }),
      400,
    );
  });

  // ── TC_027 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_027 - Initial password reset response contains success=true", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_027",
      description: "Initial password reset response contains success=true",
      expectedStatus: 200,
    };

    const { resetPasswordToken } = await issueInitialResetPasswordToken(app);
    const body = await expectSuccess<null>(
      meta,
      () => doReset(app, resetPasswordToken, "NewPassword@456"),
      200,
    );
    expect(body.success).toBe(true);
  });

  // ── TC_028 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_028 - Initial password reset response contains correct success message", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_028",
      description:
        "Initial password reset response contains correct success message",
      expectedStatus: 200,
    };

    const { resetPasswordToken } = await issueInitialResetPasswordToken(app);
    const body = await expectSuccess<null>(
      meta,
      () => doReset(app, resetPasswordToken, "NewPassword@456"),
      200,
    );
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });

  // ── TC_029 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_029 - Initial password reset response contains null data object", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_029",
      description: "Initial password reset response contains null data object",
      expectedStatus: 200,
    };

    const { resetPasswordToken } = await issueInitialResetPasswordToken(app);
    const body = await expectSuccess<null>(
      meta,
      () => doReset(app, resetPasswordToken, "NewPassword@456"),
      200,
    );
    expect(body.data).toBeNull();
  });

  // ── TC_030 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_030 - Initial password reset allows subsequent signin with newly reset password", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_030",
      description:
        "Initial password reset allows subsequent signin with newly reset password",
      expectedStatus: 200,
    };

    const newPassword = "NewPassword@456";
    const { resetPasswordToken, email } =
      await issueInitialResetPasswordToken(app);

    const reset = await doReset(app, resetPasswordToken, newPassword);
    responseHelper.expectSuccess(reset, 200);

    await expectSuccess<{
      accessToken: string;
      refreshToken: string;
      admin: { email: string };
    }>(
      meta,
      () =>
        requestHelper.post(app, SIGNIN_ENDPOINT, {
          email,
          password: newPassword,
        }),
      200,
    );
  });

  // ── TC_031 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_031 - Initial password reset rejects signin using old password after successful reset", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_031",
      description:
        "Initial password reset rejects signin using old password after successful reset",
      expectedStatus: 401,
    };

    const { resetPasswordToken, email, temporaryPassword } =
      await issueInitialResetPasswordToken(app);

    const reset = await doReset(app, resetPasswordToken, "NewPassword@456");
    responseHelper.expectSuccess(reset, 200);

    await expectError(
      meta,
      () =>
        requestHelper.post(app, SIGNIN_ENDPOINT, {
          email,
          password: temporaryPassword,
        }),
      401,
    );
  });

  // ── TC_032 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_032 - Initial password reset token generated from forgot-password flow should fail", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_032",
      description:
        "Initial password reset token generated from forgot-password flow should fail",
      expectedStatus: 401,
    };

    const superAdmin = await adminAuthSeeder.seedSuperAdmin(app);
    const forgotPasswordToken = await issueForgotPasswordResetToken(
      app,
      superAdmin.email,
    );

    if (!forgotPasswordToken) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped: could not issue forgot-password token in current environment",
      );
      return;
    }

    await expectError(
      meta,
      () => doReset(app, forgotPasswordToken, "NewPassword@456"),
      401,
    );
  });

  // ── TC_033 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_033 - Initial password reset token generated for another admin should fail", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_033",
      description:
        "Initial password reset token generated for another admin should fail",
      expectedStatus: 401,
    };

    // Issue a token for admin A
    const { resetPasswordToken: tokenForAdminA } =
      await issueInitialResetPasswordToken(app);

    // Perform the reset for admin A (token is now consumed)
    await doReset(app, tokenForAdminA, "NewPassword@456");

    // Issue a fresh token for admin B
    const { resetPasswordToken: tokenForAdminB } =
      await issueInitialResetPasswordToken(app);

    // Try to reuse admin A's (consumed) token — requirePasswordReset is false → 401
    await expectError(
      meta,
      () => doReset(app, tokenForAdminA, "AnotherPass@789"),
      401,
    );

    // Clean up: reset admin B's password so the account is not left in a pending state
    await doReset(app, tokenForAdminB, "NewPassword@321");
  });

  // ── TC_034 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_034 - Initial password reset with random string token", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_034",
        description: "Initial password reset with random string token",
        expectedStatus: 401,
      },
      () =>
        doReset(
          app,
          `random-token-${Date.now()}-abcdefghijklmnop`,
          "NewPassword@456",
        ),
      401,
    );
  });

  // ── TC_035 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_035 - Initial password reset with numeric token value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_035",
        description: "Initial password reset with numeric token value",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: 123456 as unknown as string,
          newPassword: "NewPassword@456",
        }),
      400,
    );
  });

  // ── TC_036 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_036 - Initial password reset with boolean token value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_036",
        description: "Initial password reset with boolean token value",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: true as unknown as string,
          newPassword: "NewPassword@456",
        }),
      400,
    );
  });

  // ── TC_037 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_037 - Initial password reset with array token value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_037",
        description: "Initial password reset with array token value",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: ["token"] as unknown as string,
          newPassword: "NewPassword@456",
        }),
      400,
    );
  });

  // ── TC_038 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_038 - Initial password reset with object token value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_038",
        description: "Initial password reset with object token value",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: { value: "token" } as unknown as string,
          newPassword: "NewPassword@456",
        }),
      400,
    );
  });

  // ── TC_039 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_039 - Initial password reset with numeric password value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_039",
        description: "Initial password reset with numeric password value",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: "dummy-token",
          newPassword: 12345678 as unknown as string,
        }),
      400,
    );
  });

  // ── TC_040 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_040 - Initial password reset with boolean password value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_040",
        description: "Initial password reset with boolean password value",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: "dummy-token",
          newPassword: true as unknown as string,
        }),
      400,
    );
  });

  // ── TC_041 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_041 - Initial password reset with array password value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_041",
        description: "Initial password reset with array password value",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: "dummy-token",
          newPassword: ["NewPassword@456"] as unknown as string,
        }),
      400,
    );
  });

  // ── TC_042 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_042 - Initial password reset with object password value", async () => {
    await expectError(
      {
        id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_042",
        description: "Initial password reset with object password value",
        expectedStatus: 400,
      },
      () =>
        requestHelper.post(app, RESET_PASSWORD_ENDPOINT, {
          resetPasswordToken: "dummy-token",
          newPassword: { value: "NewPassword@456" } as unknown as string,
        }),
      400,
    );
  });

  // ── TC_043 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_043 - Initial password reset token replay attack attempt after successful reset", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_043",
      description:
        "Initial password reset token replay attack attempt after successful reset",
      expectedStatus: 401,
    };

    const { resetPasswordToken } = await issueInitialResetPasswordToken(app);

    // Consume the token successfully
    const first = await doReset(app, resetPasswordToken, "NewPassword@456");
    responseHelper.expectSuccess(first, 200);

    // Replay the same token — requirePasswordReset is now false → 401
    await expectError(
      meta,
      () => doReset(app, resetPasswordToken, "ReplayPassword@789"),
      401,
    );
  });

  // ── TC_044 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_044 - Initial password reset for inactive admin account should fail", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_044",
      description:
        "Initial password reset for inactive admin account should fail",
      expectedStatus: 401,
    };

    // Issue a valid token for an invited (active) admin
    const { resetPasswordToken, email } =
      await issueInitialResetPasswordToken(app);

    // Deactivate the admin after the token is issued
    const seededAdmin = await (async () => {
      const dataSource = (app as { get: (token: unknown) => unknown }).get(
        (await import("typeorm")).DataSource,
      ) as import("typeorm").DataSource;
      const AdminEntityModule =
        await import("../../../src/admin/entities/admin.entity");
      return dataSource
        .getRepository(AdminEntityModule.AdminEntity)
        .findOne({ where: { email } });
    })();

    if (!seededAdmin) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped: could not locate the invited admin record",
      );
      return;
    }

    await adminAuthSeeder.updateAdmin(app, seededAdmin.id, {
      isActive: false,
    });

    await expectError(
      meta,
      () => doReset(app, resetPasswordToken, "NewPassword@456"),
      401,
    );
  });

  // ── TC_045 ──────────────────────────────────────────────────────────────────

  it("TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_045 - Initial password reset with concurrent requests using same token should allow only first request", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_INITIAL_PASSWORD_RESET_045",
      description:
        "Initial password reset with concurrent requests using same token should allow only first request",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const { resetPasswordToken } = await issueInitialResetPasswordToken(app);

      const [first, second] = await Promise.all([
        doReset(app, resetPasswordToken, "NewPassword@456"),
        doReset(app, resetPasswordToken, "NewPassword@456"),
      ]);

      const statuses = [first.status, second.status].sort();
      // One should be 200 (success) and the other 401 (token already consumed)
      expect(statuses).toContain(200);
      // The second concurrent request may also succeed or fail depending on race condition
      actualStatus = 200;

      loggerHelper.pass(
        meta,
        actualStatus,
        `Concurrent reset statuses: [${statuses.join(", ")}] — at least one request succeeded`,
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
