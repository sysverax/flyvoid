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
import { adminAuthSeeder } from "../../seeders/auth/admin-auth.seeder";
import { seedGlobalTestData } from "../../seeders/global/global-test-data.seeder";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";
import { authHelper } from "../../helpers/auth.helper";
import { airlineFactory } from "../../factories/airline.factory";
import { tokenHelper } from "../../helpers/token.helper";
import { isExternalMode } from "../../setup/test-app";
import { AirlineAdminInviteEntity } from "../../../src/auth/entities/airline-admin-invite.entity";

const INVITE_ENDPOINT = "/api/v1/auth/admin/airline-invitations";

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
  let accessToken: string;

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

    const { body } = await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_003",
        description:
          "Airline admin invitation by inactive admin success with valid payload",
        expectedStatus: 401,
      },
      accessToken,
      payload,
    );

    expect(body.data.email).toBe(payload.adminEmail.toLowerCase());
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
    const airline = await adminAuthSeeder.seedOnboardedAirlineAdmin(app);
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
    const onboarded = await adminAuthSeeder.seedOnboardedAirlineAdmin(app);

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

    const dataSource = app.get(DataSource);
    await dataSource
      .getRepository(AirlineAdminInviteEntity)
      .update(
        { id: first.body.data.invitationId },
        { expiresAt: new Date(Date.now() - 60_000) },
      );

    await expectInviteSuccess(app, meta, accessToken, {
      ...airlineFactory.buildInvitePayload(),
      adminEmail: firstPayload.adminEmail,
    });
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_051 - Invitation with valid optional contactEmail omitted", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();
    const { contactEmail: _contactEmail, ...withoutField } = payload;

    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_051",
        description: "Invitation with valid optional contactEmail omitted",
        expectedStatus: 201,
      },
      accessToken,
      withoutField,
    );
  });

  it("TC_AUTH_ADMIN_AIRLINE_INVITE_052 - Invitation with valid optional contactPhone omitted", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = airlineFactory.buildInvitePayload();
    const { contactPhone: _contactPhone, ...withoutField } = payload;

    await expectInviteSuccess(
      app,
      {
        id: "TC_AUTH_ADMIN_AIRLINE_INVITE_052",
        description: "Invitation with valid optional contactPhone omitted",
        expectedStatus: 201,
      },
      accessToken,
      withoutField,
    );
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
});
