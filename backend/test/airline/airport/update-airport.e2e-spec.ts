import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { DataSource } from "typeorm";
import { createTestApp } from "../setup/test-app";
import { loggerHelper } from "../helpers/logger.helper";
import { requestHelper } from "../helpers/request.helper";
import { responseHelper } from "../helpers/response.helper";
import { adminAuthSeeder } from "../seeders/admin/admin.seeder";
import { TestCaseMeta } from "../shared/interfaces/test-case.interface";
import { authHelper } from "../helpers/auth.helper";
import { tokenHelper } from "../helpers/token.helper";
import { airlineSeeder } from "../seeders/airline/airline.seeder";

const CREATE_AIRPORT_ENDPOINT = "/api/v1/airports";
const UPDATE_AIRPORT_ENDPOINT = "/api/v1/airports";

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
  address?: string;
  postalCode: string;
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

let airportCounter = 1;

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
    type: "INTERNATIONAL",
    address: "Airport Road, Mumbai",
    postalCode: "400099",
    ...overrides,
  };
};

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

  const query = `DELETE FROM platform_access_controls WHERE admin_id = ${parameter(0)} and asset = 'AIRPORTS' and access_action = 'EDIT'`;
  await dataSource.query(query, [adminId]);
};

const createAirport = async (
  app: INestApplication,
  accessToken: string,
  payload?: Record<string, unknown>,
) => {
  const requestPayload =
    payload ?? (buildAirportPayload() as unknown as Record<string, unknown>);

  const response = await requestHelper.authorizedPost(
    app,
    CREATE_AIRPORT_ENDPOINT,
    requestPayload,
    accessToken,
  );

  const body = responseHelper.expectSuccess<AirportResponseData>(response, 201);
  return { response, body, payload: requestPayload };
};

const seedAirport = async (
  app: INestApplication,
): Promise<{
  airportId: number;
  accessToken: string;
  data: AirportResponseData;
}> => {
  const { accessToken } = await createSuperAdminSession(app);
  const created = await createAirport(app, accessToken);
  return {
    airportId: created.body.data.id,
    accessToken,
    data: created.body.data,
  };
};

const updateAirport = async (
  app: INestApplication,
  accessToken: string,
  airportId: number,
  payload: Record<string, unknown>,
) => {
  const response = await requestHelper.authorizedPatch(
    app,
    `${UPDATE_AIRPORT_ENDPOINT}/${airportId}`,
    payload,
    accessToken,
  );

  return response;
};

const expectUpdateSuccess = async (
  app: INestApplication,
  meta: TestCaseMeta,
  accessToken: string,
  airportId: number,
  payload: Record<string, unknown>,
) => {
  let actualStatus = 0;

  try {
    const response = await updateAirport(app, accessToken, airportId, payload);
    actualStatus = response.status;
    const body = responseHelper.expectSuccess<AirportResponseData>(
      response,
      200,
    );
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

const expectUpdateError = async (
  app: INestApplication,
  meta: TestCaseMeta,
  accessToken: string,
  airportId: number,
  payload: Record<string, unknown>,
  expectedStatus: number,
) => {
  let actualStatus = 0;

  try {
    const response = await updateAirport(app, accessToken, airportId, payload);
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

describe("Update Airport API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Update Airport API");
  });

  afterAll(async () => {
    await app.close();
  });

  it("TC_AIRPORT_UPDATE_001 - Update airport by SUPER_ADMIN with valid payload", async () => {
    const { airportId } = await seedAirport(app);
    const { accessToken } = await createSuperAdminSession(app);

    await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_001",
        description: "Update airport by SUPER_ADMIN with valid payload",
        expectedStatus: 200,
      },
      accessToken,
      airportId,
      { name: "Updated Airport Name" },
    );
  });

  it("TC_AIRPORT_UPDATE_002 - Update airport by STAFF admin with AIRPORTS EDIT access", async () => {
    const { airportId } = await seedAirport(app);
    const { accessToken } = await createStaffAdminSession(app);

    await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_002",
        description: "Update airport by STAFF admin with AIRPORTS EDIT access",
        expectedStatus: 200,
      },
      accessToken,
      airportId,
      { city: "Pune" },
    );
  });

  it("TC_AIRPORT_UPDATE_003 - Update airport by inactive admin should fail", async () => {
    const { airportId } = await seedAirport(app);
    const accessToken = await createInactiveSuperAdminAccessToken(app);

    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_003",
        description: "Update airport by inactive admin should fail",
        expectedStatus: 403,
      },
      accessToken,
      airportId,
      { city: "Pune" },
      403,
    );
  });

  it("TC_AIRPORT_UPDATE_004 - Update airport without access token", async () => {
    const { airportId } = await seedAirport(app);
    const response = await requestHelper.patch(
      app,
      `${UPDATE_AIRPORT_ENDPOINT}/${airportId}`,
      {
        city: "Pune",
      },
    );
    responseHelper.expectError(response, 401);
  });

  it("TC_AIRPORT_UPDATE_005 - Update airport with invalid access token", async () => {
    const { airportId } = await seedAirport(app);

    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_005",
        description: "Update airport with invalid access token",
        expectedStatus: 401,
      },
      tokenHelper.invalid(),
      airportId,
      { city: "Pune" },
      401,
    );
  });

  it("TC_AIRPORT_UPDATE_006 - Update airport with expired access token", async () => {
    const { airportId } = await seedAirport(app);
    const token = await tokenHelper.expiredAdminAccess();

    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_006",
        description: "Update airport with expired access token",
        expectedStatus: 401,
      },
      token,
      airportId,
      { city: "Pune" },
      401,
    );
  });

  it("TC_AIRPORT_UPDATE_007 - Update airport by STAFF admin without AIRPORTS EDIT access", async () => {
    const { airportId } = await seedAirport(app);
    const { adminId, accessToken } = await createStaffAdminSession(app);
    await revokeAirportsEditAccess(app, adminId);

    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_007",
        description:
          "Update airport by STAFF admin without AIRPORTS EDIT access",
        expectedStatus: 403,
      },
      accessToken,
      airportId,
      { city: "Pune" },
      403,
    );
  });

  it("TC_AIRPORT_UPDATE_008 - Update airport by unauthorized role user", async () => {
    const { airportId } = await seedAirport(app);
    const airline = await airlineSeeder.seedOnboardedAirlineAdmin(app);
    const session = await authHelper.signinAirline(app, {
      email: airline.email,
      password: airline.password,
    });

    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_008",
        description: "Update airport by unauthorized role user",
        expectedStatus: 403,
      },
      session.accessToken,
      airportId,
      { city: "Pune" },
      403,
    );
  });

  it("TC_AIRPORT_UPDATE_009 - Update non-existing airportId", async () => {
    const { accessToken } = await createSuperAdminSession(app);

    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_009",
        description: "Update non-existing airportId",
        expectedStatus: 404,
      },
      accessToken,
      9999999,
      { city: "Pune" },
      404,
    );
  });

  it("TC_AIRPORT_UPDATE_010 - Update airport with invalid airportId format", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const response = await requestHelper.authorizedPatch(
      app,
      `${UPDATE_AIRPORT_ENDPOINT}/invalid-id`,
      { city: "Pune" },
      accessToken,
    );
    responseHelper.expectError(response, 400);
  });

  it("TC_AIRPORT_UPDATE_011 - Update airport with duplicate IATA code", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const first = await createAirport(app, accessToken);
    const second = await createAirport(app, accessToken);

    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_011",
        description: "Update airport with duplicate IATA code",
        expectedStatus: 409,
      },
      accessToken,
      second.body.data.id,
      { iataCode: first.body.data.iataCode },
      409,
    );
  });

  it("TC_AIRPORT_UPDATE_012 - Update airport with duplicate ICAO code", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const first = await createAirport(app, accessToken);
    const second = await createAirport(app, accessToken);

    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_012",
        description: "Update airport with duplicate ICAO code",
        expectedStatus: 409,
      },
      accessToken,
      second.body.data.id,
      { icaoCode: first.body.data.icaoCode },
      409,
    );
  });

  it("TC_AIRPORT_UPDATE_013 - Update airport with duplicate IATA and ICAO codes", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const first = await createAirport(app, accessToken);
    const second = await createAirport(app, accessToken);

    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_013",
        description: "Update airport with duplicate IATA and ICAO codes",
        expectedStatus: 409,
      },
      accessToken,
      second.body.data.id,
      {
        iataCode: first.body.data.iataCode,
        icaoCode: first.body.data.icaoCode,
      },
      409,
    );
  });

  const partialUpdates: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_014",
      description: "Partial update airport name only",
      payload: { name: "Mumbai T2 Airport" },
    },
    {
      id: "TC_AIRPORT_UPDATE_015",
      description: "Partial update airport city only",
      payload: { city: "Delhi" },
    },
    {
      id: "TC_AIRPORT_UPDATE_016",
      description: "Partial update airport coordinates only",
      payload: { latitude: 28.5562, longitude: 77.1 },
    },
    {
      id: "TC_AIRPORT_UPDATE_017",
      description: "Partial update airport timezone only",
      payload: { timezone: "Asia/Kolkata" },
    },
    {
      id: "TC_AIRPORT_UPDATE_018",
      description: "Partial update airport status only",
      payload: { isActive: false },
    },
    {
      id: "TC_AIRPORT_UPDATE_019",
      description: "Partial update airport type only",
      payload: { type: "DOMESTIC" },
    },
    {
      id: "TC_AIRPORT_UPDATE_020",
      description: "Partial update airport address only",
      payload: { address: "Sector 1, Airport City" },
    },
    {
      id: "TC_AIRPORT_UPDATE_021",
      description: "Partial update airport postalCode only",
      payload: { postalCode: "560300" },
    },
  ];

  for (const testCase of partialUpdates) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      await expectUpdateSuccess(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 200,
        },
        accessToken,
        airportId,
        testCase.payload,
      );
    });
  }

  it("TC_AIRPORT_UPDATE_022 - Empty request body should not update airport", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_022",
        description: "Empty request body should not update airport",
        expectedStatus: 400,
      },
      accessToken,
      airportId,
      {},
      400,
    );
  });

  const emptyCases: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_023",
      description: "Empty name value",
      payload: { name: "" },
    },
    {
      id: "TC_AIRPORT_UPDATE_024",
      description: "Empty iataCode value",
      payload: { iataCode: "" },
    },
    {
      id: "TC_AIRPORT_UPDATE_025",
      description: "Empty icaoCode value",
      payload: { icaoCode: "" },
    },
    {
      id: "TC_AIRPORT_UPDATE_026",
      description: "Empty countryCode value",
      payload: { countryCode: "" },
    },
    {
      id: "TC_AIRPORT_UPDATE_027",
      description: "Empty city value",
      payload: { city: "" },
    },
    {
      id: "TC_AIRPORT_UPDATE_028",
      description: "Empty timezone value",
      payload: { timezone: "" },
    },
    {
      id: "TC_AIRPORT_UPDATE_029",
      description: "Empty type value",
      payload: { type: "" },
    },
  ];

  for (const testCase of emptyCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      await expectUpdateError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        airportId,
        testCase.payload,
        400,
      );
    });
  }

  const nullCases: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_030",
      description: "Null name value",
      payload: { name: null },
    },
    {
      id: "TC_AIRPORT_UPDATE_031",
      description: "Null iataCode value",
      payload: { iataCode: null },
    },
    {
      id: "TC_AIRPORT_UPDATE_032",
      description: "Null icaoCode value",
      payload: { icaoCode: null },
    },
    {
      id: "TC_AIRPORT_UPDATE_033",
      description: "Null countryCode value",
      payload: { countryCode: null },
    },
    {
      id: "TC_AIRPORT_UPDATE_034",
      description: "Null city value",
      payload: { city: null },
    },
    {
      id: "TC_AIRPORT_UPDATE_035",
      description: "Null latitude value",
      payload: { latitude: null },
    },
    {
      id: "TC_AIRPORT_UPDATE_036",
      description: "Null longitude value",
      payload: { longitude: null },
    },
    {
      id: "TC_AIRPORT_UPDATE_037",
      description: "Null timezone value",
      payload: { timezone: null },
    },
    {
      id: "TC_AIRPORT_UPDATE_038",
      description: "Null isActive value",
      payload: { isActive: null },
    },
    {
      id: "TC_AIRPORT_UPDATE_039",
      description: "Null type value",
      payload: { type: null },
    },
  ];

  for (const testCase of nullCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      await expectUpdateError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        airportId,
        testCase.payload,
        400,
      );
    });
  }

  const formatCases: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_040",
      description: "Invalid IATA code format less than 3 characters",
      payload: { iataCode: "AB" },
    },
    {
      id: "TC_AIRPORT_UPDATE_041",
      description: "Invalid IATA code format greater than 3 characters",
      payload: { iataCode: "ABCD" },
    },
    {
      id: "TC_AIRPORT_UPDATE_042",
      description: "Invalid ICAO code format less than 4 characters",
      payload: { icaoCode: "ABC" },
    },
    {
      id: "TC_AIRPORT_UPDATE_043",
      description: "Invalid ICAO code format greater than 4 characters",
      payload: { icaoCode: "ABCDE" },
    },
    {
      id: "TC_AIRPORT_UPDATE_044",
      description: "Invalid countryCode format",
      payload: { countryCode: "IND" },
    },
    {
      id: "TC_AIRPORT_UPDATE_045",
      description: "Invalid airport type enum value",
      payload: { type: "REGIONAL" },
    },
    {
      id: "TC_AIRPORT_UPDATE_046",
      description: "Invalid timezone value",
      payload: { timezone: 123 },
    },
    {
      id: "TC_AIRPORT_UPDATE_047",
      description: "Invalid latitude greater than 90",
      payload: { latitude: 90.000001 },
    },
    {
      id: "TC_AIRPORT_UPDATE_048",
      description: "Invalid latitude less than -90",
      payload: { latitude: -90.000001 },
    },
    {
      id: "TC_AIRPORT_UPDATE_049",
      description: "Invalid longitude greater than 180",
      payload: { longitude: 180.000001 },
    },
    {
      id: "TC_AIRPORT_UPDATE_050",
      description: "Invalid longitude less than -180",
      payload: { longitude: -180.000001 },
    },
  ];

  for (const testCase of formatCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      await expectUpdateError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        airportId,
        testCase.payload,
        400,
      );
    });
  }

  const successMutationCases: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_051",
      description: "Update airport type to INTERNATIONAL successfully",
      payload: { type: "INTERNATIONAL" },
    },
    {
      id: "TC_AIRPORT_UPDATE_052",
      description: "Update airport type to DOMESTIC successfully",
      payload: { type: "DOMESTIC" },
    },
    {
      id: "TC_AIRPORT_UPDATE_053",
      description: "Update airport status to active successfully",
      payload: { isActive: true },
    },
    {
      id: "TC_AIRPORT_UPDATE_054",
      description: "Update airport status to inactive successfully",
      payload: { isActive: false },
    },
    {
      id: "TC_AIRPORT_UPDATE_055",
      description: "Lowercase IATA code normalization handling",
      payload: { iataCode: "bom" },
    },
    {
      id: "TC_AIRPORT_UPDATE_056",
      description: "Lowercase ICAO code normalization handling",
      payload: { icaoCode: "vabb" },
    },
    {
      id: "TC_AIRPORT_UPDATE_057",
      description: "Lowercase countryCode normalization handling",
      payload: { countryCode: "ae" },
    },
    {
      id: "TC_AIRPORT_UPDATE_058",
      description: "Update airport with valid address field",
      payload: { address: "Skyline Avenue" },
    },
    {
      id: "TC_AIRPORT_UPDATE_059",
      description: "Update airport with valid postalCode field",
      payload: { postalCode: "560001" },
    },
  ];

  for (const testCase of successMutationCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      await expectUpdateSuccess(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 200,
        },
        accessToken,
        airportId,
        testCase.payload,
      );
    });
  }

  const optionalAddressClearSuccessCases: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_060",
      description: "Update airport with empty optional address field",
      payload: { address: "" },
    },
    {
      id: "TC_AIRPORT_UPDATE_061",
      description: "Update airport with null address field",
      payload: { address: null },
    },
  ];

  for (const testCase of optionalAddressClearSuccessCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      await expectUpdateSuccess(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 200,
        },
        accessToken,
        airportId,
        testCase.payload,
      );
    });
  }

  const postalCodeEmptyAndNullCases: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_062",
      description: "Update airport with empty required postalCode field",
      payload: { postalCode: "" },
    },
    {
      id: "TC_AIRPORT_UPDATE_063",
      description: "Update airport with null required postalCode field",
      payload: { postalCode: null },
    },
  ];

  for (const testCase of postalCodeEmptyAndNullCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      await expectUpdateError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        airportId,
        testCase.payload,
        400,
      );
    });
  }

  const fieldConstraintFailures: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_064",
      description: "Airport name exceeding maximum allowed length",
      payload: { name: "A".repeat(151) },
    },
    {
      id: "TC_AIRPORT_UPDATE_065",
      description: "City exceeding maximum allowed length",
      payload: { city: "B".repeat(101) },
    },
    {
      id: "TC_AIRPORT_UPDATE_066",
      description: "Address exceeding maximum allowed length",
      payload: { address: "C".repeat(256) },
    },
    {
      id: "TC_AIRPORT_UPDATE_067",
      description: "PostalCode exceeding maximum allowed length",
      payload: { postalCode: "9".repeat(21) },
    },
  ];

  for (const testCase of fieldConstraintFailures) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      await expectUpdateError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        airportId,
        testCase.payload,
        400,
      );
    });
  }

  const unicodeAndWhitespaceCases: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
    success: boolean;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_068",
      description: "Update airport with Unicode airport name",
      payload: { name: "Aeroporto Sao Jose" },
      success: true,
    },
    {
      id: "TC_AIRPORT_UPDATE_069",
      description: "Update airport with Unicode city name",
      payload: { city: "Sao Paulo" },
      success: true,
    },
    {
      id: "TC_AIRPORT_UPDATE_070",
      description: "Update airport with Unicode address value",
      payload: { address: "Rua Joao Pessoa" },
      success: true,
    },
    {
      id: "TC_AIRPORT_UPDATE_071",
      description: "Whitespace-only name field",
      payload: { name: "   " },
      success: false,
    },
    {
      id: "TC_AIRPORT_UPDATE_072",
      description: "Whitespace-only city field",
      payload: { city: "   " },
      success: false,
    },
    {
      id: "TC_AIRPORT_UPDATE_073",
      description: "Whitespace-only timezone field",
      payload: { timezone: "   " },
      success: false,
    },
  ];

  for (const testCase of unicodeAndWhitespaceCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      if (testCase.success) {
        await expectUpdateSuccess(
          app,
          {
            id: testCase.id,
            description: testCase.description,
            expectedStatus: 200,
          },
          accessToken,
          airportId,
          testCase.payload,
        );
      } else {
        await expectUpdateError(
          app,
          {
            id: testCase.id,
            description: testCase.description,
            expectedStatus: 400,
          },
          accessToken,
          airportId,
          testCase.payload,
          400,
        );
      }
    });
  }

  it("TC_AIRPORT_UPDATE_074 - Malformed JSON payload", async () => {
    const { airportId } = await seedAirport(app);
    const { accessToken } = await createSuperAdminSession(app);

    const response = await request(app.getHttpServer())
      .patch(`${UPDATE_AIRPORT_ENDPOINT}/${airportId}`)
      .set("x-request-id", "e2e-request")
      .set("content-type", "application/json")
      .set("authorization", `Bearer ${accessToken}`)
      .send('{"city":"Broken"');

    responseHelper.expectError(response, 400);
  });

  it("TC_AIRPORT_UPDATE_075 - Additional unknown fields in payload", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_075",
        description: "Additional unknown fields in payload",
        expectedStatus: 400,
      },
      accessToken,
      airportId,
      { unknownField: "unexpected" },
      400,
    );
  });

  const securityCases: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_076",
      description: "SQL injection attempt in airport name",
      payload: { name: "Airport'; DROP TABLE airports; --" },
    },
    {
      id: "TC_AIRPORT_UPDATE_077",
      description: "SQL injection attempt in IATA code",
      payload: { iataCode: "A'1" },
    },
    {
      id: "TC_AIRPORT_UPDATE_078",
      description: "Script injection attempt in airport name",
      payload: { name: "<script>alert(1)</script>" },
    },
    {
      id: "TC_AIRPORT_UPDATE_079",
      description: "Script injection attempt in address field",
      payload: { address: "<img src=x onerror=alert(1)>" },
    },
  ];

  for (const testCase of securityCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      await expectUpdateError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        airportId,
        testCase.payload,
        400,
      );
    });
  }

  it("TC_AIRPORT_UPDATE_080 - Update airport response contains airport id", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    const { body } = await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_080",
        description: "Update airport response contains airport id",
        expectedStatus: 200,
      },
      accessToken,
      airportId,
      { city: "Surat" },
    );

    expect(body.data.id).toBe(airportId);
  });

  it("TC_AIRPORT_UPDATE_081 - Update airport response contains createdBy field unchanged", async () => {
    const seeded = await seedAirport(app);
    const { body } = await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_081",
        description:
          "Update airport response contains createdBy field unchanged",
        expectedStatus: 200,
      },
      seeded.accessToken,
      seeded.airportId,
      { city: "Nagpur" },
    );

    expect(body.data.createdBy).toBe(seeded.data.createdBy);
  });

  it("TC_AIRPORT_UPDATE_082 - Update airport response contains updatedBy field updated correctly", async () => {
    const seeded = await seedAirport(app);
    const updater = await createStaffAdminSession(app);

    const { body } = await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_082",
        description:
          "Update airport response contains updatedBy field updated correctly",
        expectedStatus: 200,
      },
      updater.accessToken,
      seeded.airportId,
      { city: "Jaipur" },
    );

    expect(body.data.updatedBy).toBe(updater.adminId);
  });

  it("TC_AIRPORT_UPDATE_083 - Update airport response contains createdAt timestamp unchanged", async () => {
    const seeded = await seedAirport(app);

    const { body } = await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_083",
        description:
          "Update airport response contains createdAt timestamp unchanged",
        expectedStatus: 200,
      },
      seeded.accessToken,
      seeded.airportId,
      { city: "Lucknow" },
    );

    expect(body.data.createdAt).toBe(seeded.data.createdAt);
  });

  it("TC_AIRPORT_UPDATE_084 - Update airport response contains updatedAt timestamp updated correctly", async () => {
    const seeded = await seedAirport(app);

    const { body } = await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_084",
        description:
          "Update airport response contains updatedAt timestamp updated correctly",
        expectedStatus: 200,
      },
      seeded.accessToken,
      seeded.airportId,
      { city: "Indore" },
    );

    expect(new Date(body.data.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(seeded.data.updatedAt).getTime(),
    );
  });

  it("TC_AIRPORT_UPDATE_085 - Update airport response contains normalized IATA code", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    const { body } = await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_085",
        description: "Update airport response contains normalized IATA code",
        expectedStatus: 200,
      },
      accessToken,
      airportId,
      { iataCode: "del" },
    );

    expect(body.data.iataCode).toBe("DEL");
  });

  it("TC_AIRPORT_UPDATE_086 - Update airport response contains normalized ICAO code", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    const { body } = await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_086",
        description: "Update airport response contains normalized ICAO code",
        expectedStatus: 200,
      },
      accessToken,
      airportId,
      { icaoCode: "vidp" },
    );

    expect(body.data.icaoCode).toBe("VIDP");
  });

  it("TC_AIRPORT_UPDATE_087 - Update airport response contains normalized countryCode", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    const { body } = await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_087",
        description: "Update airport response contains normalized countryCode",
        expectedStatus: 200,
      },
      accessToken,
      airportId,
      { countryCode: "ae" },
    );

    expect(body.data.countryCode).toBe("AE");
  });

  it("TC_AIRPORT_UPDATE_088 - Update airport with decimal latitude and longitude precision", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_088",
        description:
          "Update airport with decimal latitude and longitude precision",
        expectedStatus: 200,
      },
      accessToken,
      airportId,
      { latitude: 25.2531745, longitude: 55.3656722 },
    );
  });

  const boundaryCases: Array<{
    id: string;
    description: string;
    payload: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_UPDATE_089",
      description: "Update airport with boundary latitude value 90",
      payload: { latitude: 90 },
    },
    {
      id: "TC_AIRPORT_UPDATE_090",
      description: "Update airport with boundary latitude value -90",
      payload: { latitude: -90 },
    },
    {
      id: "TC_AIRPORT_UPDATE_091",
      description: "Update airport with boundary longitude value 180",
      payload: { longitude: 180 },
    },
    {
      id: "TC_AIRPORT_UPDATE_092",
      description: "Update airport with boundary longitude value -180",
      payload: { longitude: -180 },
    },
  ];

  for (const testCase of boundaryCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { airportId, accessToken } = await seedAirport(app);
      await expectUpdateSuccess(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 200,
        },
        accessToken,
        airportId,
        testCase.payload,
      );
    });
  }

  it("TC_AIRPORT_UPDATE_093 - Update airport name while keeping same IATA and ICAO codes", async () => {
    const seeded = await seedAirport(app);
    const { body } = await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_093",
        description:
          "Update airport name while keeping same IATA and ICAO codes",
        expectedStatus: 200,
      },
      seeded.accessToken,
      seeded.airportId,
      {
        name: "Renamed Airport",
        iataCode: seeded.data.iataCode,
        icaoCode: seeded.data.icaoCode,
      },
    );

    expect(body.data.name).toBe("Renamed Airport");
  });

  it("TC_AIRPORT_UPDATE_094 - Update airport with same IATA code of current airport should succeed", async () => {
    const seeded = await seedAirport(app);
    await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_094",
        description:
          "Update airport with same IATA code of current airport should succeed",
        expectedStatus: 200,
      },
      seeded.accessToken,
      seeded.airportId,
      { iataCode: seeded.data.iataCode },
    );
  });

  it("TC_AIRPORT_UPDATE_095 - Update airport with same ICAO code of current airport should succeed", async () => {
    const seeded = await seedAirport(app);
    await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_095",
        description:
          "Update airport with same ICAO code of current airport should succeed",
        expectedStatus: 200,
      },
      seeded.accessToken,
      seeded.airportId,
      { icaoCode: seeded.data.icaoCode },
    );
  });

  it("TC_AIRPORT_UPDATE_096 - Concurrent airport updates with conflicting IATA code should result in one success and one conflict", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const targetCode = buildAirportPayload().iataCode;

    const a = await createAirport(
      app,
      accessToken,
      buildAirportPayload() as unknown as Record<string, unknown>,
    );
    const b = await createAirport(
      app,
      accessToken,
      buildAirportPayload() as unknown as Record<string, unknown>,
    );

    const [first, second] = await Promise.all([
      requestHelper.authorizedPatch(
        app,
        `${UPDATE_AIRPORT_ENDPOINT}/${a.body.data.id}`,
        { iataCode: targetCode },
        accessToken,
      ),
      requestHelper.authorizedPatch(
        app,
        `${UPDATE_AIRPORT_ENDPOINT}/${b.body.data.id}`,
        { iataCode: targetCode },
        accessToken,
      ),
    ]);

    const statuses = [first.status, second.status].sort((x, y) => x - y);
    expect(statuses).toEqual([200, 409]);
  });

  it("TC_AIRPORT_UPDATE_097 - Concurrent airport updates with conflicting ICAO code should result in one success and one conflict", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    const targetCode = buildAirportPayload().icaoCode;

    const a = await createAirport(
      app,
      accessToken,
      buildAirportPayload() as unknown as Record<string, unknown>,
    );
    const b = await createAirport(
      app,
      accessToken,
      buildAirportPayload() as unknown as Record<string, unknown>,
    );

    const [first, second] = await Promise.all([
      requestHelper.authorizedPatch(
        app,
        `${UPDATE_AIRPORT_ENDPOINT}/${a.body.data.id}`,
        { icaoCode: targetCode },
        accessToken,
      ),
      requestHelper.authorizedPatch(
        app,
        `${UPDATE_AIRPORT_ENDPOINT}/${b.body.data.id}`,
        { icaoCode: targetCode },
        accessToken,
      ),
    ]);

    const statuses = [first.status, second.status].sort((x, y) => x - y);
    expect(statuses).toEqual([200, 409]);
  });

  it("TC_AIRPORT_UPDATE_098 - Update airport with scientific notation latitude value", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_098",
        description: "Update airport with scientific notation latitude value",
        expectedStatus: 400,
      },
      accessToken,
      airportId,
      { latitude: "1e2" },
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_099 - Update airport with scientific notation longitude value", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_099",
        description: "Update airport with scientific notation longitude value",
        expectedStatus: 400,
      },
      accessToken,
      airportId,
      { longitude: "1e3" },
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_100 - Update airport isActive from true to false successfully", async () => {
    const seeded = await seedAirport(app);
    const { body } = await expectUpdateSuccess(
      app,
      {
        id: "TC_AIRPORT_UPDATE_100",
        description: "Update airport isActive from true to false successfully",
        expectedStatus: 200,
      },
      seeded.accessToken,
      seeded.airportId,
      { isActive: false },
    );

    expect(body.data.isActive).toBe(false);
  });

  it("TC_AIRPORT_UPDATE_101 - Invalid IATA code with non-letter character", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_101",
        description: "Invalid IATA code with non-letter character",
        expectedStatus: 400,
      },
      accessToken,
      airportId,
      { iataCode: "A1B" },
      400,
    );
  });

  it("TC_AIRPORT_UPDATE_102 - Invalid ICAO code with non-letter character", async () => {
    const { airportId, accessToken } = await seedAirport(app);
    await expectUpdateError(
      app,
      {
        id: "TC_AIRPORT_UPDATE_102",
        description: "Invalid ICAO code with non-letter character",
        expectedStatus: 400,
      },
      accessToken,
      airportId,
      { icaoCode: "AB1D" },
      400,
    );
  });
});
