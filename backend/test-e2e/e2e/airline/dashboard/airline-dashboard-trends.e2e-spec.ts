import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { getAdminTokens } from "../../../helpers/auth.helper";
import { getAirlineTokens } from "../../../helpers/airline-auth.helper";
import { insertActiveAdmin } from "../../../seeders/admin.seeder";
import { insertAirlineUserRow } from "../../../seeders/airline-invitation.seeder";
import {
  DashboardFlightStatus,
  deleteDashboardData,
  grantAirlineAccess,
  insertDashboardAirline,
  insertDashboardAirport,
  insertDashboardCancelledFlight,
} from "../../../seeders/airline-dashboard.seeder";

const EMAIL_PATTERN = "%@e2e-dashboard.test";
const TEST_PASSWORD = "Password@123";
const BASE_PATH = "/api/v1/dashboard/airline";

// Airline A uses Colombo: UTC+05:30 all year (no DST), so expected local
// buckets can be computed with a fixed offset.
const COLOMBO = "Asia/Colombo";
const COLOMBO_OFFSET_MS = 330 * 60_000;
const HOUR_MS = 60 * 60_000;

type Granularity = "hour" | "day" | "month" | "year";
type Metric = "spend" | "passengers" | "flights";

interface SeededFlight {
  status: DashboardFlightStatus;
  createdAt: Date;
  adults: number;
  children: number;
  price: number;
}

const ENDPOINTS: { path: string; field: Metric }[] = [
  { path: "hotel-spend-trend", field: "spend" },
  { path: "affected-passengers-trend", field: "passengers" },
  { path: "cancelled-flights-trend", field: "flights" },
];

const TIME_FRAMES: { timeFrame: string; granularity: Granularity }[] = [
  { timeFrame: "today", granularity: "hour" },
  { timeFrame: "yesterday", granularity: "hour" },
  { timeFrame: "week", granularity: "day" },
  { timeFrame: "month", granularity: "month" },
  { timeFrame: "year", granularity: "year" },
];

const SPEND_STATUSES: DashboardFlightStatus[] = [
  "allocated",
  "paid",
  "published",
];

const pad = (value: number) => String(value).padStart(2, "0");

/** Colombo wall clock, read through the UTC getters of the returned Date. */
const colomboWallClock = (instant: Date) =>
  new Date(instant.getTime() + COLOMBO_OFFSET_MS);

function colomboBucketKey(instant: Date, granularity: Granularity): string {
  const local = colomboWallClock(instant);
  const year = String(local.getUTCFullYear());
  const month = `${year}-${pad(local.getUTCMonth() + 1)}`;
  const day = `${month}-${pad(local.getUTCDate())}`;
  switch (granularity) {
    case "hour":
      return `${day}T${pad(local.getUTCHours())}:00`;
    case "day":
      return day;
    case "month":
      return month;
    case "year":
      return year;
  }
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Weekday name for week (day) buckets, month name for month buckets. */
function expectedLabel(bucket: string, granularity: Granularity): string {
  switch (granularity) {
    case "hour":
      return bucket.split("T")[1];
    case "day":
      return WEEKDAYS[new Date(`${bucket}T00:00:00Z`).getUTCDay()];
    case "month":
      return MONTHS[Number(bucket.slice(5, 7)) - 1];
    case "year":
      return bucket;
  }
}

function metricValue(flight: SeededFlight, metric: Metric): number {
  if (metric === "spend") {
    return SPEND_STATUSES.includes(flight.status) ? flight.price : 0;
  }
  if (flight.status === "draft") {
    return 0;
  }
  return metric === "passengers" ? flight.adults + flight.children : 1;
}

function expectedValues(
  flights: SeededFlight[],
  metric: Metric,
  granularity: Granularity,
): Map<string, number> {
  const values = new Map<string, number>();
  for (const flight of flights) {
    const key = colomboBucketKey(flight.createdAt, granularity);
    values.set(key, (values.get(key) ?? 0) + metricValue(flight, metric));
  }
  return values;
}

function expectedBucketCount(timeFrame: string, now: Date): number {
  switch (timeFrame) {
    case "today":
      return colomboWallClock(now).getUTCHours() + 1;
    case "yesterday":
      return 24;
    case "week":
      return 7;
    case "month":
      return 12;
    default:
      return 6;
  }
}

describe("Airline dashboard trends", () => {
  const airlineIds: number[] = [];
  const airportIds: number[] = [];
  const flightsA: SeededFlight[] = [];

  let adminTokenA = "";
  let staffDashboardTokenA = "";
  let staffWithoutDashboardTokenA = "";
  let adminTokenB = "";
  let platformToken = "";

  let currentHourStart: Date;
  let yesterdayTenAm: Date;

  beforeAll(async () => {
    const suffix = `${Date.now()}`.slice(-8);

    const platformEmail = `dashboard-super-${suffix}@e2e-dashboard.test`;
    const platformAdmin = await insertActiveAdmin({
      email: platformEmail,
      password: TEST_PASSWORD,
      role: "SUPER_ADMIN",
    });
    platformToken = (await getAdminTokens(platformEmail, TEST_PASSWORD))
      .accessToken;

    const airportId = await insertDashboardAirport(platformAdmin.id);
    airportIds.push(airportId);

    const airlineA = await insertDashboardAirline({
      code: `E2EDA${suffix}`,
      contactEmail: `airline-a-${suffix}@e2e-dashboard.test`,
      timezone: COLOMBO,
      currency: "USD",
    });
    const airlineB = await insertDashboardAirline({
      code: `E2EDB${suffix}`,
      contactEmail: `airline-b-${suffix}@e2e-dashboard.test`,
      timezone: "UTC",
      currency: "EUR",
    });
    airlineIds.push(airlineA, airlineB);

    const adminEmailA = `admin-a-${suffix}@e2e-dashboard.test`;
    await insertAirlineUserRow({
      airlineId: airlineA,
      email: adminEmailA,
      password: TEST_PASSWORD,
      role: "AIRLINE_ADMIN",
    });

    const staffDashboardEmailA = `staff-dash-a-${suffix}@e2e-dashboard.test`;
    const staffDashboardIdA = await insertAirlineUserRow({
      airlineId: airlineA,
      email: staffDashboardEmailA,
      password: TEST_PASSWORD,
      role: "AIRLINE_STAFF",
    });
    await grantAirlineAccess(staffDashboardIdA, "DASHBOARD", "VIEW");

    const staffNoDashboardEmailA = `staff-nodash-a-${suffix}@e2e-dashboard.test`;
    const staffNoDashboardIdA = await insertAirlineUserRow({
      airlineId: airlineA,
      email: staffNoDashboardEmailA,
      password: TEST_PASSWORD,
      role: "AIRLINE_STAFF",
    });
    await grantAirlineAccess(staffNoDashboardIdA, "CANCELLED_FLIGHTS", "VIEW");

    const adminEmailB = `admin-b-${suffix}@e2e-dashboard.test`;
    await insertAirlineUserRow({
      airlineId: airlineB,
      email: adminEmailB,
      password: TEST_PASSWORD,
      role: "AIRLINE_ADMIN",
    });

    [adminTokenA, staffDashboardTokenA, staffWithoutDashboardTokenA, adminTokenB] =
      (
        await Promise.all([
          getAirlineTokens(adminEmailA, TEST_PASSWORD),
          getAirlineTokens(staffDashboardEmailA, TEST_PASSWORD),
          getAirlineTokens(staffNoDashboardEmailA, TEST_PASSWORD),
          getAirlineTokens(adminEmailB, TEST_PASSWORD),
        ])
      ).map((tokens) => tokens.accessToken);

    // Seed relative to "now" in Colombo: one second into the current local
    // hour (today) and 10:00 local yesterday.
    const now = new Date();
    const local = colomboWallClock(now);
    currentHourStart = new Date(
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate(),
        local.getUTCHours(),
      ) - COLOMBO_OFFSET_MS,
    );
    const currentHourFlightTime = new Date(currentHourStart.getTime() + 1000);
    yesterdayTenAm = new Date(
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate() - 1,
        10,
      ) - COLOMBO_OFFSET_MS,
    );

    flightsA.push(
      { status: "published", createdAt: currentHourFlightTime, adults: 2, children: 1, price: 100.5 },
      { status: "allocated", createdAt: currentHourFlightTime, adults: 3, children: 0, price: 200 },
      // Counted for flights/passengers, excluded from spend.
      { status: "in_progress", createdAt: currentHourFlightTime, adults: 4, children: 0, price: 999 },
      // Excluded from every trend.
      { status: "draft", createdAt: currentHourFlightTime, adults: 5, children: 0, price: 500 },
      { status: "paid", createdAt: yesterdayTenAm, adults: 1, children: 1, price: 50 },
    );

    for (const flight of flightsA) {
      await insertDashboardCancelledFlight({
        airlineId: airlineA,
        airportId,
        status: flight.status,
        createdAt: flight.createdAt,
        totalAdults: flight.adults,
        totalChildren: flight.children,
        totalPrice: flight.price,
      });
    }

    // Airline B data at the same instant must never reach airline A.
    await insertDashboardCancelledFlight({
      airlineId: airlineB,
      airportId,
      status: "published",
      createdAt: currentHourFlightTime,
      totalAdults: 7,
      totalChildren: 0,
      totalPrice: 1000,
    });
  });

  afterAll(async () => {
    await deleteDashboardData({ airlineIds, airportIds });
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  describe.each(ENDPOINTS)("GET /dashboard/airline/$path", ({ path, field }) => {
    const url = `${BASE_PATH}/${path}`;

    it.each(TIME_FRAMES)(
      "timeFrame=$timeFrame returns every bucket with the airline's own values, zero-filled",
      async ({ timeFrame, granularity }) => {
        const before = new Date();
        const res = await api
          .get(url)
          .query({ timeFrame })
          .set("Authorization", `Bearer ${adminTokenA}`);
        const after = new Date();

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const data = res.body.data;
        expect(data.timeFrame).toBe(timeFrame);
        expect(data.granularity).toBe(granularity);
        expect(data.timezone).toBe(COLOMBO);
        expect(data.startDate).toMatch(/\+05:30$/);
        expect(data.endDate).toMatch(/T23:59:59\+05:30$/);
        // The platform bills everything in USD, so no currency is returned.
        expect(data.currency).toBeUndefined();

        // "today" grows by one bucket per hour; tolerate an hour rollover
        // between building the expectation and the response.
        expect([
          expectedBucketCount(timeFrame, before),
          expectedBucketCount(timeFrame, after),
        ]).toContain(data.points.length);

        const expected = expectedValues(flightsA, field, granularity);
        const buckets = new Set<string>();
        for (const point of data.points) {
          expect(typeof point[field]).toBe("number");
          expect(point.label).toBe(expectedLabel(point.bucket, granularity));
          expect(point[field]).toBeCloseTo(expected.get(point.bucket) ?? 0, 2);
          buckets.add(point.bucket);
        }
        expect(buckets.size).toBe(data.points.length);
      },
    );

    it("puts today's flights in the current local hour and leaves earlier hours at 0", async () => {
      const res = await api
        .get(url)
        .query({ timeFrame: "today" })
        .set("Authorization", `Bearer ${adminTokenA}`);

      expect(res.status).toBe(200);
      const points: { bucket: string }[] = res.body.data.points;
      const currentKey = colomboBucketKey(currentHourStart, "hour");
      const expectedCurrent = { spend: 300.5, passengers: 10, flights: 3 }[
        field
      ];

      const current = points.find((point) => point.bucket === currentKey) as
        | Record<string, number>
        | undefined;
      expect(current?.[field]).toBeCloseTo(expectedCurrent, 2);
      for (const point of points) {
        if (point.bucket !== currentKey) {
          expect((point as Record<string, unknown>)[field]).toBe(0);
        }
      }
    });

    it("puts yesterday's flight in its local hour bucket", async () => {
      const res = await api
        .get(url)
        .query({ timeFrame: "yesterday" })
        .set("Authorization", `Bearer ${adminTokenA}`);

      expect(res.status).toBe(200);
      const points: Record<string, number | string>[] = res.body.data.points;
      const tenAm = points.find(
        (point) => point.bucket === colomboBucketKey(yesterdayTenAm, "hour"),
      );
      expect(tenAm?.[field]).toBeCloseTo(
        { spend: 50, passengers: 2, flights: 1 }[field],
        2,
      );
      expect(String(points[0].bucket)).toMatch(/T00:00$/);
      expect(String(points[23].bucket)).toMatch(/T23:00$/);
    });

    it("scopes airline B to its own data only", async () => {
      const res = await api
        .get(url)
        .query({ timeFrame: "week" })
        .set("Authorization", `Bearer ${adminTokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.timezone).toBe("UTC");
      const total = (res.body.data.points as Record<string, number>[]).reduce(
        (sum, point) => sum + point[field],
        0,
      );
      expect(total).toBeCloseTo(
        { spend: 1000, passengers: 7, flights: 1 }[field],
        2,
      );
    });

    it("rejects an airlineId query param with 400", async () => {
      // Scope always comes from the token; the global ValidationPipe
      // (forbidNonWhitelisted) rejects the unsupported param.
      const res = await api
        .get(url)
        .query({ timeFrame: "week", airlineId: airlineIds[1] })
        .set("Authorization", `Bearer ${adminTokenA}`);
      expect(res.status).toBe(400);
    });

    it("allows AIRLINE_STAFF with DASHBOARD VIEW", async () => {
      const res = await api
        .get(url)
        .query({ timeFrame: "week" })
        .set("Authorization", `Bearer ${staffDashboardTokenA}`);
      expect(res.status).toBe(200);
    });

    it("returns 401 without a token", async () => {
      const res = await api.get(url).query({ timeFrame: "week" });
      expect(res.status).toBe(401);
    });

    it("returns 403 for AIRLINE_STAFF without DASHBOARD permission", async () => {
      const res = await api
        .get(url)
        .query({ timeFrame: "week" })
        .set("Authorization", `Bearer ${staffWithoutDashboardTokenA}`);
      expect(res.status).toBe(403);
    });

    it("returns 403 for platform users", async () => {
      const res = await api
        .get(url)
        .query({ timeFrame: "week" })
        .set("Authorization", `Bearer ${platformToken}`);
      expect(res.status).toBe(403);
    });

    it("returns 400 when timeFrame is missing", async () => {
      const res = await api
        .get(url)
        .set("Authorization", `Bearer ${adminTokenA}`);
      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid timeFrame", async () => {
      const res = await api
        .get(url)
        .query({ timeFrame: "decade" })
        .set("Authorization", `Bearer ${adminTokenA}`);
      expect(res.status).toBe(400);
    });
  });
});
