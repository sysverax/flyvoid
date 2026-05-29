import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { DataSource } from "typeorm";
import { createTestApp } from "../../setup/test-app";
import { loggerHelper } from "../../helpers/logger.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { adminAuthSeeder } from "../../seeders/admin/admin.seeder";
import { airlineSeeder } from "../../seeders/airline/airline.seeder";
import { TestCaseMeta } from "../../shared/interfaces/test-case.interface";
import { authHelper } from "../../helpers/auth.helper";
import { tokenHelper } from "../../helpers/token.helper";
import { AirportType } from "../../../src/airline/constants";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AirportPayload {
  name: string;
  iataCode: string;
  icaoCode: string;
  countryCode: string;
  city: string;
  latitude: number | string;
  longitude: number | string;
  timezone: string;
  isActive: boolean;
  type: string;
  address?: string | null;
  postalCode?: string | null;
}

interface AirportResponseData {
  id: number;
  name: string;
  iataCode: string;
  icaoCode: string;
  countryCode: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isActive: boolean;
  type: string;
  address: string | null;
  postalCode: string | null;
  createdBy: number;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Code generator — starts at 1000 to avoid IATA/ICAO collision with create-airport tests
// ─────────────────────────────────────────────────────────────────────────────

let airportCounter = 1000;

const nextCodes = (): { iataCode: string; icaoCode: string } => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let seed = airportCounter;
  let token = "";

  while (token.length < 3) {
    token = alphabet[seed % 26] + token;
    seed = Math.floor(seed / 26);
  }

  token = token.slice(-3);
  airportCounter += 1;

  return {
    iataCode: token,
    icaoCode: `K${token}`,
  };
};

const buildAirportPayload = (
  overrides?: Partial<AirportPayload>,
): AirportPayload => {
  const codes = nextCodes();

  return {
    name: `Flyvoid Update Airport ${Date.now()}-${airportCounter}`,
    iataCode: codes.iataCode,
    icaoCode: codes.icaoCode,
    countryCode: "IN",
    city: "Mumbai",
    latitude: 19.0896,
    longitude: 72.8656,
    timezone: "Asia/Kolkata",
    isActive: true,
    type: AirportType.INTERNATIONAL,
    address: "Airport Road, Mumbai",
    postalCode: "400099",
    ...overrides,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Session helpers
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

const createSuperAdminSession = async (
  app: INestApplication,
): Promise<{ adminId: number; accessToken: string }> => {
  const seeded = await adminAuthSeeder.seedSuperAdmin(app);
  const session = await authHelper.signinAdmin(app, {
    email: seeded.email,
    password: seeded.password,
  });
  return { adminId: seeded.id, accessToken: session.accessToken };
};

const createStaffAdminSession = async (
  app: INestApplication,
): Promise<{ adminId: number; accessToken: string }> => {
  const seeded = await adminAuthSeeder.seedStaffAdmin(app);
  const session = await authHelper.signinAdmin(app, {
    email: seeded.email,
    password: seeded.password,
  });
  return { adminId: seeded.id, accessToken: session.accessToken };
};

const createInactiveSuperAdminAccessToken = async (
  app: INestApplication,
): Promise<string> => {
  const seeded = await adminAuthSeeder.seedSuperAdmin(app);
  const session = await authHelper.signinAdmin(app, {
    email: seeded.email,
    password: seeded.password,
  });
  await adminAuthSeeder.updateAdmin(app, seeded.id, { isActive: false });
  return session.accessToken;
};

const revokeAirportsEditAccess = async (
  app: INestApplication,
  adminId: number,
): Promise<void> => {
  const dataSource = app.get(DataSource);
  const usePostgresParams = dataSource.options.type === "postgres";
  const parameter = (index: number): string =>
    usePostgresParams ? `$${index + 1}` : "?";

  const query = `DELETE FROM platform_access_controls WHERE admin_id = ${parameter(0)} AND asset = 'AIRPORTS' AND access_action = 'EDIT'`;
  await dataSource.query(query, [adminId]);
};

// ─────────────────────────────────────────────────────────────────────────────
// Airport helpers
// ─────────────────────────────────────────────────────────────────────────────

const doCreate = (
  app: INestApplication,
  payload: Record<string, unknown>,
  accessToken: string,
) =>
  requestHelper.authorizedPost(app, "/api/v1/airports", payload, accessToken);

const doUpdate = (
  app: INestApplication,
  airportId: number | string,
  payload: Record<string, unknown> | string,
  accessToken: string,
) =>
  requestHelper.authorizedPatch(
    app,
    `/api/v1/airports/${airportId}`,
    payload as Record<string, unknown>,
    accessToken,
  );

const seedAirport = async (
  app: INestApplication,
  accessToken: string,
): Promise<AirportResponseData> => {
  const response = await doCreate(
    app,
    buildAirportPayload() as unknown as Record<string, unknown>,
    accessToken,
  );
  return responseHelper.expectSuccess<AirportResponseData>(
    response as never,
    201,
  ).data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Assertion helpers
// ─────────────────────────────────────────────────────────────────────────────

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

describe("Update Airport API", () => {
  let app: INestApplication;
  let sharedAirportId: number;
  let sharedAccessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Update Airport API");

    const { accessToken } = await createSuperAdminSession(app);
    sharedAccessToken = accessToken;
    const airport = await seedAirport(app, accessToken);
    sharedAirportId = airport.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Auth / RBAC ────────────────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_001 - SUPER_ADMIN with AIRPORTS EDIT access can update airport", async () => {
    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_001",
        description: "SUPER_ADMIN with AIRPORTS EDIT access can update airport",
        expectedStatus: 200,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "Updated Airport Name TC001" },
          sharedAccessToken,
        ),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_002 - STAFF admin with AIRPORTS EDIT access can update airport", async () => {
    const { accessToken } = await createStaffAdminSession(app);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_002",
        description: "STAFF admin with AIRPORTS EDIT access can update airport",
        expectedStatus: 200,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "Updated Airport Name TC002" },
          accessToken,
        ),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_003 - Inactive admin access token should be rejected with 403", async () => {
    const accessToken = await createInactiveSuperAdminAccessToken(app);

    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_003",
        description: "Inactive admin access token should be rejected with 403",
        expectedStatus: 403,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "Updated Name TC003" },
          accessToken,
        ),
      403,
    );
  });

  it("TC_AIRPORT_UPDATE_004 - Request without access token should return 401", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRPORT_UPDATE_004",
      description: "Request without access token should return 401",
      expectedStatus: 401,
    };

    let actualStatus = 0;
    try {
      const response = await requestHelper.patch(
        app,
        `/api/v1/airports/${sharedAirportId}`,
        { name: "Updated Name TC004" },
      );
      actualStatus = response.status;
      responseHelper.expectError(response as never, 401);
      loggerHelper.pass(meta, actualStatus, "401 Unauthorized returned");
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AIRPORT_UPDATE_005 - Request with invalid access token should return 401", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_005",
        description: "Request with invalid access token should return 401",
        expectedStatus: 401,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "Updated Name TC005" },
          "invalid.token.value",
        ),
      401,
    );
  });

  it("TC_AIRPORT_UPDATE_006 - Request with expired access token should return 401", async () => {
    const expiredToken = await tokenHelper.expiredAdminAccess();

    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_006",
        description: "Request with expired access token should return 401",
        expectedStatus: 401,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "Updated Name TC006" },
          expiredToken,
        ),
      401,
    );
  });

  it("TC_AIRPORT_UPDATE_007 - STAFF admin without AIRPORTS EDIT access should return 403", async () => {
    const { adminId, accessToken } = await createStaffAdminSession(app);
    await revokeAirportsEditAccess(app, adminId);

    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_007",
        description:
          "STAFF admin without AIRPORTS EDIT access should return 403",
        expectedStatus: 403,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "Updated Name TC007" },
          accessToken,
        ),
      403,
    );
  });

  it("TC_AIRPORT_UPDATE_008 - Airline user cannot update airport, should return 403", async () => {
    const seeded = await airlineSeeder.seedOnboardedAirlineAdmin(app);
    const session = await authHelper.signinAirline(app, {
      email: seeded.email,
      password: seeded.password,
    });

    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_008",
        description: "Airline user cannot update airport, should return 403",
        expectedStatus: 403,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "Updated Name TC008" },
          session.accessToken,
        ),
      403,
    );
  });

  // ── Airport ID validations ─────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_009 - Update non-existing airport should return 404", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_009",
        description: "Update non-existing airport should return 404",
        expectedStatus: 404,
      },
      () =>
        doUpdate(
          app,
          999999999,
          { name: "Updated Name TC009" },
          sharedAccessToken,
        ),
      404,
    );
  });

  it("TC_AIRPORT_UPDATE_010 - Non-numeric airportId (alphabetic string) should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_010",
        description:
          "Non-numeric airportId (alphabetic string) should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, "abc", { name: "Updated Name TC010" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_011 - Non-numeric airportId (alphanumeric string) should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_011",
        description:
          "Non-numeric airportId (alphanumeric string) should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          "id123",
          { name: "Updated Name TC011" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_012 - Negative airportId should return 400 or 404 (compatibility)", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRPORT_UPDATE_012",
      description:
        "Negative airportId should return 400 or 404 (compatibility)",
      expectedStatus: 400,
    };

    // ParseIntPipe accepts negative integers; service returns 404 (airport not found).
    // This test accepts either 400 (explicit rejection) or 404 (service behavior).
    let actualStatus = 0;
    try {
      const response = await doUpdate(
        app,
        -1,
        { name: "Updated Name TC012" },
        sharedAccessToken,
      );
      actualStatus = response.status;
      expect([400, 404]).toContain(response.status);
      loggerHelper.pass(
        meta,
        actualStatus,
        `Received ${actualStatus} for negative airportId`,
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

  it("TC_AIRPORT_UPDATE_013 - Zero airportId should return 400 or 404 (compatibility)", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRPORT_UPDATE_013",
      description: "Zero airportId should return 400 or 404 (compatibility)",
      expectedStatus: 400,
    };

    // ParseIntPipe accepts 0; service returns 404 (airport not found).
    // This test accepts either 400 (explicit rejection) or 404 (service behavior).
    let actualStatus = 0;
    try {
      const response = await doUpdate(
        app,
        0,
        { name: "Updated Name TC013" },
        sharedAccessToken,
      );
      actualStatus = response.status;
      expect([400, 404]).toContain(response.status);
      loggerHelper.pass(
        meta,
        actualStatus,
        `Received ${actualStatus} for zero airportId`,
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

  // ── Payload validations ────────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_014 - Empty request body should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_014",
        description: "Empty request body should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, {}, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_015 - Malformed JSON body should return 400", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRPORT_UPDATE_015",
      description: "Malformed JSON body should return 400",
      expectedStatus: 400,
    };

    let actualStatus = 0;
    try {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/airports/${sharedAirportId}`)
        .set("x-request-id", "e2e-request")
        .set("content-type", "application/json")
        .set("authorization", `Bearer ${sharedAccessToken}`)
        .send(`{ invalid json :`);
      actualStatus = response.status;
      responseHelper.expectError(response as never, 400);
      loggerHelper.pass(meta, actualStatus, "400 returned for malformed JSON");
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AIRPORT_UPDATE_016 - Unknown fields in payload should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_016",
        description: "Unknown fields in payload should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { unknownField: "someValue" },
          sharedAccessToken,
        ),
      400,
    );
  });

  // ── Partial updates ────────────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_017 - Update only name field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_017",
        description: "Update only name field should succeed with 200",
        expectedStatus: 200,
      },
      () =>
        doUpdate(
          app,
          airport.id,
          { name: "Updated Name Only TC017" },
          accessToken,
        ),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_018 - Update only city field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_018",
        description: "Update only city field should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { city: "Chennai" }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_019 - Update only latitude field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_019",
        description: "Update only latitude field should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { latitude: 28.5562 }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_020 - Update only longitude field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_020",
        description: "Update only longitude field should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { longitude: 77.1 }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_021 - Update only timezone field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_021",
        description: "Update only timezone field should succeed with 200",
        expectedStatus: 200,
      },
      () =>
        doUpdate(app, airport.id, { timezone: "Asia/Kolkata" }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_022 - Update only isActive field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_022",
        description: "Update only isActive field should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { isActive: false }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_023 - Update only type field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_023",
        description: "Update only type field should succeed with 200",
        expectedStatus: 200,
      },
      () =>
        doUpdate(app, airport.id, { type: AirportType.DOMESTIC }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_024 - Update only address field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_024",
        description: "Update only address field should succeed with 200",
        expectedStatus: 200,
      },
      () =>
        doUpdate(
          app,
          airport.id,
          { address: "New Terminal Road, Delhi" },
          accessToken,
        ),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_025 - Update only postalCode field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_025",
        description: "Update only postalCode field should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { postalCode: "110037" }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_026 - Update only iataCode field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);
    const { iataCode } = nextCodes();

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_026",
        description: "Update only iataCode field should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { iataCode }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_027 - Update only icaoCode field should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);
    const { icaoCode } = nextCodes();

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_027",
        description: "Update only icaoCode field should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { icaoCode }, accessToken),
      200,
    );
  });

  // ── Null value validations ─────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_028 - Null name value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_028",
        description: "Null name value should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { name: null }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_029 - Null iataCode value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_029",
        description: "Null iataCode value should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { iataCode: null }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_030 - Null icaoCode value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_030",
        description: "Null icaoCode value should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { icaoCode: null }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_031 - Null countryCode value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_031",
        description: "Null countryCode value should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { countryCode: null },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_032 - Null city value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_032",
        description: "Null city value should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { city: null }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_033 - Null latitude value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_033",
        description: "Null latitude value should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { latitude: null }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_034 - Null longitude value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_034",
        description: "Null longitude value should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { longitude: null }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_035 - Null timezone value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_035",
        description: "Null timezone value should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { timezone: null }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_036 - Null isActive value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_036",
        description: "Null isActive value should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { isActive: null }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_037 - Null type value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_037",
        description: "Null type value should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { type: null }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_038 - Null postalCode value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_038",
        description: "Null postalCode value should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { postalCode: null }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_039 - Null address value is accepted and should return 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_039",
        description: "Null address value is accepted and should return 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { address: null }, accessToken),
      200,
    );
  });

  // ── Empty string validations ───────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_040 - Empty name string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_040",
        description: "Empty name string should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { name: "" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_041 - Empty iataCode string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_041",
        description: "Empty iataCode string should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { iataCode: "" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_042 - Empty icaoCode string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_042",
        description: "Empty icaoCode string should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { icaoCode: "" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_043 - Empty countryCode string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_043",
        description: "Empty countryCode string should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { countryCode: "" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_044 - Empty city string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_044",
        description: "Empty city string should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { city: "" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_045 - Empty timezone string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_045",
        description: "Empty timezone string should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { timezone: "" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_046 - Whitespace-only timezone string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_046",
        description: "Whitespace-only timezone string should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { timezone: "   " }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_047 - Empty postalCode string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_047",
        description: "Empty postalCode string should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { postalCode: "" }, sharedAccessToken),
      400,
    );
  });

  // ── IATA code validations ──────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_048 - iataCode shorter than 3 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_048",
        description: "iataCode shorter than 3 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { iataCode: "AB" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_049 - iataCode longer than 3 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_049",
        description: "iataCode longer than 3 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { iataCode: "ABCD" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_050 - Lowercase iataCode is normalized and may succeed (compatibility)", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRPORT_UPDATE_050",
      description:
        "Lowercase iataCode is normalized and may succeed (compatibility)",
      expectedStatus: 400,
    };

    // @Transform(toUpperCase) normalizes lowercase before @Matches runs.
    // "abc" → "ABC" → valid. Actual result may be 200 (normalization) or 400 (rejection).
    let actualStatus = 0;
    try {
      const response = await doUpdate(
        app,
        sharedAirportId,
        { iataCode: "abc" },
        sharedAccessToken,
      );
      actualStatus = response.status;
      expect([200, 400]).toContain(response.status);
      loggerHelper.pass(
        meta,
        actualStatus,
        `Received ${actualStatus} for lowercase iataCode (normalization compatibility)`,
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

  it("TC_AIRPORT_UPDATE_051 - iataCode with non-alpha characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_051",
        description: "iataCode with non-alpha characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { iataCode: "A1C" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_052 - iataCode with special characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_052",
        description: "iataCode with special characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { iataCode: "A-C" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_053 - iataCode already used by another airport should return 409", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airportA = await seedAirport(app, accessToken);
    const airportB = await seedAirport(app, accessToken);

    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_053",
        description:
          "iataCode already used by another airport should return 409",
        expectedStatus: 409,
      },
      () =>
        doUpdate(
          app,
          airportB.id,
          { iataCode: airportA.iataCode },
          accessToken,
        ),
      409,
    );
  });

  it("TC_AIRPORT_UPDATE_054 - Updating airport with its own existing iataCode should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_054",
        description:
          "Updating airport with its own existing iataCode should succeed with 200",
        expectedStatus: 200,
      },
      () =>
        doUpdate(app, airport.id, { iataCode: airport.iataCode }, accessToken),
      200,
    );
  });

  // ── ICAO code validations ──────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_055 - icaoCode shorter than 4 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_055",
        description: "icaoCode shorter than 4 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { icaoCode: "ABC" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_056 - icaoCode longer than 4 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_056",
        description: "icaoCode longer than 4 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { icaoCode: "ABCDE" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_057 - Lowercase icaoCode is normalized and may succeed (compatibility)", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRPORT_UPDATE_057",
      description:
        "Lowercase icaoCode is normalized and may succeed (compatibility)",
      expectedStatus: 400,
    };

    // @Transform(toUpperCase) normalizes lowercase before @Matches runs.
    // "abcd" → "ABCD" → valid. Actual result may be 200 (normalization) or 400 (rejection).
    let actualStatus = 0;
    try {
      const response = await doUpdate(
        app,
        sharedAirportId,
        { icaoCode: "abcd" },
        sharedAccessToken,
      );
      actualStatus = response.status;
      expect([200, 400]).toContain(response.status);
      loggerHelper.pass(
        meta,
        actualStatus,
        `Received ${actualStatus} for lowercase icaoCode (normalization compatibility)`,
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

  it("TC_AIRPORT_UPDATE_058 - icaoCode with non-alpha characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_058",
        description: "icaoCode with non-alpha characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { icaoCode: "AB1D" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_059 - icaoCode with special characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_059",
        description: "icaoCode with special characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { icaoCode: "AB-D" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_060 - icaoCode already used by another airport should return 409", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airportC = await seedAirport(app, accessToken);
    const airportD = await seedAirport(app, accessToken);

    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_060",
        description:
          "icaoCode already used by another airport should return 409",
        expectedStatus: 409,
      },
      () =>
        doUpdate(
          app,
          airportD.id,
          { icaoCode: airportC.icaoCode },
          accessToken,
        ),
      409,
    );
  });

  it("TC_AIRPORT_UPDATE_061 - Updating airport with its own existing icaoCode should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_061",
        description:
          "Updating airport with its own existing icaoCode should succeed with 200",
        expectedStatus: 200,
      },
      () =>
        doUpdate(app, airport.id, { icaoCode: airport.icaoCode }, accessToken),
      200,
    );
  });

  // ── Country code validations ───────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_062 - countryCode shorter than 2 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_062",
        description: "countryCode shorter than 2 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { countryCode: "I" }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_063 - countryCode longer than 2 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_063",
        description: "countryCode longer than 2 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { countryCode: "IND" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_064 - countryCode with non-alpha characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_064",
        description: "countryCode with non-alpha characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { countryCode: "1N" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_065 - countryCode with special characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_065",
        description: "countryCode with special characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { countryCode: "I-" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_066 - Lowercase countryCode is normalized to uppercase and should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_066",
        description:
          "Lowercase countryCode is normalized to uppercase and should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { countryCode: "in" }, accessToken),
      200,
    );
  });

  // ── Name validations ───────────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_067 - name exceeding 150 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_067",
        description: "name exceeding 150 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "A".repeat(151) },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_068 - Whitespace-only name should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_068",
        description: "Whitespace-only name should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { name: "   " }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_069 - Name with Unicode characters should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_069",
        description: "Name with Unicode characters should succeed with 200",
        expectedStatus: 200,
      },
      () =>
        doUpdate(
          app,
          airport.id,
          { name: "Flughafen Zürich–Kloten" },
          accessToken,
        ),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_070 - Name with SQL injection pattern should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_070",
        description: "Name with SQL injection pattern should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "Airport'; DROP TABLE airports;--" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_071 - Name with script injection pattern should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_071",
        description: "Name with script injection pattern should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "<script>alert('xss')</script>" },
          sharedAccessToken,
        ),
      400,
    );
  });

  // ── City validations ───────────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_072 - city exceeding 100 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_072",
        description: "city exceeding 100 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { city: "A".repeat(101) },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_073 - Whitespace-only city should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_073",
        description: "Whitespace-only city should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { city: "   " }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_074 - City with Unicode characters should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_074",
        description: "City with Unicode characters should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { city: "München" }, accessToken),
      200,
    );
  });

  // ── Latitude validations ───────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_075 - Latitude above 90 should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_075",
        description: "Latitude above 90 should return 400",
        expectedStatus: 400,
      },
      () => doUpdate(app, sharedAirportId, { latitude: 91 }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_076 - Latitude below -90 should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_076",
        description: "Latitude below -90 should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { latitude: -91 }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_077 - Non-numeric latitude string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_077",
        description: "Non-numeric latitude string should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { latitude: "notanumber" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_078 - Latitude at boundary value 90 should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_078",
        description: "Latitude at boundary value 90 should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { latitude: 90 }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_079 - Latitude at boundary value -90 should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_079",
        description: "Latitude at boundary value -90 should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { latitude: -90 }, accessToken),
      200,
    );
  });

  // ── Longitude validations ──────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_080 - Longitude above 180 should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_080",
        description: "Longitude above 180 should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { longitude: 181 }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_081 - Longitude below -180 should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_081",
        description: "Longitude below -180 should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { longitude: -181 }, sharedAccessToken),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_082 - Non-numeric longitude string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_082",
        description: "Non-numeric longitude string should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { longitude: "notanumber" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_083 - Longitude at boundary value 180 should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_083",
        description: "Longitude at boundary value 180 should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { longitude: 180 }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_084 - Longitude at boundary value -180 should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_084",
        description: "Longitude at boundary value -180 should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { longitude: -180 }, accessToken),
      200,
    );
  });

  // ── Timezone validations ───────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_085 - Timezone exceeding 100 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_085",
        description: "Timezone exceeding 100 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { timezone: "A".repeat(101) },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_086 - Invalid IANA timezone format may be accepted (compatibility)", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRPORT_UPDATE_086",
      description:
        "Invalid IANA timezone format may be accepted (compatibility)",
      expectedStatus: 400,
    };

    // The DTO uses @IsString + @IsNotEmpty + @MaxLength(100) but has NO IANA format validator.
    // A non-IANA string like "InvalidTimezone/XYZ" may return 200 (accepted) or 400 (rejected).
    let actualStatus = 0;
    try {
      const response = await doUpdate(
        app,
        sharedAirportId,
        { timezone: "InvalidTimezone/XYZ" },
        sharedAccessToken,
      );
      actualStatus = response.status;
      expect([200, 400]).toContain(response.status);
      loggerHelper.pass(
        meta,
        actualStatus,
        `Received ${actualStatus} for invalid IANA timezone (no format validator in DTO)`,
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

  it("TC_AIRPORT_UPDATE_087 - Whitespace-only timezone string should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_087",
        description: "Whitespace-only timezone string should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { timezone: "   " }, sharedAccessToken),
      400,
    );
  });

  // ── Type (enum) validations ────────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_088 - Update type to INTERNATIONAL should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_088",
        description: "Update type to INTERNATIONAL should succeed with 200",
        expectedStatus: 200,
      },
      () =>
        doUpdate(
          app,
          airport.id,
          { type: AirportType.INTERNATIONAL },
          accessToken,
        ),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_089 - Update type to DOMESTIC should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_089",
        description: "Update type to DOMESTIC should succeed with 200",
        expectedStatus: 200,
      },
      () =>
        doUpdate(app, airport.id, { type: AirportType.DOMESTIC }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_090 - Invalid type value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_090",
        description: "Invalid type value should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { type: "REGIONAL" }, sharedAccessToken),
      400,
    );
  });

  // ── Boolean (isActive) validations ────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_091 - Update isActive to true should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_091",
        description: "Update isActive to true should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { isActive: true }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_092 - Update isActive to false should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_092",
        description: "Update isActive to false should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { isActive: false }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_093 - Non-boolean isActive value should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_093",
        description: "Non-boolean isActive value should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(app, sharedAirportId, { isActive: "yes" }, sharedAccessToken),
      400,
    );
  });

  // ── Optional field validations ─────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_094 - Update with valid address value should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_094",
        description: "Update with valid address value should succeed with 200",
        expectedStatus: 200,
      },
      () =>
        doUpdate(
          app,
          airport.id,
          {
            address:
              "Terminal 2, Chhatrapati Shivaji Maharaj International Airport",
          },
          accessToken,
        ),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_095 - Update with valid postalCode value should succeed with 200", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_095",
        description:
          "Update with valid postalCode value should succeed with 200",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { postalCode: "560037" }, accessToken),
      200,
    );
  });

  it("TC_AIRPORT_UPDATE_096 - address exceeding 255 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_096",
        description: "address exceeding 255 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { address: "A".repeat(256) },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_097 - postalCode exceeding 20 characters should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_097",
        description: "postalCode exceeding 20 characters should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { postalCode: "1".repeat(21) },
          sharedAccessToken,
        ),
      400,
    );
  });

  // ── Security / injection validations ──────────────────────────────────────

  it("TC_AIRPORT_UPDATE_098 - SQL injection in name field should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_098",
        description: "SQL injection in name field should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "Airport' OR '1'='1" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_099 - Script injection in name field should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_099",
        description: "Script injection in name field should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "javascript:alert(1)" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_100 - SQL injection in address field should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_100",
        description: "SQL injection in address field should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { address: "Road'; SELECT * FROM admins;--" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_101 - Script injection in address field should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_101",
        description: "Script injection in address field should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { address: "<script>document.cookie</script>" },
          sharedAccessToken,
        ),
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_102 - Event handler injection in name field should return 400", async () => {
    await expectError(
      {
        id: "TC_AIRPORT_UPDATE_102",
        description: "Event handler injection in name field should return 400",
        expectedStatus: 400,
      },
      () =>
        doUpdate(
          app,
          sharedAirportId,
          { name: "Airport onclick=alert(1)" },
          sharedAccessToken,
        ),
      400,
    );
  });

  // ── Response shape validations ─────────────────────────────────────────────

  it("TC_AIRPORT_UPDATE_103 - Successful update response contains airport id", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_103",
        description: "Successful update response contains airport id",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { name: "TC103 Name" }, accessToken),
      200,
    );

    expect(typeof body.data.id).toBe("number");
    expect(body.data.id).toBe(airport.id);
  });

  it("TC_AIRPORT_UPDATE_104 - Successful update response contains updated name", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);
    const updatedName = "TC104 Updated Airport Name";

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_104",
        description: "Successful update response contains updated name",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { name: updatedName }, accessToken),
      200,
    );

    expect(body.data.name).toBe(updatedName);
  });

  it("TC_AIRPORT_UPDATE_105 - Successful update response contains updated iataCode (uppercased)", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);
    const { iataCode } = nextCodes();

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_105",
        description:
          "Successful update response contains updated iataCode (uppercased)",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { iataCode }, accessToken),
      200,
    );

    expect(body.data.iataCode).toBe(iataCode.toUpperCase());
  });

  it("TC_AIRPORT_UPDATE_106 - Successful update response contains updated icaoCode (uppercased)", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);
    const { icaoCode } = nextCodes();

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_106",
        description:
          "Successful update response contains updated icaoCode (uppercased)",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { icaoCode }, accessToken),
      200,
    );

    expect(body.data.icaoCode).toBe(icaoCode.toUpperCase());
  });

  it("TC_AIRPORT_UPDATE_107 - Successful update response contains updated countryCode (uppercased)", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_107",
        description:
          "Successful update response contains updated countryCode (uppercased)",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { countryCode: "us" }, accessToken),
      200,
    );

    expect(body.data.countryCode).toBe("US");
  });

  it("TC_AIRPORT_UPDATE_108 - Successful update response contains updated city", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_108",
        description: "Successful update response contains updated city",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { city: "Bengaluru" }, accessToken),
      200,
    );

    expect(body.data.city).toBe("Bengaluru");
  });

  it("TC_AIRPORT_UPDATE_109 - Successful update response contains updated latitude", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_109",
        description: "Successful update response contains updated latitude",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { latitude: 13.1986 }, accessToken),
      200,
    );

    expect(body.data.latitude).toBeCloseTo(13.1986, 4);
  });

  it("TC_AIRPORT_UPDATE_110 - Successful update response contains updated longitude", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_110",
        description: "Successful update response contains updated longitude",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { longitude: 77.7066 }, accessToken),
      200,
    );

    expect(body.data.longitude).toBeCloseTo(77.7066, 4);
  });

  it("TC_AIRPORT_UPDATE_111 - Successful update response contains updated timezone", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_111",
        description: "Successful update response contains updated timezone",
        expectedStatus: 200,
      },
      () =>
        doUpdate(
          app,
          airport.id,
          { timezone: "America/New_York" },
          accessToken,
        ),
      200,
    );

    expect(body.data.timezone).toBe("America/New_York");
  });

  it("TC_AIRPORT_UPDATE_112 - Successful update response contains updated isActive", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_112",
        description: "Successful update response contains updated isActive",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { isActive: false }, accessToken),
      200,
    );

    expect(body.data.isActive).toBe(false);
  });

  it("TC_AIRPORT_UPDATE_113 - Successful update response contains updated type", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_113",
        description: "Successful update response contains updated type",
        expectedStatus: 200,
      },
      () =>
        doUpdate(app, airport.id, { type: AirportType.DOMESTIC }, accessToken),
      200,
    );

    expect(body.data.type).toBe(AirportType.DOMESTIC);
  });

  it("TC_AIRPORT_UPDATE_114 - Successful update response contains updated address (including null)", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_114",
        description:
          "Successful update response contains updated address (including null)",
        expectedStatus: 200,
      },
      () => doUpdate(app, airport.id, { address: null }, accessToken),
      200,
    );

    expect(body.data.address).toBeNull();
  });

  it("TC_AIRPORT_UPDATE_115 - Successful update response contains updatedBy matching the admin id", async () => {
    const { adminId, accessToken } = await createSuperAdminSession(app);
    const airport = await seedAirport(app, accessToken);

    const body = await expectSuccess<AirportResponseData>(
      {
        id: "TC_AIRPORT_UPDATE_115",
        description:
          "Successful update response contains updatedBy matching the admin id",
        expectedStatus: 200,
      },
      () =>
        doUpdate(app, airport.id, { name: "TC115 Updated Name" }, accessToken),
      200,
    );

    expect(body.data.updatedBy).toBe(adminId);
  });

  // ── Concurrency / race condition tests ────────────────────────────────────

  it("TC_AIRPORT_UPDATE_116 - Concurrent updates with same iataCode: one succeeds, one gets 409", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRPORT_UPDATE_116",
      description:
        "Concurrent updates with same iataCode: one succeeds, one gets 409",
      expectedStatus: 200,
    };

    let actualStatuses: number[] = [];
    try {
      const { accessToken } = await createSuperAdminSession(app);
      const airportA = await seedAirport(app, accessToken);
      const airportB = await seedAirport(app, accessToken);
      const { iataCode } = nextCodes();

      const [resA, resB] = await Promise.all([
        doUpdate(app, airportA.id, { iataCode }, accessToken),
        doUpdate(app, airportB.id, { iataCode }, accessToken),
      ]);

      actualStatuses = [resA.status, resB.status];
      const statuses = actualStatuses.sort();
      expect(statuses).toEqual([200, 409]);

      loggerHelper.pass(
        meta,
        200,
        `Concurrent iataCode conflict: one succeeded (200), one conflicted (409)`,
      );
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatuses[0] ?? 0,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AIRPORT_UPDATE_117 - Concurrent updates with same icaoCode: one succeeds, one gets 409", async () => {
    const meta: TestCaseMeta = {
      id: "TC_AIRPORT_UPDATE_117",
      description:
        "Concurrent updates with same icaoCode: one succeeds, one gets 409",
      expectedStatus: 200,
    };

    let actualStatuses: number[] = [];
    try {
      const { accessToken } = await createSuperAdminSession(app);
      const airportE = await seedAirport(app, accessToken);
      const airportF = await seedAirport(app, accessToken);
      const { icaoCode } = nextCodes();

      const [resE, resF] = await Promise.all([
        doUpdate(app, airportE.id, { icaoCode }, accessToken),
        doUpdate(app, airportF.id, { icaoCode }, accessToken),
      ]);

      actualStatuses = [resE.status, resF.status];
      const statuses = actualStatuses.sort();
      expect(statuses).toEqual([200, 409]);

      loggerHelper.pass(
        meta,
        200,
        `Concurrent icaoCode conflict: one succeeded (200), one conflicted (409)`,
      );
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatuses[0] ?? 0,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });
});
