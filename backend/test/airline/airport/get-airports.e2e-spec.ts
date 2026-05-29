import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
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
const GET_AIRPORTS_ENDPOINT = "/api/v1/airports";
const MAX_LIMIT = 200;

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
}

interface GetAirportsResponseData {
  airports: AirportResponseData[];
  total: number;
  currentPage: number;
  totalPages: number;
  limit: number;
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
    name: `Flyvoid Get Airport ${Date.now()}-${airportCounter}`,
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

const revokeAirportsViewAccess = async (
  app: INestApplication,
  adminId: number,
): Promise<void> => {
  const dataSource = app.get(DataSource);
  const usePostgresParams = dataSource.options.type === "postgres";
  const parameter = (index: number): string =>
    usePostgresParams ? `$${index + 1}` : "?";

  const query = `DELETE FROM platform_access_controls WHERE admin_id = ${parameter(0)} and asset = 'AIRPORTS' and access_action = 'VIEW'`;
  await dataSource.query(query, [adminId]);
};

const clearAirports = async (app: INestApplication): Promise<void> => {
  const dataSource = app.get(DataSource);
  await dataSource.query("DELETE FROM airports");
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

const seedAirportsDataset = async (
  app: INestApplication,
  accessToken: string,
): Promise<AirportResponseData[]> => {
  await clearAirports(app);

  const base: AirportPayload[] = [
    buildAirportPayload({
      name: "Dubai International Airport",
      iataCode: "DXB",
      icaoCode: "OMDB",
      countryCode: "AE",
      city: "Dubai",
      isActive: true,
      type: "INTERNATIONAL",
    }),
    buildAirportPayload({
      name: "Abu Dhabi International Airport",
      iataCode: "AUH",
      icaoCode: "OMAA",
      countryCode: "AE",
      city: "Abu Dhabi",
      isActive: false,
      type: "INTERNATIONAL",
    }),
    buildAirportPayload({
      name: "Chhatrapati Shivaji Maharaj International Airport",
      iataCode: "BOM",
      icaoCode: "VABB",
      countryCode: "IN",
      city: "Mumbai",
      isActive: true,
      type: "INTERNATIONAL",
    }),
    buildAirportPayload({
      name: "Indira Gandhi International Airport",
      iataCode: "DEL",
      icaoCode: "VIDP",
      countryCode: "IN",
      city: "Delhi",
      isActive: true,
      type: "INTERNATIONAL",
    }),
    buildAirportPayload({
      name: "Sao Paulo Aeroporto",
      iataCode: "CGH",
      icaoCode: "SBSP",
      countryCode: "BR",
      city: "Sao Paulo",
      isActive: false,
      type: "DOMESTIC",
    }),
  ];

  const seeded: AirportResponseData[] = [];
  for (const airport of base) {
    const created = await createAirport(
      app,
      accessToken,
      airport as unknown as Record<string, unknown>,
    );
    seeded.push(created.body.data);
  }

  return seeded;
};

const buildQueryString = (query: Record<string, unknown>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    params.append(key, String(value));
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
};

const getAirports = async (
  app: INestApplication,
  accessToken: string,
  query?: Record<string, unknown>,
) => {
  const path = `${GET_AIRPORTS_ENDPOINT}${query ? buildQueryString(query) : ""}`;
  return requestHelper.authorizedGet(app, path, accessToken);
};

const expectGetSuccess = async (
  app: INestApplication,
  meta: TestCaseMeta,
  accessToken: string,
  query?: Record<string, unknown>,
) => {
  let actualStatus = 0;

  try {
    const response = await getAirports(app, accessToken, query);
    actualStatus = response.status;
    const body = responseHelper.expectSuccess<GetAirportsResponseData>(
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

const expectGetError = async (
  app: INestApplication,
  meta: TestCaseMeta,
  accessToken: string,
  query: Record<string, unknown> | undefined,
  expectedStatus: number,
) => {
  let actualStatus = 0;

  try {
    const response = await getAirports(app, accessToken, query);
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

describe("Get All Airports API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    loggerHelper.suite("Get All Airports API");
  });

  afterAll(async () => {
    await app.close();
  });

  it("TC_AIRPORT_GET_ALL_001 - Get airports by SUPER_ADMIN successfully", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    await seedAirportsDataset(app, accessToken);

    await expectGetSuccess(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_001",
        description: "Get airports by SUPER_ADMIN successfully",
        expectedStatus: 200,
      },
      accessToken,
    );
  });

  it("TC_AIRPORT_GET_ALL_002 - Get airports by STAFF admin with AIRPORTS VIEW access successfully", async () => {
    const seeder = await createSuperAdminSession(app);
    await seedAirportsDataset(app, seeder.accessToken);
    const { accessToken } = await createStaffAdminSession(app);

    await expectGetSuccess(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_002",
        description:
          "Get airports by STAFF admin with AIRPORTS VIEW access successfully",
        expectedStatus: 200,
      },
      accessToken,
    );
  });

  it("TC_AIRPORT_GET_ALL_003 - Get airports by inactive admin should fail", async () => {
    const accessToken = await createInactiveSuperAdminAccessToken(app);

    await expectGetError(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_003",
        description: "Get airports by inactive admin should fail",
        expectedStatus: 403,
      },
      accessToken,
      undefined,
      403,
    );
  });

  it("TC_AIRPORT_GET_ALL_004 - Get airports without access token", async () => {
    const response = await requestHelper.get(app, GET_AIRPORTS_ENDPOINT);
    responseHelper.expectError(response, 401);
  });

  it("TC_AIRPORT_GET_ALL_005 - Get airports with invalid access token", async () => {
    await expectGetError(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_005",
        description: "Get airports with invalid access token",
        expectedStatus: 401,
      },
      tokenHelper.invalid(),
      undefined,
      401,
    );
  });

  it("TC_AIRPORT_GET_ALL_006 - Get airports with expired access token", async () => {
    const token = await tokenHelper.expiredAdminAccess();

    await expectGetError(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_006",
        description: "Get airports with expired access token",
        expectedStatus: 401,
      },
      token,
      undefined,
      401,
    );
  });

  it("TC_AIRPORT_GET_ALL_007 - Get airports by STAFF admin without AIRPORTS VIEW access", async () => {
    const { adminId, accessToken } = await createStaffAdminSession(app);
    await revokeAirportsViewAccess(app, adminId);

    await expectGetError(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_007",
        description: "Get airports by STAFF admin without AIRPORTS VIEW access",
        expectedStatus: 403,
      },
      accessToken,
      undefined,
      403,
    );
  });

  it("TC_AIRPORT_GET_ALL_008 - Get airports by unauthorized role user", async () => {
    const airline = await airlineSeeder.seedOnboardedAirlineAdmin(app);
    const session = await authHelper.signinAirline(app, {
      email: airline.email,
      password: airline.password,
    });

    await expectGetError(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_008",
        description: "Get airports by unauthorized role user",
        expectedStatus: 403,
      },
      session.accessToken,
      undefined,
      403,
    );
  });

  it("TC_AIRPORT_GET_ALL_009 - Get airports with default pagination", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    await seedAirportsDataset(app, accessToken);

    const { body } = await expectGetSuccess(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_009",
        description: "Get airports with default pagination",
        expectedStatus: 200,
      },
      accessToken,
    );

    expect(body.data.currentPage).toBe(1);
    expect(body.data.limit).toBe(10);
  });

  const paginationSuccessCases: Array<{
    id: string;
    description: string;
    query: Record<string, unknown>;
    verify?: (data: GetAirportsResponseData) => void;
  }> = [
    {
      id: "TC_AIRPORT_GET_ALL_010",
      description: "Get airports with custom page and limit",
      query: { page: 1, limit: 2 },
      verify: (data) => {
        expect(data.currentPage).toBe(1);
        expect(data.limit).toBe(2);
      },
    },
    {
      id: "TC_AIRPORT_GET_ALL_011",
      description: "Get airports with page=1",
      query: { page: 1 },
      verify: (data) => expect(data.currentPage).toBe(1),
    },
    {
      id: "TC_AIRPORT_GET_ALL_012",
      description: "Get airports with limit=1",
      query: { limit: 1 },
      verify: (data) => expect(data.limit).toBe(1),
    },
    {
      id: "TC_AIRPORT_GET_ALL_013",
      description: "Get airports with maximum allowed limit",
      query: { limit: MAX_LIMIT },
      verify: (data) => expect(data.limit).toBe(MAX_LIMIT),
    },
    {
      id: "TC_AIRPORT_GET_ALL_014",
      description: "Get airports with page greater than total pages",
      query: { page: 999, limit: 5 },
      verify: (data) => expect(data.airports.length).toBe(0),
    },
  ];

  for (const testCase of paginationSuccessCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { accessToken } = await createSuperAdminSession(app);
      await seedAirportsDataset(app, accessToken);

      const { body } = await expectGetSuccess(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 200,
        },
        accessToken,
        testCase.query,
      );

      testCase.verify?.(body.data);
    });
  }

  const paginationErrorCases: Array<{
    id: string;
    description: string;
    query: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_GET_ALL_015",
      description: "Get airports with page=0",
      query: { page: 0 },
    },
    {
      id: "TC_AIRPORT_GET_ALL_016",
      description: "Get airports with negative page number",
      query: { page: -1 },
    },
    {
      id: "TC_AIRPORT_GET_ALL_017",
      description: "Get airports with invalid page format",
      query: { page: "abc" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_018",
      description: "Get airports with limit=0",
      query: { limit: 0 },
    },
    {
      id: "TC_AIRPORT_GET_ALL_019",
      description: "Get airports with negative limit value",
      query: { limit: -5 },
    },
    {
      id: "TC_AIRPORT_GET_ALL_020",
      description: "Get airports with invalid limit format",
      query: { limit: "ten" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_067",
      description: "Get airports with limit exceeding maximum allowed value",
      query: { limit: MAX_LIMIT + 1 },
    },
    {
      id: "TC_AIRPORT_GET_ALL_068",
      description: "Get airports with decimal page value",
      query: { page: "1.5" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_069",
      description: "Get airports with decimal limit value",
      query: { limit: "1.5" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_070",
      description: "Get airports with scientific notation page value",
      query: { page: "1e2" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_071",
      description: "Get airports with scientific notation limit value",
      query: { limit: "1e2" },
    },
  ];

  for (const testCase of paginationErrorCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { accessToken } = await createSuperAdminSession(app);
      await expectGetError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        testCase.query,
        400,
      );
    });
  }

  const filterCases: Array<{
    id: string;
    description: string;
    query: Record<string, unknown>;
    verify: (data: GetAirportsResponseData) => void;
  }> = [
    {
      id: "TC_AIRPORT_GET_ALL_021",
      description: "Get airports filtered by valid countryCode",
      query: { countryCode: "AE", page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.every((airport) => airport.countryCode === "AE"),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_022",
      description:
        "Get airports filtered by lowercase countryCode normalization handling",
      query: { countryCode: "ae", page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.every((airport) => airport.countryCode === "AE"),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_024",
      description: "Get airports filtered by non-existing countryCode",
      query: { countryCode: "ZZ", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBe(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_025",
      description: "Get airports filtered by status=true",
      query: { status: true, page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.every((airport) => airport.isActive === true),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_026",
      description: "Get airports filtered by status=false",
      query: { status: false, page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.every((airport) => airport.isActive === false),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_027",
      description: "Get airports filtered by status=active",
      query: { status: "active", page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.every((airport) => airport.isActive === true),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_028",
      description: "Get airports filtered by status=inactive",
      query: { status: "inactive", page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.every((airport) => airport.isActive === false),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_030",
      description: "Get airports filtered by search using airport name",
      query: { search: "Dubai International Airport", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBeGreaterThan(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_031",
      description: "Get airports filtered by search using IATA code",
      query: { search: "DXB", page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.some((airport) => airport.iataCode === "DXB"),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_032",
      description: "Get airports filtered by search using ICAO code",
      query: { search: "OMDB", page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.some((airport) => airport.icaoCode === "OMDB"),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_033",
      description: "Get airports filtered by search using city name",
      query: { search: "Dubai", page: 1, limit: 20 },
      verify: (data) =>
        expect(data.airports.some((airport) => airport.city === "Dubai")).toBe(
          true,
        ),
    },
    {
      id: "TC_AIRPORT_GET_ALL_034",
      description: "Get airports filtered by search using countryCode",
      query: { search: "AE", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBeGreaterThan(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_035",
      description: "Get airports filtered by partial airport name search",
      query: { search: "International", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBeGreaterThan(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_036",
      description: "Get airports filtered by partial city search",
      query: { search: "Mum", page: 1, limit: 20 },
      verify: (data) =>
        expect(data.airports.some((airport) => airport.city === "Mumbai")).toBe(
          true,
        ),
    },
    {
      id: "TC_AIRPORT_GET_ALL_037",
      description: "Get airports filtered by lowercase search term",
      query: { search: "dubai", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBeGreaterThan(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_038",
      description: "Get airports filtered by uppercase search term",
      query: { search: "DUBAI", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBeGreaterThan(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_039",
      description: "Get airports filtered by mixed-case search term",
      query: { search: "DuBaI", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBeGreaterThan(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_040",
      description: "Get airports with non-existing search value",
      query: { search: "NoSuchAirportValue", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBe(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_043",
      description: "Get airports with Unicode search value",
      query: { search: "Sao", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBeGreaterThan(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_044",
      description: "Get airports using combined countryCode and status filters",
      query: { countryCode: "AE", status: "active", page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.every(
            (airport) => airport.countryCode === "AE" && airport.isActive,
          ),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_045",
      description: "Get airports using combined countryCode and search filters",
      query: { countryCode: "AE", search: "Dubai", page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.every((airport) => airport.countryCode === "AE"),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_046",
      description: "Get airports using combined status and search filters",
      query: { status: "inactive", search: "Sao", page: 1, limit: 20 },
      verify: (data) =>
        expect(
          data.airports.every((airport) => airport.isActive === false),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_047",
      description: "Get airports using all filters together",
      query: {
        countryCode: "AE",
        status: "active",
        search: "Dubai",
        page: 1,
        limit: 20,
      },
      verify: (data) =>
        expect(
          data.airports.every(
            (airport) =>
              airport.countryCode === "AE" &&
              airport.isActive === true &&
              airport.name.includes("Dubai"),
          ),
        ).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_077",
      description: "Get airports with trailing whitespace in search parameter",
      query: { search: "Dubai   ", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBeGreaterThan(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_078",
      description: "Get airports with leading whitespace in search parameter",
      query: { search: "   Dubai", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBeGreaterThan(0),
    },
    {
      id: "TC_AIRPORT_GET_ALL_079",
      description: "Get airports with URL encoded search parameter",
      query: { search: "Dubai International", page: 1, limit: 20 },
      verify: (data) => expect(data.airports.length).toBeGreaterThan(0),
    },
  ];

  for (const testCase of filterCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { accessToken } = await createSuperAdminSession(app);
      await seedAirportsDataset(app, accessToken);

      const { body } = await expectGetSuccess(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 200,
        },
        accessToken,
        testCase.query,
      );

      testCase.verify(body.data);
    });
  }

  const filterErrorCases: Array<{
    id: string;
    description: string;
    query: Record<string, unknown>;
  }> = [
    {
      id: "TC_AIRPORT_GET_ALL_023",
      description: "Get airports filtered by invalid countryCode format",
      query: { countryCode: "IND" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_029",
      description: "Get airports filtered by invalid status value",
      query: { status: "enabled" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_041",
      description: "Get airports with empty search value",
      query: { search: "" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_042",
      description: "Get airports with whitespace-only search value",
      query: { search: "   " },
    },
    {
      id: "TC_AIRPORT_GET_ALL_072",
      description: "Get airports with malformed query parameters",
      query: { "page[foo]": 1 },
    },
    {
      id: "TC_AIRPORT_GET_ALL_073",
      description:
        "Get airports with SQL injection attempt in search parameter",
      query: { search: "Airport' OR 1=1 --" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_074",
      description:
        "Get airports with SQL injection attempt in countryCode parameter",
      query: { countryCode: "A'" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_075",
      description:
        "Get airports with script injection attempt in search parameter",
      query: { search: "<script>alert(1)</script>" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_085",
      description:
        "Get airports with SQL injection UNION attempt in search parameter",
      query: { search: "x' UNION SELECT * FROM airports --" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_086",
      description:
        "Get airports with SQL injection comment pattern in search parameter",
      query: { search: "admin' /* */ OR '1'='1" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_087",
      description:
        "Get airports with encoded script payload in search parameter",
      query: { search: "%3Cscript%3Ealert(1)%3C/script%3E" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_088",
      description:
        "Get airports with javascript URI payload in search parameter",
      query: { search: "javascript:alert(1)" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_081",
      description:
        "Get airports with SQL injection attempt in status parameter",
      query: { status: "true OR 1=1" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_082",
      description:
        "Get airports with script injection attempt in countryCode parameter",
      query: { countryCode: "<script>" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_083",
      description: "Get airports with SQL injection attempt in page parameter",
      query: { page: "1 OR 1=1" },
    },
    {
      id: "TC_AIRPORT_GET_ALL_084",
      description:
        "Get airports with script injection attempt in limit parameter",
      query: { limit: "<img src=x onerror=alert(1)>" },
    },
  ];

  for (const testCase of filterErrorCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { accessToken } = await createSuperAdminSession(app);
      await expectGetError(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 400,
        },
        accessToken,
        testCase.query,
        400,
      );
    });
  }

  it("TC_AIRPORT_GET_ALL_076 - Get airports with duplicate query parameters", async () => {
    const { accessToken } = await createSuperAdminSession(app);

    const response = await requestHelper.authorizedGet(
      app,
      `${GET_AIRPORTS_ENDPOINT}?page=1&page=2`,
      accessToken,
    );

    responseHelper.expectError(response, 400);
  });

  const responseShapeCases: Array<{
    id: string;
    description: string;
    verify: (data: GetAirportsResponseData) => void;
  }> = [
    {
      id: "TC_AIRPORT_GET_ALL_048",
      description: "Get airports response contains airports array",
      verify: (data) => expect(Array.isArray(data.airports)).toBe(true),
    },
    {
      id: "TC_AIRPORT_GET_ALL_049",
      description: "Get airports response contains total count",
      verify: (data) => expect(typeof data.total).toBe("number"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_050",
      description: "Get airports response contains currentPage",
      verify: (data) => expect(typeof data.currentPage).toBe("number"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_051",
      description: "Get airports response contains totalPages",
      verify: (data) => expect(typeof data.totalPages).toBe("number"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_052",
      description: "Get airports response contains limit value",
      verify: (data) => expect(typeof data.limit).toBe("number"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_053",
      description: "Get airports response contains airport id field",
      verify: (data) => expect(typeof data.airports[0]?.id).toBe("number"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_054",
      description: "Get airports response contains airport name field",
      verify: (data) => expect(typeof data.airports[0]?.name).toBe("string"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_055",
      description: "Get airports response contains IATA code field",
      verify: (data) =>
        expect(typeof data.airports[0]?.iataCode).toBe("string"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_056",
      description: "Get airports response contains ICAO code field",
      verify: (data) =>
        expect(typeof data.airports[0]?.icaoCode).toBe("string"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_057",
      description: "Get airports response contains countryCode field",
      verify: (data) =>
        expect(typeof data.airports[0]?.countryCode).toBe("string"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_058",
      description: "Get airports response contains city field",
      verify: (data) => expect(typeof data.airports[0]?.city).toBe("string"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_059",
      description: "Get airports response contains latitude field",
      verify: (data) =>
        expect(typeof data.airports[0]?.latitude).toBe("number"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_060",
      description: "Get airports response contains longitude field",
      verify: (data) =>
        expect(typeof data.airports[0]?.longitude).toBe("number"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_061",
      description: "Get airports response contains timezone field",
      verify: (data) =>
        expect(typeof data.airports[0]?.timezone).toBe("string"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_062",
      description: "Get airports response contains isActive field",
      verify: (data) =>
        expect(typeof data.airports[0]?.isActive).toBe("boolean"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_063",
      description: "Get airports response contains airport type field",
      verify: (data) => expect(typeof data.airports[0]?.type).toBe("string"),
    },
    {
      id: "TC_AIRPORT_GET_ALL_064",
      description: "Get airports response contains address field",
      verify: (data) => {
        const address = data.airports[0]?.address;
        expect(address === null || typeof address === "string").toBe(true);
      },
    },
    {
      id: "TC_AIRPORT_GET_ALL_065",
      description: "Get airports response contains postalCode field",
      verify: (data) => {
        const postalCode = data.airports[0]?.postalCode;
        expect(postalCode === null || typeof postalCode === "string").toBe(
          true,
        );
      },
    },
  ];

  for (const testCase of responseShapeCases) {
    it(`${testCase.id} - ${testCase.description}`, async () => {
      const { accessToken } = await createSuperAdminSession(app);
      await seedAirportsDataset(app, accessToken);

      const { body } = await expectGetSuccess(
        app,
        {
          id: testCase.id,
          description: testCase.description,
          expectedStatus: 200,
        },
        accessToken,
        { page: 1, limit: 20 },
      );

      expect(body.data.airports.length).toBeGreaterThan(0);
      testCase.verify(body.data);
    });
  }

  it("TC_AIRPORT_GET_ALL_066 - Get airports sorted consistently across pagination requests", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    await seedAirportsDataset(app, accessToken);

    const firstPage = await expectGetSuccess(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_066",
        description:
          "Get airports sorted consistently across pagination requests",
        expectedStatus: 200,
      },
      accessToken,
      { page: 1, limit: 2 },
    );

    const secondPage = await expectGetSuccess(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_066",
        description:
          "Get airports sorted consistently across pagination requests",
        expectedStatus: 200,
      },
      accessToken,
      { page: 2, limit: 2 },
    );

    const firstPageIds = firstPage.body.data.airports.map(
      (airport) => airport.id,
    );
    const secondPageIds = secondPage.body.data.airports.map(
      (airport) => airport.id,
    );

    const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
    expect(overlap.length).toBe(0);
  });

  it("TC_AIRPORT_GET_ALL_080 - Get airports returns empty array when no airports exist", async () => {
    const { accessToken } = await createSuperAdminSession(app);
    await clearAirports(app);

    const { body } = await expectGetSuccess(
      app,
      {
        id: "TC_AIRPORT_GET_ALL_080",
        description: "Get airports returns empty array when no airports exist",
        expectedStatus: 200,
      },
      accessToken,
      { page: 1, limit: 20 },
    );

    expect(body.data.airports).toEqual([]);
    expect(body.data.total).toBe(0);
    expect(body.data.totalPages).toBe(0);
  });
});
