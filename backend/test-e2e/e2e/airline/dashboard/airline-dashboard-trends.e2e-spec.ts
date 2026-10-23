import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { getAdminTokens } from "../../../helpers/auth.helper";
import { getAirlineTokens } from "../../../helpers/airline-auth.helper";
import {
  Granularity,
  TimeFrame,
  bucketKey,
  offsetSuffix,
  rangeFor,
  wallClock,
  zonedToUtc,
} from "../../../helpers/time-zone.helper";
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
import {
  deleteDateRangeData,
  insertBookedPassenger,
  insertHotelBooking,
  insertProvider,
} from "../../../seeders/date-range.seeder";

const EMAIL_PATTERN = "%@e2e-dashboard.test";
const TEST_PASSWORD = "Password@123";
const BASE_PATH = "/api/v1/dashboard/airline";

// Airline A's stored timezone. Requests also use other timezones: the
// request `timezone` must always win over the airline's.
const COLOMBO = "Asia/Colombo";
const NEW_YORK = "America/New_York";
const KATHMANDU = "Asia/Kathmandu"; // +05:45, non-whole-hour offset
const REQUEST_ZONES = [COLOMBO, NEW_YORK, KATHMANDU];
const SECOND_MS = 1000;

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

const TIME_FRAMES: { timeFrame: TimeFrame; granularity: Granularity }[] = [
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

/** Expected value per bucket for flights inside the time frame, in `zone`. */
function expectedValues(
  flights: SeededFlight[],
  metric: Metric,
  timeFrame: TimeFrame,
  granularity: Granularity,
  zone: string,
  now: Date,
): Map<string, number> {
  const { start, end } = rangeFor(timeFrame, now, zone);
  const values = new Map<string, number>();
  for (const flight of flights) {
    const at = flight.createdAt.getTime();
    if (at < start || at >= end) continue;
    const key = bucketKey(flight.createdAt, granularity, zone);
    values.set(key, (values.get(key) ?? 0) + metricValue(flight, metric));
  }
  return values;
}

function expectedBucketCount(timeFrame: TimeFrame, now: Date, zone: string): number {
  switch (timeFrame) {
    case "today":
      return wallClock(zone, now).hour + 1;
    case "yesterday":
      return 24;
    case "week":
      return 7;
    case "month":
      return 12;
    case "year":
      return 6;
  }
}

const sumOf = (points: Record<string, number>[], field: Metric) =>
  points.reduce((sum, point) => sum + point[field], 0);

describe("Airline dashboard trends", () => {
  const airlineIds: number[] = [];
  const airportIds: number[] = [];
  const providerIds: number[] = [];
  const flightsA: SeededFlight[] = [];

  let adminTokenA = "";
  let staffDashboardTokenA = "";
  let staffWithoutDashboardTokenA = "";
  let adminTokenB = "";
  let platformToken = "";

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

    const now = new Date();

    // Status mix one second into the current Colombo hour.
    const local = wallClock(COLOMBO, now);
    const currentHourFlightTime = new Date(
      zonedToUtc(COLOMBO, local.year, local.month, local.day, local.hour) +
        SECOND_MS,
    );
    flightsA.push(
      { status: "published", createdAt: currentHourFlightTime, adults: 2, children: 1, price: 100.5 },
      { status: "allocated", createdAt: currentHourFlightTime, adults: 3, children: 0, price: 200 },
      // Counted for flights/passengers, excluded from spend.
      { status: "in_progress", createdAt: currentHourFlightTime, adults: 4, children: 0, price: 999 },
      // Excluded from every trend.
      { status: "draft", createdAt: currentHourFlightTime, adults: 5, children: 0, price: 500 },
    );

    // A flight on each request timezone's local midnight (today) and one
    // second before it (yesterday). These instants differ per timezone, so
    // the same data falls into different time frames and buckets per zone.
    // Distinct prices make any wrongly bucketed flight visible.
    let price = 1;
    for (const zone of REQUEST_ZONES) {
      const todayStart = rangeFor("today", now, zone).start;
      for (const at of [todayStart, todayStart - SECOND_MS]) {
        flightsA.push({ status: "paid", createdAt: new Date(at), adults: 1, children: 1, price });
        price *= 2;
      }
    }

    // Spend is bucketed by hotel booking created_at and passengers by PNR
    // created_at: each flight gets one PNR (carrying the flight's adults and
    // children) and one live hotel booking (priced like the flight), both at
    // the flight's own instant, so every metric lands in the same bucket as
    // the flight. The flight's status still decides what counts.
    const providerId = await insertProvider(`e2e-trend-${suffix}`);
    providerIds.push(providerId);
    const insertFlightWithHotel = async (
      airlineId: number,
      flight: SeededFlight,
      index: number,
    ) => {
      const flightId = await insertDashboardCancelledFlight({
        airlineId,
        airportId,
        status: flight.status,
        createdAt: flight.createdAt,
        totalAdults: flight.adults,
        totalChildren: flight.children,
        totalPrice: flight.price,
      });
      const bookingId = await insertBookedPassenger(
        flightId,
        `pax-${airlineId}-${index}-${suffix}@e2e-dashboard.test`,
        {
          adults: flight.adults,
          children: flight.children,
          createdAt: flight.createdAt,
        },
      );
      await insertHotelBooking({
        cancelledFlightId: flightId,
        bookingId,
        providerId,
        checkInDate: "2026-10-01",
        createdAt: flight.createdAt,
        totalPrice: flight.price,
      });
    };

    for (const [index, flight] of flightsA.entries()) {
      await insertFlightWithHotel(airlineA, flight, index);
    }

    // Airline B data at the same instant must never reach airline A.
    await insertFlightWithHotel(
      airlineB,
      {
        status: "published",
        createdAt: currentHourFlightTime,
        adults: 7,
        children: 0,
        price: 1000,
      },
      0,
    );
  });

  afterAll(async () => {
    await deleteDateRangeData({ airlineIds, providerIds });
    await deleteDashboardData({ airlineIds, airportIds });
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  describe.each(ENDPOINTS)("GET /dashboard/airline/$path", ({ path, field }) => {
    const url = `${BASE_PATH}/${path}`;
    const getTrend = (token: string, query: Record<string, unknown>) =>
      api.get(url).query(query).set("Authorization", `Bearer ${token}`);

    describe.each(REQUEST_ZONES)("timezone=%s", (timezone) => {
      it.each(TIME_FRAMES)(
        "timeFrame=$timeFrame returns every bucket in the request timezone, zero-filled",
        async ({ timeFrame, granularity }) => {
          const before = new Date();
          const res = await getTrend(adminTokenA, { timeFrame, timezone });
          const after = new Date();

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const data = res.body.data;
          const { start, end } = rangeFor(timeFrame, before, timezone);
          expect(data.timeFrame).toBe(timeFrame);
          expect(data.granularity).toBe(granularity);
          expect(data.timezone).toBe(timezone);
          expect(data.startDate.endsWith(offsetSuffix(timezone, start))).toBe(true);
          expect(data.endDate).toMatch(/T23:59:59[+-]\d{2}:\d{2}$/);
          expect(data.endDate.endsWith(offsetSuffix(timezone, end - SECOND_MS))).toBe(true);
          expect(data.currency).toBeUndefined();

          // "today" grows by one bucket per hour; tolerate an hour rollover
          // between building the expectation and the response.
          expect([
            expectedBucketCount(timeFrame, before, timezone),
            expectedBucketCount(timeFrame, after, timezone),
          ]).toContain(data.points.length);

          const expected = expectedValues(
            flightsA,
            field,
            timeFrame,
            granularity,
            timezone,
            before,
          );
          const buckets = new Set<string>();
          for (const point of data.points) {
            expect(typeof point[field]).toBe("number");
            expect(point.label).toBe(expectedLabel(point.bucket, granularity));
            expect(point[field]).toBeCloseTo(expected.get(point.bucket) ?? 0, 2);
            buckets.add(point.bucket);
          }
          expect(buckets.size).toBe(data.points.length);
          expect(sumOf(data.points, field)).toBeCloseTo(
            [...expected.values()].reduce((sum, value) => sum + value, 0),
            2,
          );
        },
      );
    });

    it("gives different results for the same data in different timezones", async () => {
      const now = new Date();
      const [colombo, newYork] = await Promise.all([
        getTrend(adminTokenA, { timeFrame: "today", timezone: COLOMBO }),
        getTrend(adminTokenA, { timeFrame: "today", timezone: NEW_YORK }),
      ]);

      expect(colombo.status).toBe(200);
      expect(newYork.status).toBe(200);
      const expectedToday = (zone: string) =>
        [...expectedValues(flightsA, field, "today", "hour", zone, now).values()]
          .reduce((sum, value) => sum + value, 0);

      // Each zone matches its own expectation, and "today" covers a different
      // set of flights per zone: the midnight-boundary flights fall on
      // different sides.
      expect(sumOf(colombo.body.data.points, field)).toBeCloseTo(expectedToday(COLOMBO), 2);
      expect(sumOf(newYork.body.data.points, field)).toBeCloseTo(expectedToday(NEW_YORK), 2);
      const included = (zone: string) => {
        const { start, end } = rangeFor("today", now, zone);
        return flightsA
          .map((f, index) => (f.createdAt.getTime() >= start && f.createdAt.getTime() < end ? index : -1))
          .filter((index) => index >= 0);
      };
      expect(included(COLOMBO)).not.toEqual(included(NEW_YORK));
    });

    it("uses the request timezone, not the airline's stored timezone", async () => {
      // Airline A is stored as Asia/Colombo.
      const res = await getTrend(adminTokenA, { timeFrame: "week", timezone: NEW_YORK });
      expect(res.status).toBe(200);
      expect(res.body.data.timezone).toBe(NEW_YORK);
      expect(res.body.data.startDate).toMatch(/-0[45]:00$/);
    });

    it("scopes airline B to its own data only", async () => {
      const res = await getTrend(adminTokenB, { timeFrame: "week", timezone: "UTC" });

      expect(res.status).toBe(200);
      expect(res.body.data.timezone).toBe("UTC");
      expect(sumOf(res.body.data.points, field)).toBeCloseTo(
        { spend: 1000, passengers: 7, flights: 1 }[field],
        2,
      );
    });

    it("rejects an airlineId query param with 400", async () => {
      // Scope always comes from the token; the global ValidationPipe
      // (forbidNonWhitelisted) rejects the unsupported param.
      const res = await getTrend(adminTokenA, {
        timeFrame: "week",
        timezone: COLOMBO,
        airlineId: airlineIds[1],
      });
      expect(res.status).toBe(400);
    });

    it("allows AIRLINE_STAFF with DASHBOARD VIEW", async () => {
      const res = await getTrend(staffDashboardTokenA, { timeFrame: "week", timezone: COLOMBO });
      expect(res.status).toBe(200);
    });

    it("returns 401 without a token", async () => {
      const res = await api.get(url).query({ timeFrame: "week", timezone: COLOMBO });
      expect(res.status).toBe(401);
    });

    it("returns 403 for AIRLINE_STAFF without DASHBOARD permission", async () => {
      const res = await getTrend(staffWithoutDashboardTokenA, { timeFrame: "week", timezone: COLOMBO });
      expect(res.status).toBe(403);
    });

    it("returns 403 for platform users", async () => {
      const res = await getTrend(platformToken, { timeFrame: "week", timezone: COLOMBO });
      expect(res.status).toBe(403);
    });

    it("returns 400 when timeFrame is missing", async () => {
      const res = await getTrend(adminTokenA, { timezone: COLOMBO });
      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid timeFrame", async () => {
      const res = await getTrend(adminTokenA, { timeFrame: "decade", timezone: COLOMBO });
      expect(res.status).toBe(400);
    });

    it("returns 400 when timezone is missing", async () => {
      const res = await getTrend(adminTokenA, { timeFrame: "week" });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/timezone is required/);
    });

    it.each(["", "+05:30", "UTC+5:30", "Invalid/Zone"])(
      "returns 400 for timezone %j",
      async (timezone) => {
        const res = await getTrend(adminTokenA, { timeFrame: "week", timezone });
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body)).toMatch(/valid IANA timezone/);
      },
    );
  });
});
