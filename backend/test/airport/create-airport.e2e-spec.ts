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
import { PlatformAccessControlEntity } from "../../src/admin/entities/platform-access-control.entity";
import {
  AccessAction,
  PlatformAsset,
} from "../../src/common/constants/access-control.constants";
import { AirportType } from "../../src/airport/entities/airport.entity";

const CREATE_AIRPORT_ENDPOINT = "/api/v1/airports";

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
  type: AirportType;
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
  type: AirportType;
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

  const iataCode = token;
  const icaoCode = `K${token}`;

  return { iataCode, icaoCode };
};

const buildCreateAirportPayload = (
  overrides?: Partial<AirportPayload>,
): AirportPayload => {
  const codes = nextCodes();
  return {
    name: `Flyvoid Airport ${Date.now()}-${airportCounter}`,
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
  await dataSource.getRepository(PlatformAccessControlEntity).delete({
    adminId,
    asset: PlatformAsset.AIRPORTS,
    accessAction: AccessAction.EDIT,
  });
};

const createAirport = async (
  app: INestApplication,
  accessToken: string,
  payload?: Record<string, unknown>,
) => {
  const requestPayload =
    payload ??
    (buildCreateAirportPayload() as unknown as Record<string, unknown>);
  const response = await requestHelper.authorizedPost(
    app,
    CREATE_AIRPORT_ENDPOINT,
    requestPayload,
    accessToken,
  );

  return { response, payload: requestPayload };
};

const expectCreateAirportSuccess = async (
  app: INestApplication,
  meta: TestCaseMeta,
  accessToken: string,
  payload?: Record<string, unknown>,
  expectedStatus = 201,
) => {
  let actualStatus = 0;

  try {
    const { response } = await createAirport(app, accessToken, payload);
    actualStatus = response.status;
    const body = responseHelper.expectSuccess<AirportResponseData>(
      response,
      expectedStatus,
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

const expectCreateAirportError = async (
  app: INestApplication,
  meta: TestCaseMeta,
  accessToken: string,
  payload: Record<string, unknown>,
  expectedStatus: number,
) => {
  let actualStatus = 0;

  try {
    const { response } = await createAirport(app, accessToken, payload);
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

describe("Create Airport API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Create Airport API");
  });

  afterAll(async () => {
    await app.close();
  });

  it("TC_AIRPORT_CREATE_001 - Create airport by SUPER_ADMIN with valid payload", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload();

    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_001",
        description: "Create airport by SUPER_ADMIN with valid payload",
        expectedStatus: 201,
      },
      accessToken,
      payload as unknown as Record<string, unknown>,
    );

    expect(body.data.iataCode).toBe(payload.iataCode);
  });

  it("TC_AIRPORT_CREATE_002 - Create airport by STAFF admin with AIRPORTS EDIT access", async () => {
    const { accessToken } = await createStaffAdminAccessToken(app);

    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_002",
        description: "Create airport by STAFF admin with AIRPORTS EDIT access",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
    );
  });

  it("TC_AIRPORT_CREATE_003 - Create airport by inactive admin should fail", async () => {
    const accessToken = await createInactiveSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_003",
        description: "Create airport by inactive admin should fail",
        expectedStatus: 403,
      },
      accessToken,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
      403,
    );
  });

  it("TC_AIRPORT_CREATE_004 - Create airport without access token", async () => {
    const response = await requestHelper.post(
      app,
      CREATE_AIRPORT_ENDPOINT,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
    );

    responseHelper.expectError(response, 401);
  });

  it("TC_AIRPORT_CREATE_005 - Create airport with invalid access token", async () => {
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_005",
        description: "Create airport with invalid access token",
        expectedStatus: 401,
      },
      tokenHelper.invalid(),
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
      401,
    );
  });

  it("TC_AIRPORT_CREATE_006 - Create airport with expired access token", async () => {
    const expiredToken = await tokenHelper.expiredAdminAccess();

    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_006",
        description: "Create airport with expired access token",
        expectedStatus: 401,
      },
      expiredToken,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
      401,
    );
  });

  it("TC_AIRPORT_CREATE_007 - Create airport by STAFF admin without AIRPORTS EDIT access", async () => {
    const { adminId, accessToken } = await createStaffAdminAccessToken(app);
    await revokeAirportsEditAccess(app, adminId);

    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_007",
        description:
          "Create airport by STAFF admin without AIRPORTS EDIT access",
        expectedStatus: 403,
      },
      accessToken,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
      403,
    );
  });

  it("TC_AIRPORT_CREATE_008 - Create airport by unauthorized role user", async () => {
    const airline = await airlineSeeder.seedOnboardedAirlineAdmin(app);
    const session = await authHelper.signinAirline(app, {
      email: airline.email,
      password: airline.password,
    });

    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_008",
        description: "Create airport by unauthorized role user",
        expectedStatus: 403,
      },
      session.accessToken,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
      403,
    );
  });

  it("TC_AIRPORT_CREATE_009 - Duplicate IATA code should fail", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload();

    const first = await createAirport(
      app,
      accessToken,
      payload as unknown as Record<string, unknown>,
    );
    responseHelper.expectSuccess(first.response, 201);

    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_009",
        description: "Duplicate IATA code should fail",
        expectedStatus: 409,
      },
      accessToken,
      buildCreateAirportPayload({
        iataCode: payload.iataCode,
      }) as unknown as Record<string, unknown>,
      409,
    );
  });

  it("TC_AIRPORT_CREATE_010 - Duplicate ICAO code should fail", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload();

    const first = await createAirport(
      app,
      accessToken,
      payload as unknown as Record<string, unknown>,
    );
    responseHelper.expectSuccess(first.response, 201);

    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_010",
        description: "Duplicate ICAO code should fail",
        expectedStatus: 409,
      },
      accessToken,
      buildCreateAirportPayload({
        icaoCode: payload.icaoCode,
      }) as unknown as Record<string, unknown>,
      409,
    );
  });

  it("TC_AIRPORT_CREATE_011 - Duplicate IATA and ICAO codes should fail", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload();

    const first = await createAirport(
      app,
      accessToken,
      payload as unknown as Record<string, unknown>,
    );
    responseHelper.expectSuccess(first.response, 201);

    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_011",
        description: "Duplicate IATA and ICAO codes should fail",
        expectedStatus: 409,
      },
      accessToken,
      buildCreateAirportPayload({
        iataCode: payload.iataCode,
        icaoCode: payload.icaoCode,
      }) as unknown as Record<string, unknown>,
      409,
    );
  });

  const missingFieldCases: Array<{
    id: string;
    field: keyof AirportPayload;
    description: string;
  }> = [
    {
      id: "TC_AIRPORT_CREATE_012",
      field: "name",
      description: "Missing name field",
    },
    {
      id: "TC_AIRPORT_CREATE_013",
      field: "iataCode",
      description: "Missing iataCode field",
    },
    {
      id: "TC_AIRPORT_CREATE_014",
      field: "icaoCode",
      description: "Missing icaoCode field",
    },
    {
      id: "TC_AIRPORT_CREATE_015",
      field: "countryCode",
      description: "Missing countryCode field",
    },
    {
      id: "TC_AIRPORT_CREATE_016",
      field: "city",
      description: "Missing city field",
    },
    {
      id: "TC_AIRPORT_CREATE_017",
      field: "latitude",
      description: "Missing latitude field",
    },
    {
      id: "TC_AIRPORT_CREATE_018",
      field: "longitude",
      description: "Missing longitude field",
    },
    {
      id: "TC_AIRPORT_CREATE_019",
      field: "timezone",
      description: "Missing timezone field",
    },
    {
      id: "TC_AIRPORT_CREATE_020",
      field: "isActive",
      description: "Missing isActive field",
    },
    {
      id: "TC_AIRPORT_CREATE_021",
      field: "type",
      description: "Missing type field",
    },
  ];

  for (const testCase of missingFieldCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const accessToken = await createSuperAdminAccessToken(app);
      const payload = buildCreateAirportPayload();
      const source = payload as unknown as Record<string, unknown>;
      const { [testCase.field]: _removed, ...withoutField } = source;

      await expectCreateAirportError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        withoutField,
        400,
      );
    });
  }

  const emptyFieldCases: Array<{
    id: string;
    description: string;
    patch: Partial<AirportPayload>;
  }> = [
    {
      id: "TC_AIRPORT_CREATE_022",
      description: "Empty name value",
      patch: { name: "" },
    },
    {
      id: "TC_AIRPORT_CREATE_023",
      description: "Empty iataCode value",
      patch: { iataCode: "" },
    },
    {
      id: "TC_AIRPORT_CREATE_024",
      description: "Empty icaoCode value",
      patch: { icaoCode: "" },
    },
    {
      id: "TC_AIRPORT_CREATE_025",
      description: "Empty countryCode value",
      patch: { countryCode: "" },
    },
    {
      id: "TC_AIRPORT_CREATE_026",
      description: "Empty city value",
      patch: { city: "" },
    },
    {
      id: "TC_AIRPORT_CREATE_027",
      description: "Empty timezone value",
      patch: { timezone: "" },
    },
    {
      id: "TC_AIRPORT_CREATE_028",
      description: "Empty type value",
      patch: { type: "" as unknown as AirportType },
    },
  ];

  for (const testCase of emptyFieldCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const accessToken = await createSuperAdminAccessToken(app);
      await expectCreateAirportError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        buildCreateAirportPayload(testCase.patch) as unknown as Record<
          string,
          unknown
        >,
        400,
      );
    });
  }

  const nullFieldCases: Array<{
    id: string;
    description: string;
    patch: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_CREATE_029",
      description: "Null name value",
      patch: { name: null },
    },
    {
      id: "TC_AIRPORT_CREATE_030",
      description: "Null iataCode value",
      patch: { iataCode: null },
    },
    {
      id: "TC_AIRPORT_CREATE_031",
      description: "Null icaoCode value",
      patch: { icaoCode: null },
    },
    {
      id: "TC_AIRPORT_CREATE_032",
      description: "Null countryCode value",
      patch: { countryCode: null },
    },
    {
      id: "TC_AIRPORT_CREATE_033",
      description: "Null city value",
      patch: { city: null },
    },
    {
      id: "TC_AIRPORT_CREATE_034",
      description: "Null latitude value",
      patch: { latitude: null },
    },
    {
      id: "TC_AIRPORT_CREATE_035",
      description: "Null longitude value",
      patch: { longitude: null },
    },
    {
      id: "TC_AIRPORT_CREATE_036",
      description: "Null timezone value",
      patch: { timezone: null },
    },
    {
      id: "TC_AIRPORT_CREATE_037",
      description: "Null isActive value",
      patch: { isActive: null },
    },
    {
      id: "TC_AIRPORT_CREATE_038",
      description: "Null type value",
      patch: { type: null },
    },
  ];

  for (const testCase of nullFieldCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const accessToken = await createSuperAdminAccessToken(app);
      await expectCreateAirportError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        {
          ...(buildCreateAirportPayload() as unknown as Record<
            string,
            unknown
          >),
          ...testCase.patch,
        },
        400,
      );
    });
  }

  it("TC_AIRPORT_CREATE_039 - Invalid IATA code format less than 3 characters", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_039",
        description: "Invalid IATA code format less than 3 characters",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ iataCode: "AB" }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_040 - Invalid IATA code format greater than 3 characters", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_040",
        description: "Invalid IATA code format greater than 3 characters",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ iataCode: "ABCD" }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_041 - Invalid ICAO code format less than 4 characters", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_041",
        description: "Invalid ICAO code format less than 4 characters",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ icaoCode: "ABC" }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_042 - Invalid ICAO code format greater than 4 characters", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_042",
        description: "Invalid ICAO code format greater than 4 characters",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ icaoCode: "ABCDE" }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_043 - Invalid countryCode format", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_043",
        description: "Invalid countryCode format",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ countryCode: "IND" }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_044 - Invalid airport type enum value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_044",
        description: "Invalid airport type enum value",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({
        type: "REGIONAL" as unknown as AirportType,
      }) as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_045 - Invalid timezone value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_045",
        description: "Invalid timezone value",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...(buildCreateAirportPayload() as unknown as Record<string, unknown>),
        timezone: 123,
      },
      400,
    );
  });

  it("TC_AIRPORT_CREATE_046 - Invalid latitude greater than 90", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_046",
        description: "Invalid latitude greater than 90",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ latitude: 90.000001 }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_047 - Invalid latitude less than -90", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_047",
        description: "Invalid latitude less than -90",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ latitude: -90.000001 }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_048 - Invalid longitude greater than 180", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_048",
        description: "Invalid longitude greater than 180",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ longitude: 180.000001 }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_049 - Invalid longitude less than -180", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_049",
        description: "Invalid longitude less than -180",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({
        longitude: -180.000001,
      }) as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_050 - Create INTERNATIONAL airport successfully", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_050",
        description: "Create INTERNATIONAL airport successfully",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({
        type: AirportType.INTERNATIONAL,
      }) as unknown as Record<string, unknown>,
    );

    expect(body.data.type).toBe(AirportType.INTERNATIONAL);
  });

  it("TC_AIRPORT_CREATE_051 - Create DOMESTIC airport successfully", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_051",
        description: "Create DOMESTIC airport successfully",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({
        type: AirportType.DOMESTIC,
      }) as unknown as Record<string, unknown>,
    );

    expect(body.data.type).toBe(AirportType.DOMESTIC);
  });

  it("TC_AIRPORT_CREATE_052 - Create inactive airport successfully", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_052",
        description: "Create inactive airport successfully",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ isActive: false }) as unknown as Record<
        string,
        unknown
      >,
    );

    expect(body.data.isActive).toBe(false);
  });

  it("TC_AIRPORT_CREATE_053 - Create active airport successfully", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_053",
        description: "Create active airport successfully",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ isActive: true }) as unknown as Record<
        string,
        unknown
      >,
    );

    expect(body.data.isActive).toBe(true);
  });

  it("TC_AIRPORT_CREATE_054 - Lowercase IATA code normalization handling", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload({ iataCode: "abc" });

    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_054",
        description: "Lowercase IATA code normalization handling",
        expectedStatus: 201,
      },
      accessToken,
      payload as unknown as Record<string, unknown>,
    );

    expect(body.data.iataCode).toBe("ABC");
  });

  it("TC_AIRPORT_CREATE_055 - Lowercase ICAO code normalization handling", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload({ icaoCode: "omdb" });

    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_055",
        description: "Lowercase ICAO code normalization handling",
        expectedStatus: 201,
      },
      accessToken,
      payload as unknown as Record<string, unknown>,
    );

    expect(body.data.icaoCode).toBe("OMDB");
  });

  it("TC_AIRPORT_CREATE_056 - Lowercase countryCode normalization handling", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload({ countryCode: "in" });

    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_056",
        description: "Lowercase countryCode normalization handling",
        expectedStatus: 201,
      },
      accessToken,
      payload as unknown as Record<string, unknown>,
    );

    expect(body.data.countryCode).toBe("IN");
  });

  it("TC_AIRPORT_CREATE_057 - Create airport with optional address omitted", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload();
    const { address: _address, ...withoutAddress } = payload;

    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_057",
        description: "Create airport with optional address omitted",
        expectedStatus: 201,
      },
      accessToken,
      withoutAddress as unknown as Record<string, unknown>,
    );
  });

  it("TC_AIRPORT_CREATE_058 - Create airport with missing postalCode field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload();
    const source = payload as unknown as Record<string, unknown>;
    const { postalCode: _postalCode, ...withoutPostalCode } = source;

    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_058",
        description: "Create airport with missing postalCode field",
        expectedStatus: 400,
      },
      accessToken,
      withoutPostalCode,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_059 - Create airport with valid address field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload({
      address: "Terminal 2, Chhatrapati Shivaji Maharaj International Airport",
    });

    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_059",
        description: "Create airport with valid address field",
        expectedStatus: 201,
      },
      accessToken,
      payload as unknown as Record<string, unknown>,
    );

    expect(body.data.address).toBe(payload.address);
  });

  it("TC_AIRPORT_CREATE_060 - Create airport with valid postalCode field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload({ postalCode: "110037" });

    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_060",
        description: "Create airport with valid postalCode field",
        expectedStatus: 201,
      },
      accessToken,
      payload as unknown as Record<string, unknown>,
    );

    expect(body.data.postalCode).toBe(payload.postalCode);
  });

  const optionalFieldEdgeCases: Array<{
    id: string;
    description: string;
    payloadPatch: Record<string, unknown>;
    expectedStatus: number;
  }> = [
    {
      id: "TC_AIRPORT_CREATE_061",
      description: "Create airport with empty optional address field",
      payloadPatch: { address: "" },
      expectedStatus: 201,
    },
    {
      id: "TC_AIRPORT_CREATE_062",
      description: "Create airport with empty postalCode field",
      payloadPatch: { postalCode: "" },
      expectedStatus: 400,
    },
    {
      id: "TC_AIRPORT_CREATE_063",
      description: "Create airport with null address field",
      payloadPatch: { address: null },
      expectedStatus: 201,
    },
    {
      id: "TC_AIRPORT_CREATE_064",
      description: "Create airport with null postalCode field",
      payloadPatch: { postalCode: null },
      expectedStatus: 400,
    },
  ];

  for (const testCase of optionalFieldEdgeCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const accessToken = await createSuperAdminAccessToken(app);

      if (testCase.expectedStatus === 201) {
        await expectCreateAirportSuccess(
          app,
          {
            id: testCase.id,
            description: testCase.description,
            expectedStatus: testCase.expectedStatus,
          },
          accessToken,
          {
            ...(buildCreateAirportPayload() as unknown as Record<
              string,
              unknown
            >),
            ...testCase.payloadPatch,
          },
          testCase.expectedStatus,
        );
      } else {
        await expectCreateAirportError(
          app,
          {
            id: testCase.id,
            description: testCase.description,
            expectedStatus: testCase.expectedStatus,
          },
          accessToken,
          {
            ...(buildCreateAirportPayload() as unknown as Record<
              string,
              unknown
            >),
            ...testCase.payloadPatch,
          },
          testCase.expectedStatus,
        );
      }
    });
  }

  const lengthValidationCases: Array<{
    id: string;
    description: string;
    payload: Partial<AirportPayload>;
  }> = [
    {
      id: "TC_AIRPORT_CREATE_065",
      description: "Airport name exceeding maximum allowed length",
      payload: { name: "A".repeat(151) },
    },
    {
      id: "TC_AIRPORT_CREATE_066",
      description: "City exceeding maximum allowed length",
      payload: { city: "B".repeat(101) },
    },
    {
      id: "TC_AIRPORT_CREATE_067",
      description: "Address exceeding maximum allowed length",
      payload: { address: "C".repeat(256) },
    },
    {
      id: "TC_AIRPORT_CREATE_068",
      description: "PostalCode exceeding maximum allowed length",
      payload: { postalCode: "9".repeat(21) },
    },
  ];

  for (const testCase of lengthValidationCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const accessToken = await createSuperAdminAccessToken(app);

      await expectCreateAirportError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        buildCreateAirportPayload(testCase.payload) as unknown as Record<
          string,
          unknown
        >,
        400,
      );
    });
  }

  it("TC_AIRPORT_CREATE_069 - Create airport with Unicode airport name", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_069",
        description: "Create airport with Unicode airport name",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({
        name: "Aeroporto Sao Jose",
      }) as unknown as Record<string, unknown>,
    );
  });

  it("TC_AIRPORT_CREATE_070 - Create airport with Unicode city name", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_070",
        description: "Create airport with Unicode city name",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ city: "Sao Paulo" }) as unknown as Record<
        string,
        unknown
      >,
    );
  });

  it("TC_AIRPORT_CREATE_071 - Create airport with Unicode address value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_071",
        description: "Create airport with Unicode address value",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({
        address: "Rua Joao Pessoa, Sao Paulo",
      }) as unknown as Record<string, unknown>,
    );
  });

  it("TC_AIRPORT_CREATE_072 - Whitespace-only name field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_072",
        description: "Whitespace-only name field",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ name: "   " }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_073 - Whitespace-only city field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_073",
        description: "Whitespace-only city field",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ city: "   " }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_074 - Whitespace-only timezone field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_074",
        description: "Whitespace-only timezone field",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ timezone: "   " }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_075 - Malformed JSON payload", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const meta: TestCaseMeta = {
      id: "TC_AIRPORT_CREATE_075",
      description: "Malformed JSON payload",
      expectedStatus: 400,
    };

    let actualStatus = 0;
    try {
      const response = await request(app.getHttpServer())
        .post(CREATE_AIRPORT_ENDPOINT)
        .set("x-request-id", "e2e-request")
        .set("content-type", "application/json")
        .set("authorization", `Bearer ${accessToken}`)
        .send('{"name":"Broken Airport"');

      actualStatus = response.status;
      responseHelper.expectError(response, 400);
      loggerHelper.pass(meta, actualStatus, "Malformed JSON rejected");
    } catch (error) {
      loggerHelper.fail(
        meta,
        actualStatus,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  });

  it("TC_AIRPORT_CREATE_076 - Additional unknown fields in payload", async () => {
    const accessToken = await createSuperAdminAccessToken(app);

    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_076",
        description: "Additional unknown fields in payload",
        expectedStatus: 400,
      },
      accessToken,
      {
        ...(buildCreateAirportPayload() as unknown as Record<string, unknown>),
        unknownField: "unexpected",
      },
      400,
    );
  });

  it("TC_AIRPORT_CREATE_077 - SQL injection attempt in airport name", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_077",
        description: "SQL injection attempt in airport name",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({
        name: "Airport'; DROP TABLE airports; --",
      }) as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_078 - SQL injection attempt in IATA code", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_078",
        description: "SQL injection attempt in IATA code",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ iataCode: "A'1" }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_079 - Script injection attempt in airport name", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_079",
        description: "Script injection attempt in airport name",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({
        name: "<script>alert(1)</script>",
      }) as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_080 - Script injection attempt in address field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_080",
        description: "Script injection attempt in address field",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({
        address: "<img src=x onerror=alert(1)>",
      }) as unknown as Record<string, unknown>,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_081 - Create airport response contains airport id", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_081",
        description: "Create airport response contains airport id",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
    );

    expect(body.data.id).toBeDefined();
  });

  it("TC_AIRPORT_CREATE_082 - Create airport response contains createdBy field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_082",
        description: "Create airport response contains createdBy field",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
    );

    expect(body.data.createdBy).toBeDefined();
  });

  it("TC_AIRPORT_CREATE_083 - Create airport response contains updatedBy field", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_083",
        description: "Create airport response contains updatedBy field",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
    );

    expect(body.data.updatedBy).toBeDefined();
  });

  it("TC_AIRPORT_CREATE_084 - Create airport response contains createdAt timestamp", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_084",
        description: "Create airport response contains createdAt timestamp",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
    );

    expect(typeof body.data.createdAt).toBe("string");
  });

  it("TC_AIRPORT_CREATE_085 - Create airport response contains updatedAt timestamp", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_085",
        description: "Create airport response contains updatedAt timestamp",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload() as unknown as Record<string, unknown>,
    );

    expect(typeof body.data.updatedAt).toBe("string");
  });

  it("TC_AIRPORT_CREATE_086 - Create airport response contains normalized IATA code", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_086",
        description: "Create airport response contains normalized IATA code",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ iataCode: "bom" }) as unknown as Record<
        string,
        unknown
      >,
    );

    expect(body.data.iataCode).toBe("BOM");
  });

  it("TC_AIRPORT_CREATE_087 - Create airport response contains normalized ICAO code", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_087",
        description: "Create airport response contains normalized ICAO code",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ icaoCode: "vabb" }) as unknown as Record<
        string,
        unknown
      >,
    );

    expect(body.data.icaoCode).toBe("VABB");
  });

  it("TC_AIRPORT_CREATE_088 - Create airport response contains normalized countryCode", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_088",
        description: "Create airport response contains normalized countryCode",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ countryCode: "ae" }) as unknown as Record<
        string,
        unknown
      >,
    );

    expect(body.data.countryCode).toBe("AE");
  });

  it("TC_AIRPORT_CREATE_089 - Create airport with decimal latitude and longitude precision", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const payload = buildCreateAirportPayload({
      latitude: 25.2531745,
      longitude: 55.3656722,
    });

    const { body } = await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_089",
        description:
          "Create airport with decimal latitude and longitude precision",
        expectedStatus: 201,
      },
      accessToken,
      payload as unknown as Record<string, unknown>,
    );

    expect(typeof body.data.latitude).toBe("number");
    expect(typeof body.data.longitude).toBe("number");
  });

  it("TC_AIRPORT_CREATE_090 - Create airport with boundary latitude value 90", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_090",
        description: "Create airport with boundary latitude value 90",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ latitude: 90 }) as unknown as Record<
        string,
        unknown
      >,
    );
  });

  it("TC_AIRPORT_CREATE_091 - Create airport with boundary latitude value -90", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_091",
        description: "Create airport with boundary latitude value -90",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ latitude: -90 }) as unknown as Record<
        string,
        unknown
      >,
    );
  });

  it("TC_AIRPORT_CREATE_092 - Create airport with boundary longitude value 180", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_092",
        description: "Create airport with boundary longitude value 180",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ longitude: 180 }) as unknown as Record<
        string,
        unknown
      >,
    );
  });

  it("TC_AIRPORT_CREATE_093 - Create airport with boundary longitude value -180", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_093",
        description: "Create airport with boundary longitude value -180",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ longitude: -180 }) as unknown as Record<
        string,
        unknown
      >,
    );
  });

  it("TC_AIRPORT_CREATE_094 - Create airport with duplicate airport name but unique codes", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const name = `Shared Airport Name ${Date.now()}`;

    const first = await createAirport(
      app,
      accessToken,
      buildCreateAirportPayload({ name }) as unknown as Record<string, unknown>,
    );
    responseHelper.expectSuccess(first.response, 201);

    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_094",
        description:
          "Create airport with duplicate airport name but unique codes",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ name }) as unknown as Record<string, unknown>,
    );
  });

  it("TC_AIRPORT_CREATE_095 - Create airport with same city but unique codes", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const city = "Delhi";

    const first = await createAirport(
      app,
      accessToken,
      buildCreateAirportPayload({ city }) as unknown as Record<string, unknown>,
    );
    responseHelper.expectSuccess(first.response, 201);

    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_095",
        description: "Create airport with same city but unique codes",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ city }) as unknown as Record<string, unknown>,
    );
  });

  it("TC_AIRPORT_CREATE_096 - Create airport with reused postalCode value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const postalCode = "500001";

    const first = await createAirport(
      app,
      accessToken,
      buildCreateAirportPayload({ postalCode }) as unknown as Record<
        string,
        unknown
      >,
    );
    responseHelper.expectSuccess(first.response, 201);

    await expectCreateAirportSuccess(
      app,
      {
        id: "TC_AIRPORT_CREATE_096",
        description: "Create airport with reused postalCode value",
        expectedStatus: 201,
      },
      accessToken,
      buildCreateAirportPayload({ postalCode }) as unknown as Record<
        string,
        unknown
      >,
    );
  });

  it("TC_AIRPORT_CREATE_097 - Create airport concurrently with same IATA code should create only one airport", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const seedPayload = buildCreateAirportPayload();

    const payloadA = buildCreateAirportPayload({
      iataCode: seedPayload.iataCode,
      icaoCode: buildCreateAirportPayload().icaoCode,
    });

    const payloadB = buildCreateAirportPayload({
      iataCode: seedPayload.iataCode,
      icaoCode: buildCreateAirportPayload().icaoCode,
    });

    const [first, second] = await Promise.all([
      requestHelper.authorizedPost(
        app,
        CREATE_AIRPORT_ENDPOINT,
        payloadA as unknown as Record<string, unknown>,
        accessToken,
      ),
      requestHelper.authorizedPost(
        app,
        CREATE_AIRPORT_ENDPOINT,
        payloadB as unknown as Record<string, unknown>,
        accessToken,
      ),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
  });

  it("TC_AIRPORT_CREATE_098 - Create airport concurrently with same ICAO code should create only one airport", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    const seedPayload = buildCreateAirportPayload();

    const payloadA = buildCreateAirportPayload({
      icaoCode: seedPayload.icaoCode,
      iataCode: buildCreateAirportPayload().iataCode,
    });

    const payloadB = buildCreateAirportPayload({
      icaoCode: seedPayload.icaoCode,
      iataCode: buildCreateAirportPayload().iataCode,
    });

    const [first, second] = await Promise.all([
      requestHelper.authorizedPost(
        app,
        CREATE_AIRPORT_ENDPOINT,
        payloadA as unknown as Record<string, unknown>,
        accessToken,
      ),
      requestHelper.authorizedPost(
        app,
        CREATE_AIRPORT_ENDPOINT,
        payloadB as unknown as Record<string, unknown>,
        accessToken,
      ),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
  });

  it("TC_AIRPORT_CREATE_099 - Create airport with scientific notation latitude value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_099",
        description: "Create airport with scientific notation latitude value",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ latitude: "1e2" }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_100 - Create airport with scientific notation longitude value", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_100",
        description: "Create airport with scientific notation longitude value",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ longitude: "1e3" }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_101 - Invalid IATA code with non-letter character", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_101",
        description: "Invalid IATA code with non-letter character",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ iataCode: "A1B" }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });

  it("TC_AIRPORT_CREATE_102 - Invalid ICAO code with non-letter character", async () => {
    const accessToken = await createSuperAdminAccessToken(app);
    await expectCreateAirportError(
      app,
      {
        id: "TC_AIRPORT_CREATE_102",
        description: "Invalid ICAO code with non-letter character",
        expectedStatus: 400,
      },
      accessToken,
      buildCreateAirportPayload({ icaoCode: "AB1D" }) as unknown as Record<
        string,
        unknown
      >,
      400,
    );
  });
});
