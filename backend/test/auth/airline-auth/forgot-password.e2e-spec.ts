import { INestApplication } from "@nestjs/common";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  describe,
  it,
} from "@jest/globals";
import { createTestApp } from "../../setup/test-app";
import { loggerHelper } from "../../helpers/logger.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { adminAuthSeeder } from "../../seeders/auth/admin-auth.seeder";
import { seedGlobalTestData } from "../../seeders/global/global-test-data.seeder";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";

describe("Airline Forgot Password API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Airline Forgot Password API");
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

  it("TC_AUTH_AIRLINE_FORGOT_001 - should send OTP request successfully", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_FORGOT_001",
      description: "Send airline forgot-password OTP",
      expectedStatus: 200,
    };

    let actualStatus = 0;
    try {
      const seeded = await adminAuthSeeder.seedOnboardedAirlineAdmin(app);

      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/forgot-password/send-otp",
        { email: seeded.email },
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

  it("TC_AUTH_AIRLINE_FORGOT_002 - should fail verify-otp with invalid otp", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_FORGOT_002",
      description: "Verify airline OTP with invalid code",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const seeded = await adminAuthSeeder.seedOnboardedAirlineAdmin(app);

      const sendOtp = await requestHelper.post(
        app,
        "/api/v1/auth/airline/forgot-password/send-otp",
        { email: seeded.email },
      );
      responseHelper.expectSuccess(sendOtp, 200);

      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/forgot-password/verify-otp",
        {
          email: seeded.email,
          otp: "000000",
        },
      );
      actualStatus = response.status;

      responseHelper.expectError(response, 401);
      loggerHelper.pass(
        meta,
        actualStatus,
        String(response.body.message ?? "Invalid OTP as expected"),
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

  it("TC_AUTH_AIRLINE_FORGOT_003 - should fail reset with invalid token", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_AIRLINE_FORGOT_003",
      description: "Reset airline password with invalid token",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const response = await requestHelper.post(
        app,
        "/api/v1/auth/airline/forgot-password",
        {
          resetPasswordToken: "invalid-reset-token",
          newPassword: "Password@123",
        },
      );
      actualStatus = response.status;

      responseHelper.expectError(response, 401);
      loggerHelper.pass(
        meta,
        actualStatus,
        String(response.body.message ?? "Invalid token as expected"),
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
