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
import { createTestApp } from "../../setup/test-app";
import { loggerHelper } from "../../helpers/logger.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { adminAuthSeeder } from "../../seeders/admin/admin.seeder";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";
import { authHelper } from "../../helpers/auth.helper";
import { airlineFactory } from "../../factories/airline.factory";
import { tokenHelper } from "../../helpers/token.helper";
import { isExternalMode } from "../../setup/test-app";
import { airlineSeeder } from "../../seeders/airline/airline.seeder";

const INVITE_ENDPOINT = "/api/v1/airline/invitations";

export interface AirlineInvitationResponseData {
  invitationId: number;
  airlineId: number;
  airlineName: string;
  airlineCode: string;
  companyRegistrationNumber: string;
  website?: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  currency: string;
  address: string;
  logo?: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  expiresIn: string;
  onboardingLink: string | null;
}

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

const createSuperAdminAccessToken = async (
  app: INestApplication,
): Promise<string> => {
  const seeded = await adminAuthSeeder.seedSuperAdmin(app);
  const session = await authHelper.signinAdmin(app, {
    email: seeded.email,
    password: seeded.password,
  });

  return session.accessToken;
};

const createStaffAdminAccessToken = async (
  app: INestApplication,
): Promise<string> => {
  const seeded = await adminAuthSeeder.seedStaffAdmin(app);
  const session = await authHelper.signinAdmin(app, {
    email: seeded.email,
    password: seeded.password,
  });

  return session.accessToken;
};

const createInactiveSuperAdminAccessToken = async (
  app: INestApplication,
): Promise<string> => {
  const seededAdmin = await adminAuthSeeder.seedSuperAdmin(app);
  const session = await authHelper.signinAdmin(app, {
    email: seededAdmin.email,
    password: seededAdmin.password,
  });

  await adminAuthSeeder.updateAdmin(app, seededAdmin.id, { isActive: false });
  return session.accessToken;
};

const inviteAirline = async (
  app: INestApplication,
  accessToken: string,
  payload?: Record<string, unknown>,
) => {
  const invitePayload =
    payload ?? (airlineFactory.buildInvitePayload() as Record<string, unknown>);

  const response = await requestHelper.authorizedPost(
    app,
    INVITE_ENDPOINT,
    invitePayload,
    accessToken,
  );

  return { response, payload: invitePayload };
};

const expectInviteError = async (
  app: INestApplication,
  meta: TestCaseMeta,
  accessToken: string,
  payload: Record<string, unknown>,
  expectedStatus: number,
) => {
  let actualStatus = 0;
  try {
    const { response } = await inviteAirline(app, accessToken, payload);
    actualStatus = response.status;
    responseHelper.expectError(response, expectedStatus);

    loggerHelper.pass(
      meta,
      actualStatus,
      getResponseMessage(response, "Expected error received"),
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

const expectInviteSuccess = async (
  app: INestApplication,
  meta: TestCaseMeta,
  accessToken: string,
  payload?: Record<string, unknown>,
) => {
  let actualStatus = 0;
  try {
    const { response } = await inviteAirline(app, accessToken, payload);
    actualStatus = response.status;

    const body = responseHelper.expectSuccess<{
      invitationId: number;
      airlineId: number;
      email: string;
      onboardingLink: string | null;
      expiresIn: string;
    }>(response, 201);

    loggerHelper.pass(meta, actualStatus, body.message);
    return { response, body };
  } catch (error) {
    loggerHelper.fail(
      meta,
      actualStatus,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
};

describe("Admin Airline Invitation API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Admin Airline Invitation API");
  });

  beforeEach(async () => {
    // await seedGlobalTestData(app);
    // accessToken = await createSuperAdminAccessToken(app);
  });

  afterEach(async () => {
    // await seedGlobalTestData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_001 - Airline admin invitation by SuperAdmin success with valid payload", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_001",
        description:
          "Airline admin invitation by SuperAdmin success with valid payload",
        expectedStatus: 201,
      },
      accessToken,
      payload,
    );

    expect(body.data.email).toBe(payload.adminEmail.toLowerCase());
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_002 - Airline admin invitation by Staff admin success with valid payload", async () => {
    const accessToken = await createStaffAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_002",
        description:
          "Airline admin invitation by Staff admin success with valid payload",
        expectedStatus: 201,
      },
      accessToken,
      payload,
    );

    expect(body.data.email).toBe(payload.adminEmail.toLowerCase());
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_003 - Airline admin invitation by inactive admin success with valid payload", async () => {
    const accessToken = await createInactiveSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_003",
        description:
          "Airline admin invitation by inactive admin should fail with valid payload",
        expectedStatus: 403,
      },
      accessToken,
      payload,
      403,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_004 - Invitation without access token", async () => {
    const response = await requestHelper.post(
      app,
      INVITE_ENDPOINT,
      airlineFactory.buildInvitePayload(),
    );

    responseHelper.expectError(response, 401);
    loggerHelper.pass(
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_004",
        description: "Invitation without access token",
        expectedStatus: 401,
      },
      response.status,
      getResponseMessage(response, "Unauthorized"),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_005 - Invitation with invalid access token", async () => {
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_005",
        description: "Invitation with invalid access token",
        expectedStatus: 401,
      },
      tokenHelper.invalid(),
      airlineFactory.buildInvitePayload(),
      401,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_006 - Invitation with expired access token", async () => {
    const expired = await tokenHelper.expiredAdminAccess();

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_006",
        description: "Invitation with expired access token",
        expectedStatus: 401,
      },
      expired,
      airlineFactory.buildInvitePayload(),
      401,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_007 - Invitation by unauthorized role user", async () => {
    const airline = await airlineSeeder.seedOnboardedAirlineAdmin(app);
    const airlineSession = await authHelper.signinAirline(app, {
      email: airline.email,
      password: airline.password,
    });

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_007",
        description: "Invitation by unauthorized role user",
        expectedStatus: 403,
      },
      airlineSession.accessToken,
      airlineFactory.buildInvitePayload(),
      403,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_008 - Duplicate airline code", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();

    const first = await inviteAirline(app, accessToken, payload);
    responseHelper.expectSuccess(first.response, 201);

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_008",
        description: "Duplicate airline code",
        expectedStatus: 409,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        airlineCode: payload.airlineCode,
      },
      409,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_009 - Duplicate admin email", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const onboarded = await airlineSeeder.seedOnboardedAirlineAdmin(app);

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_009",
        description: "Duplicate admin email",
        expectedStatus: 409,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ adminEmail: onboarded.email }),
      409,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_010 - Active invitation already exists for admin email", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();
    const first = await inviteAirline(app, accessToken, payload);
    responseHelper.expectSuccess(first.response, 201);

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_010",
        description: "Active invitation already exists for admin email",
        expectedStatus: 409,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        adminEmail: payload.adminEmail,
      },
      409,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_011 - Missing airlineName field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();
    const { airlineName: _airlineName, ...withoutField } = payload;

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_011",
        description: "Missing airlineName field",
        expectedStatus: 400,
      },
      accessToken,
      withoutField,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_012 - Missing airlineCode field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();
    const { airlineCode: _airlineCode, ...withoutField } = payload;

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_012",
        description: "Missing airlineCode field",
        expectedStatus: 400,
      },
      accessToken,
      withoutField,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_013 - Missing countryCode field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();
    const { countryCode: _countryCode, ...withoutField } = payload;

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_013",
        description: "Missing countryCode field",
        expectedStatus: 400,
      },
      accessToken,
      withoutField,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_014 - Missing adminFirstName field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();
    const { adminFirstName: _adminFirstName, ...withoutField } = payload;

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_014",
        description: "Missing adminFirstName field",
        expectedStatus: 400,
      },
      accessToken,
      withoutField,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_015 - Missing adminLastName field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();
    const { adminLastName: _adminLastName, ...withoutField } = payload;

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_015",
        description: "Missing adminLastName field",
        expectedStatus: 400,
      },
      accessToken,
      withoutField,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_016 - Missing adminEmail field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();
    const { adminEmail: _adminEmail, ...withoutField } = payload;

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_016",
        description: "Missing adminEmail field",
        expectedStatus: 400,
      },
      accessToken,
      withoutField,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_017 - Invalid adminEmail format", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_017",
        description: "Invalid adminEmail format",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ adminEmail: "invalid-email" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_018 - Invalid contactEmail format", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_018",
        description: "Invalid contactEmail format",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ contactEmail: "bad-email" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_019 - Invalid contactPhone format", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_019",
        description: "Invalid contactPhone format",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ contactPhone: "abc-123-phone" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_020 - Empty airlineName value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_020",
        description: "Empty airlineName value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ airlineName: "" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_021 - Empty airlineCode value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_021",
        description: "Empty airlineCode value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ airlineCode: "" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_022 - Empty countryCode value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_022",
        description: "Empty countryCode value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ countryCode: "" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_023 - Empty adminFirstName value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_023",
        description: "Empty adminFirstName value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ adminFirstName: "" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_024 - Empty adminLastName value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_024",
        description: "Empty adminLastName value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ adminLastName: "" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_025 - Empty adminEmail value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_025",
        description: "Empty adminEmail value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ adminEmail: "" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_026 - Null airlineName value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_026",
        description: "Null airlineName value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        airlineName: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_027 - Null airlineCode value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_027",
        description: "Null airlineCode value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        airlineCode: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_028 - Null countryCode value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_028",
        description: "Null countryCode value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        countryCode: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_029 - Null adminFirstName value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_029",
        description: "Null adminFirstName value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        adminFirstName: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_030 - Null adminLastName value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_030",
        description: "Null adminLastName value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        adminLastName: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_031 - Null adminEmail value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_031",
        description: "Null adminEmail value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        adminEmail: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_032 - Invalid countryCode format", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_032",
        description: "Invalid countryCode format",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ countryCode: "IND" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_033 - Lowercase countryCode normalization handling", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_033",
        description: "Lowercase countryCode normalization handling",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ countryCode: "in" }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_034 - Lowercase airlineCode normalization handling", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_034",
        description: "Lowercase airlineCode normalization handling",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ airlineCode: "e2ecode12" }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_035 - Airline code exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_035",
        description: "Airline code exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ airlineCode: "A".repeat(21) }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_036 - Airline name exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_036",
        description: "Airline name exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ airlineName: "A".repeat(151) }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_037 - Admin first name exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_037",
        description: "Admin first name exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ adminFirstName: "A".repeat(101) }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_038 - Admin last name exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_038",
        description: "Admin last name exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ adminLastName: "B".repeat(101) }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_039 - Invitation response contains invitationId", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_039",
        description: "Invitation response contains invitationId",
        expectedStatus: 201,
      },
      accessToken,
    );
    expect(body.data.invitationId).toBeDefined();
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_040 - Invitation response contains airlineId", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_040",
        description: "Invitation response contains airlineId",
        expectedStatus: 201,
      },
      accessToken,
    );
    expect(body.data.airlineId).toBeDefined();
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_041 - Invitation response contains onboardingLink", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_041",
        description: "Invitation response contains onboardingLink",
        expectedStatus: 201,
      },
      accessToken,
    );
    expect(
      typeof body.data.onboardingLink === "string" ||
        body.data.onboardingLink === null,
    ).toBe(true);
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_042 - Invitation response contains expiresIn", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_042",
        description: "Invitation response contains expiresIn",
        expectedStatus: 201,
      },
      accessToken,
    );
    expect(typeof body.data.expiresIn).toBe("string");
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_043 - Invitation response contains invited admin email", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload({
      adminEmail: "Mixed.Email@Flyvoid-Airline.Test",
    });

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_043",
        description: "Invitation response contains invited admin email",
        expectedStatus: 201,
      },
      accessToken,
      payload,
    );
    expect(body.data.email).toBe("mixed.email@flyvoid-airline.test");
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_044 - Invitation onboardingLink contains valid token parameter", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_044",
        description: "Invitation onboardingLink contains valid token parameter",
        expectedStatus: 201,
      },
      accessToken,
    );

    if (body.data.onboardingLink) {
      const token = new URL(body.data.onboardingLink).searchParams.get("token");
      expect(token).toBeTruthy();
      expect((token ?? "").length).toBeGreaterThan(10);
    } else {
      expect(body.data.onboardingLink).toBeNull();
    }
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_045 - Invitation request with malformed JSON payload", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_AIRLINE_INVITE_045",
      description: "Invitation request with malformed JSON payload",
      expectedStatus: 400,
    };

    const accessToken = await createSuperAdminAccessToken(app);
    let actualStatus = 0;
    try {
      const response = await request(app.getHttpServer())
        .post(INVITE_ENDPOINT)
        .set("x-request-id", "e2e-request")
        .set("content-type", "application/json")
        .set("authorization", `Bearer ${accessToken}`)
        .send('{"airlineName":"BadJson"');

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

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_046 - Invitation request with additional unknown fields", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_046",
        description: "Invitation request with additional unknown fields",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        unknownField: "not-allowed",
      },
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_047 - SQL injection attempt in airlineCode field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_047",
        description: "SQL injection attempt in airlineCode field",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ airlineCode: "AA' OR '1'='1" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_048 - Script injection attempt in airlineName field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_048",
        description: "Script injection attempt in airlineName field",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        airlineName: "<script>alert(1)</script>",
      }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_049 - Invitation with Unicode airline name", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_049",
        description: "Invitation with Unicode airline name",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        airlineName: "Aerolinea Jose Munoz",
      }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_050 - Re-invite after previous invite expiration", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AUTH_ADMIN_AIRLINE_INVITE_050",
      description: "Re-invite after previous invite expiration",
      expectedStatus: 201,
    };

    if (isExternalMode()) {
      loggerHelper.pass(
        meta,
        200,
        "Skipped in external mode (invite expiry mutation requires in-process DB access)",
      );
      return;
    }

    const accessToken = await createSuperAdminAccessToken(app);
    const firstPayload = airlineFactory.buildInvitePayload();
    const first = await expectInviteSuccess(
      app,
      meta,
      accessToken,
      firstPayload,
    );

    await airlineSeeder.updateAirlineInvitationExpiresAt(
      app,
      first.body.data.invitationId,
      new Date(Date.now() - 60_000),
    );

    await expectInviteSuccess(app, meta, accessToken, {
      ...airlineFactory.buildInvitePayload(),
      adminEmail: firstPayload.adminEmail,
    });
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_053 - Invitation with whitespace-only required fields", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_053",
        description: "Invitation with whitespace-only required fields",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        airlineName: "   ",
        airlineCode: "   ",
        countryCode: "   ",
        adminFirstName: "   ",
        adminLastName: "   ",
        adminEmail: "   ",
      },
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_054 - Invitation with mixed-case admin email normalization", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload({
      adminEmail: "MiXeD.CaSe@Flyvoid-Airline.Test",
    });

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_054",
        description: "Invitation with mixed-case admin email normalization",
        expectedStatus: 201,
      },
      accessToken,
      payload,
    );

    expect(body.data.email).toBe("mixed.case@flyvoid-airline.test");
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_055 - Invitation with already existing airline contact email", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const sharedContactEmail = "shared.ops@flyvoid-airline.test";

    const first = await inviteAirline(
      app,
      accessToken,
      airlineFactory.buildInvitePayload({ contactEmail: sharedContactEmail }),
    );
    responseHelper.expectSuccess(first.response, 201);

    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_055",
        description: "Invitation with already existing airline contact email",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ contactEmail: sharedContactEmail }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_056 - Invitation with valid companyRegistrationNumber", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_056",
        description: "Invitation with valid companyRegistrationNumber",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        companyRegistrationNumber: "CRN-2026-0001",
      }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_057 - Invitation with valid website URL", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_057",
        description: "Invitation with valid website URL",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        website: "https://www.flyvoid-airline.test",
      }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_058 - Invitation with invalid website URL format", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_058",
        description: "Invitation with invalid website URL format",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ website: "not-a-url" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_059 - Invitation with valid timezone value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_059",
        description: "Invitation with valid timezone value",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ timezone: "Asia/Dubai" }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_060 - Invitation with invalid timezone value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_060",
        description: "Invitation with invalid timezone value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ timezone: "Invalid Timezone" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_061 - Invitation with valid logo URL", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_061",
        description: "Invitation with valid logo URL",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        logo: "https://cdn.flyvoid-airline.test/brand/logo.png",
      }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_062 - Invitation with invalid logo URL format", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_062",
        description: "Invitation with invalid logo URL format",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ logo: "bad-logo-url" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_063 - Invitation with valid address field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_063",
        description: "Invitation with valid address field",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        address: "Terminal 3, Dubai International Airport",
      }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_064 - Invitation with empty address field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_064",
        description: "Invitation with empty address field",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ address: "" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_065 - Invitation with valid currency code", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_065",
        description: "Invitation with valid currency code",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ currency: "AED" }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_066 - Invitation with invalid currency code format", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_066",
        description: "Invitation with invalid currency code format",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ currency: "A1" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_067 - Invitation with lowercase currency normalization handling", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_067",
        description:
          "Invitation with lowercase currency normalization handling",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ currency: "usd" }),
    );

    const airlineDbRecord = await airlineSeeder.findAirlineById(
      app,
      body.data.airlineId,
    );

    expect(airlineDbRecord.currency).toBe("USD");
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_068 - Invitation with valid jobTitle field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_068",
        description: "Invitation with valid jobTitle field",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ jobTitle: "Commercial Manager" }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_069 - Invitation with empty jobTitle field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_069",
        description: "Invitation with empty jobTitle field",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ jobTitle: "" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_070 - Invitation with null companyRegistrationNumber", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_070",
        description: "Invitation with null companyRegistrationNumber",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        companyRegistrationNumber: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_071 - Invitation with null website value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_071",
        description: "Invitation with null website value",
        expectedStatus: 201,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        website: null,
      } as unknown as Record<string, unknown>,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_072 - Invitation with null timezone value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_072",
        description: "Invitation with null timezone value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        timezone: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_073 - Invitation with null logo value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_073",
        description: "Invitation with null logo value",
        expectedStatus: 201,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        logo: null,
      } as unknown as Record<string, unknown>,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_074 - Invitation with null address value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_074",
        description: "Invitation with null address value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        address: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_075 - Invitation with null currency value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_075",
        description: "Invitation with null currency value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        currency: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_076 - Invitation with null jobTitle value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_076",
        description: "Invitation with null jobTitle value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...airlineFactory.buildInvitePayload(),
        jobTitle: null,
      } as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_077 - Invitation with whitespace-only companyRegistrationNumber", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_077",
        description:
          "Invitation with whitespace-only companyRegistrationNumber",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ companyRegistrationNumber: "   " }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_078 - Invitation with whitespace-only website value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_078",
        description: "Invitation with whitespace-only website value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ website: "   " }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_079 - Invitation with whitespace-only timezone value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_079",
        description: "Invitation with whitespace-only timezone value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ timezone: "   " }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_080 - Invitation with whitespace-only logo value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_080",
        description: "Invitation with whitespace-only logo value",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ logo: "   " }),
      201,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_081 - Invitation with whitespace-only address value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_081",
        description: "Invitation with whitespace-only address value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ address: "   " }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_082 - Invitation with whitespace-only currency value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_082",
        description: "Invitation with whitespace-only currency value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ currency: "   " }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_083 - Invitation with whitespace-only jobTitle value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_083",
        description: "Invitation with whitespace-only jobTitle value",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ jobTitle: "   " }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_084 - Invitation with website exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_084",
        description: "Invitation with website exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        website: `https://www.${"a".repeat(260)}.test`,
      }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_085 - Invitation with companyRegistrationNumber exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_085",
        description:
          "Invitation with companyRegistrationNumber exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        companyRegistrationNumber: "C".repeat(101),
      }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_086 - Invitation with timezone exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_086",
        description: "Invitation with timezone exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ timezone: "A".repeat(101) }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_087 - Invitation with logo URL exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_087",
        description: "Invitation with logo URL exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        logo: `https://cdn.flyvoid-airline.test/${"x".repeat(600)}.png`,
      }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_088 - Invitation with address exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_088",
        description: "Invitation with address exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ address: "A".repeat(256) }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_089 - Invitation with currency exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_089",
        description: "Invitation with currency exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ currency: "A".repeat(11) }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_090 - Invitation with jobTitle exceeding allowed length", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_090",
        description: "Invitation with jobTitle exceeding allowed length",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ jobTitle: "A".repeat(101) }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_091 - Invitation with duplicate companyRegistrationNumber", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const companyRegistrationNumber = `CRN-DUP-${Date.now()}`;

    const first = await inviteAirline(
      app,
      accessToken,
      airlineFactory.buildInvitePayload({ companyRegistrationNumber }),
    );
    responseHelper.expectSuccess(first.response, 201);

    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_091",
        description: "Invitation with duplicate companyRegistrationNumber",
        expectedStatus: 409,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ companyRegistrationNumber }),
      409,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_093 - Invitation response contains correct companyRegistrationNumber association", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload({
      companyRegistrationNumber: `CRN-ASSOC-${Date.now()}`,
    });

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_093",
        description:
          "Invitation response contains correct companyRegistrationNumber association",
        expectedStatus: 201,
      },
      accessToken,
      payload,
    );

    const airline = await airlineSeeder.findAirlineById(
      app,
      body.data.airlineId,
    );
    expect(airline?.company_registration_number).toBe(
      payload.companyRegistrationNumber,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_094 - Invitation response creates airline with correct timezone", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload({
      timezone: "America/New_York",
    });

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_094",
        description:
          "Invitation response creates airline with correct timezone",
        expectedStatus: 201,
      },
      accessToken,
      payload,
    );

    const airline = await airlineSeeder.findAirlineById(
      app,
      body.data.airlineId,
    );
    expect(airline?.timezone).toBe(payload.timezone);
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_095 - Invitation response creates airline with correct currency", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload({ currency: "eur" });

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_095",
        description:
          "Invitation response creates airline with correct currency",
        expectedStatus: 201,
      },
      accessToken,
      payload,
    );

    const airline = await airlineSeeder.findAirlineById(
      app,
      body.data.airlineId,
    );
    expect(airline?.currency).toBe("EUR");
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_096 - Invitation response stores logo URL successfully", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload({
      logo: "https://cdn.flyvoid-airline.test/new-logo.png",
    });

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_096",
        description: "Invitation response stores logo URL successfully",
        expectedStatus: 201,
      },
      accessToken,
      payload,
    );

    const airline = await airlineSeeder.findAirlineById(
      app,
      body.data.airlineId,
    );
    expect(airline?.logo).toBe(payload.logo);
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_097 - Invitation response stores address successfully", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload({
      address: "500 Sky Tower, Abu Dhabi",
    });

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_097",
        description: "Invitation response stores address successfully",
        expectedStatus: 201,
      },
      accessToken,
      payload,
    );

    const airline = await airlineSeeder.findAirlineById(
      app,
      body.data.airlineId,
    );
    expect(airline?.address).toBe(payload.address);
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_098 - Invitation response stores jobTitle successfully", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload({
      jobTitle: "Head of Airport Operations",
    });

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_098",
        description: "Invitation response stores jobTitle successfully",
        expectedStatus: 201,
      },
      accessToken,
      payload,
    );

    const invite = await airlineSeeder.findAirlineInvitationById(
      app,
      body.data.invitationId,
    );
    expect(invite?.job_title).toBe(payload.jobTitle);
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_099 - Invitation with Unicode address value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_099",
        description: "Invitation with Unicode address value",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        address: "Avenida Sao Joao, Sao Paulo, Brasil",
      }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_100 - Invitation with Unicode companyRegistrationNumber", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_100",
        description: "Invitation with Unicode companyRegistrationNumber",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        companyRegistrationNumber: "REG-ES-UNION-2026",
      }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_101 - Invitation with unsupported currency code", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_101",
        description: "Invitation with unsupported currency code",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ currency: "ZZZ" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_102 - Invitation with unsupported timezone identifier", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_102",
        description: "Invitation with unsupported timezone identifier",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ timezone: "Etc/Unknown" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_103 - Invitation with HTTP website URL instead of HTTPS", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_103",
        description: "Invitation with HTTP website URL instead of HTTPS",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        website: "http://www.flyvoid-airline.test",
      }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_104 - Invitation with HTTP logo URL instead of HTTPS", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_104",
        description: "Invitation with HTTP logo URL instead of HTTPS",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        logo: "http://cdn.flyvoid-airline.test/logo.png",
      }),
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_105 - Invitation with malformed logo URL containing script injection", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_105",
        description:
          "Invitation with malformed logo URL containing script injection",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ logo: "javascript:alert(1)" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_106 - Invitation with malformed website URL containing script injection", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectInviteError(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_106",
        description:
          "Invitation with malformed website URL containing script injection",
        expectedStatus: 400,
      },
      accessToken,
      airlineFactory.buildInvitePayload({ website: "javascript:alert(1)" }),
      400,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_107 - Invitation with optional fields omitted completely", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();
    const {
      website: _website,
      logo: _logo,
      ...withoutOptionalFields
    } = payload;

    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_107",
        description: "Invitation with optional fields omitted completely",
        expectedStatus: 201,
      },
      accessToken,
      withoutOptionalFields,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_108 - Invitation with all optional fields populated successfully", async () => {
    const accessToken = await createSuperAdminAccessToken(app);

    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_108",
        description:
          "Invitation with all optional fields populated successfully",
        expectedStatus: 201,
      },
      accessToken,
      airlineFactory.buildInvitePayload({
        website: "https://www.flyvoid-airline-rich-profile.test",
        logo: "https://cdn.flyvoid-airline.test/rich-profile-logo.png",
      }),
    );
  });
});
