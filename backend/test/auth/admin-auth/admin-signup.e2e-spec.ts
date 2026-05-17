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
import { createTestApp } from "../../setup/test-app";
import { loggerHelper } from "../../helpers/logger.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { adminFactory } from "../../factories/admin.factory";
import { seedGlobalTestData } from "../../seeders/global/global-test-data.seeder";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";

const SIGNUP_ENDPOINT = "/api/v1/auth/admin/signup";
const hundredChars = "A".repeat(100);

describe("Admin Signup API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Admin Signup API");
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

  const expectSignupSuccess = async (
    meta: TestCaseMeta,
    payload: Record<string, unknown>,
    expectedEmail?: string,
  ) => {
    let actualStatus = 0;
    try {
      const response = await requestHelper.post(app, SIGNUP_ENDPOINT, payload);
      actualStatus = response.status;

      const body = responseHelper.expectSuccess<{
        id: number;
        email: string;
        role: string;
      }>(response, 201);

      expect(body.data.id).toBeDefined();
      expect(body.data.role).toBe("SUPER_ADMIN");
      if (expectedEmail) {
        expect(body.data.email).toBe(expectedEmail);
      }

      loggerHelper.pass(meta, actualStatus, body.message);
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  };

  const expectSignupValidationError = async (
    meta: TestCaseMeta,
    payload: Record<string, unknown>,
  ) => {
    let actualStatus = 0;
    try {
      const response = await requestHelper.post(app, SIGNUP_ENDPOINT, payload);
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
  };

  it("TC_AUTH_ADMIN_SIGNUP_001 - should signup successfully", async () => {
    const payload = adminFactory.buildAdminSignupPayload();
    await expectSignupSuccess(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_001",
        description: "Admin signup success",
        expectedStatus: 201,
      },
      payload,
      payload.email,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_002 - should fail on duplicate admin email", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNUP_002",
      description: "Duplicate admin email",
      expectedStatus: 409,
    };

    let actualStatus = 0;
    const payload = adminFactory.buildAdminSignupPayload();
    await requestHelper.post(app, SIGNUP_ENDPOINT, payload);

    try {
      const response = await requestHelper.post(app, SIGNUP_ENDPOINT, payload);
      actualStatus = response.status;

      responseHelper.expectError(response, 409, "Admin already exists");
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

  it("TC_AUTH_ADMIN_SIGNUP_003 - should fail on invalid email format", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_003",
        description: "Invalid email format",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ email: "invalid-email" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_004 - should fail on password shorter than 8 characters", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_004",
        description: "Password shorter than 8 characters",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ password: "Aa1@abc" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_005 - should fail on password without uppercase letter", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_005",
        description: "Password without uppercase letter",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ password: "password@123" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_006 - should fail on password without lowercase letter", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_006",
        description: "Password without lowercase letter",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ password: "PASSWORD@123" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_007 - should fail on password without numeric character", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_007",
        description: "Password without numeric character",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ password: "Password@abc" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_008 - should fail on password without special character", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_008",
        description: "Password without special character",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ password: "Password123" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_009 - should fail when firstName is missing", async () => {
    const payload = adminFactory.buildAdminSignupPayload();
    const { firstName: _firstName, ...withoutFirstName } = payload;
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_009",
        description: "Missing firstName field",
        expectedStatus: 400,
      },
      withoutFirstName,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_010 - should fail when lastName is missing", async () => {
    const payload = adminFactory.buildAdminSignupPayload();
    const { lastName: _lastName, ...withoutLastName } = payload;
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_010",
        description: "Missing lastName field",
        expectedStatus: 400,
      },
      withoutLastName,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_011 - should fail when email is missing", async () => {
    const payload = adminFactory.buildAdminSignupPayload();
    const { email: _email, ...withoutEmail } = payload;
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_011",
        description: "Missing email field",
        expectedStatus: 400,
      },
      withoutEmail,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_012 - should fail when password is missing", async () => {
    const payload = adminFactory.buildAdminSignupPayload();
    const { password: _password, ...withoutPassword } = payload;
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_012",
        description: "Missing password field",
        expectedStatus: 400,
      },
      withoutPassword,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_013 - should fail when firstName is shorter than minimum length", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_013",
        description: "firstName shorter than minimum length",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ firstName: "A" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_014 - should fail when lastName is shorter than minimum length", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_014",
        description: "lastName shorter than minimum length",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ lastName: "B" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_015 - should fail when firstName exceeds maximum length", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_015",
        description: "firstName exceeds maximum length",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ firstName: "A".repeat(101) }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_016 - should fail when lastName exceeds maximum length", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_016",
        description: "lastName exceeds maximum length",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ lastName: "B".repeat(101) }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_017 - should normalize email to lowercase", async () => {
    const payload = adminFactory.buildAdminSignupPayload({
      email: "UPPER.CASE@FLYVOID.TEST",
    });
    await expectSignupSuccess(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_017",
        description: "Email automatically normalized to lowercase",
        expectedStatus: 201,
      },
      payload,
      "upper.case@flyvoid.test",
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_018 - should signup with leading and trailing spaces in email", async () => {
    const payload = adminFactory.buildAdminSignupPayload({
      email: "  spaced.email@flyvoid.test  ",
    });
    await expectSignupSuccess(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_018",
        description: "Signup with leading/trailing spaces in email",
        expectedStatus: 201,
      },
      payload,
      "spaced.email@flyvoid.test",
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_019 - should fail on empty firstName", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_019",
        description: "Signup with empty firstName string",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ firstName: "" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_020 - should fail on empty lastName", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_020",
        description: "Signup with empty lastName string",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ lastName: "" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_021 - should fail on empty email", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_021",
        description: "Signup with empty email string",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ email: "" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_022 - should fail on empty password", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_022",
        description: "Signup with empty password string",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ password: "" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_023 - should fail on null firstName", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_023",
        description: "Signup with null firstName",
        expectedStatus: 400,
      },
      {
        ...adminFactory.buildAdminSignupPayload(),
        firstName: null,
      } as unknown as Record<string, unknown>,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_024 - should fail on null lastName", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_024",
        description: "Signup with null lastName",
        expectedStatus: 400,
      },
      {
        ...adminFactory.buildAdminSignupPayload(),
        lastName: null,
      } as unknown as Record<string, unknown>,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_025 - should fail on null email", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_025",
        description: "Signup with null email",
        expectedStatus: 400,
      },
      {
        ...adminFactory.buildAdminSignupPayload(),
        email: null,
      } as unknown as Record<string, unknown>,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_026 - should fail on null password", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_026",
        description: "Signup with null password",
        expectedStatus: 400,
      },
      {
        ...adminFactory.buildAdminSignupPayload(),
        password: null,
      } as unknown as Record<string, unknown>,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_027 - should fail when firstName is numeric", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_027",
        description: "Signup with numeric firstName",
        expectedStatus: 400,
      },
      {
        ...adminFactory.buildAdminSignupPayload(),
        firstName: 12345,
      } as unknown as Record<string, unknown>,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_028 - should fail when lastName is numeric", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_028",
        description: "Signup with numeric lastName",
        expectedStatus: 400,
      },
      {
        ...adminFactory.buildAdminSignupPayload(),
        lastName: 67890,
      } as unknown as Record<string, unknown>,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_029 - should fail when firstName has special characters only", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_029",
        description: "Signup with special characters only in firstName",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ firstName: "@@" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_030 - should fail when lastName has special characters only", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_030",
        description: "Signup with special characters only in lastName",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({ lastName: "$$" }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_031 - should fail with multiple validation errors", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_031",
        description: "Signup with multiple validation errors",
        expectedStatus: 400,
      },
      {
        firstName: "",
        lastName: "",
        email: "bad-email",
        password: "weak",
      },
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_032 - should fail on duplicate email with different letter case", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNUP_032",
      description:
        "Signup with already existing email in different letter case",
      expectedStatus: 409,
    };

    let actualStatus = 0;
    const payload = adminFactory.buildAdminSignupPayload({
      email: "Case.Duplicate@flyvoid.test",
    });
    await requestHelper.post(app, SIGNUP_ENDPOINT, payload);

    try {
      const response = await requestHelper.post(app, SIGNUP_ENDPOINT, {
        ...payload,
        email: "case.duplicate@FLYVOID.TEST",
      });
      actualStatus = response.status;

      responseHelper.expectError(response, 409, "Admin already exists");
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

  it("TC_AUTH_ADMIN_SIGNUP_033 - should signup with boundary firstName length of 2", async () => {
    const payload = adminFactory.buildAdminSignupPayload({ firstName: "Ab" });
    await expectSignupSuccess(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_033",
        description: "Signup with valid boundary firstName length (2 chars)",
        expectedStatus: 201,
      },
      payload,
      payload.email,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_034 - should signup with boundary lastName length of 2", async () => {
    const payload = adminFactory.buildAdminSignupPayload({ lastName: "Cd" });
    await expectSignupSuccess(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_034",
        description: "Signup with valid boundary lastName length (2 chars)",
        expectedStatus: 201,
      },
      payload,
      payload.email,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_035 - should signup with boundary password length of 8", async () => {
    const payload = adminFactory.buildAdminSignupPayload({
      password: "Aa1@aaaa",
    });
    await expectSignupSuccess(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_035",
        description: "Signup with valid boundary password length (8 chars)",
        expectedStatus: 201,
      },
      payload,
      payload.email,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_036 - should signup with maximum firstName length of 100", async () => {
    const payload = adminFactory.buildAdminSignupPayload({
      firstName: hundredChars,
    });
    await expectSignupSuccess(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_036",
        description: "Signup with valid maximum firstName length (100 chars)",
        expectedStatus: 201,
      },
      payload,
      payload.email,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_037 - should signup with maximum lastName length of 100", async () => {
    const payload = adminFactory.buildAdminSignupPayload({
      lastName: hundredChars,
    });
    await expectSignupSuccess(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_037",
        description: "Signup with valid maximum lastName length (100 chars)",
        expectedStatus: 201,
      },
      payload,
      payload.email,
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_038 - should fail when request has additional unknown fields", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_038",
        description: "Signup request with additional unknown fields",
        expectedStatus: 400,
      },
      {
        ...adminFactory.buildAdminSignupPayload(),
        unknownField: "should-not-be-accepted",
      },
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_039 - should fail on malformed JSON payload", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_SIGNUP_039",
      description: "Signup with malformed JSON payload",
      expectedStatus: 400,
    };

    let actualStatus = 0;
    try {
      const response = await request(app.getHttpServer())
        .post(SIGNUP_ENDPOINT)
        .set("x-request-id", "e2e-request")
        .set("content-type", "application/json")
        .send('{"firstName":"Admin"');

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

  it("TC_AUTH_ADMIN_SIGNUP_040 - should fail on SQL injection attempt in email field", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_040",
        description: "Signup with SQL injection attempt in email field",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({
        email: "admin@example.com' OR '1'='1",
      }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_041 - should fail on script injection attempt in firstName", async () => {
    await expectSignupValidationError(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_041",
        description: "Signup with script injection attempt in firstName",
        expectedStatus: 400,
      },
      adminFactory.buildAdminSignupPayload({
        firstName: "<script>alert('x')</script>",
      }),
    );
  });

  it("TC_AUTH_ADMIN_SIGNUP_042 - should signup with unicode characters in firstName and lastName", async () => {
    const payload = adminFactory.buildAdminSignupPayload({
      firstName: "Jos\u00E9",
      lastName: "Mu\u00F1oz",
    });
    await expectSignupSuccess(
      {
        id: "TC_AUTH_ADMIN_SIGNUP_042",
        description: "Signup with Unicode characters in firstName and lastName",
        expectedStatus: 201,
      },
      payload,
      payload.email,
    );
  });
});
