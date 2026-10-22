import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { getAdminTokens } from "../../../helpers/auth.helper";
import { getAirlineTokens } from "../../../helpers/airline-auth.helper";
import {
  TimeFrame,
  offsetSuffix,
  rangeFor,
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

const EMAIL_PATTERN = "%@e2e-summary.test";
const TEST_PASSWORD = "Password@123";
const SUMMARY_PATH = "/api/v1/cancelled-flights/summary";
const TREND_PATH = "/api/v1/dashboard/airline";

// Airline A's stored timezone. Requests also use other timezones: the
// request `timezone` must always win, for airline and platform users alike.
const COLOMBO = "Asia/Colombo";
const NEW_YORK = "America/New_York";
const KATHMANDU = "Asia/Kathmandu"; // +05:45, non-whole-hour offset
const REQUEST_ZONES = [COLOMBO, NEW_YORK, KATHMANDU];
const SECOND_MS = 1000;
const REGRESSION_DATE = "2019-06-01";

const TIME_FRAMES: TimeFrame[] = ["today", "yesterday", "week", "month", "year"];

const SPEND_STATUSES: DashboardFlightStatus[] = [
  "allocated",
  "paid",
  "published",
];

interface SeededFlight {
  status: DashboardFlightStatus;
  createdAt: Date;
  adults: number;
  children: number;
  price: number;
  cancellationDate?: string;
}

function expectedTotals(
  flights: SeededFlight[],
  range: { start: number; end: number },
) {
  const inRange = flights.filter(
    (flight) =>
      flight.status !== "draft" &&
      flight.createdAt.getTime() >= range.start &&
      flight.createdAt.getTime() < range.end,
  );
  return {
    totalCancelFlights: inRange.length,
    passengers: inRange.reduce((sum, f) => sum + f.adults + f.children, 0),
    totalCost: inRange
      .filter((flight) => SPEND_STATUSES.includes(flight.status))
      .reduce((sum, flight) => sum + flight.price, 0),
  };
}

describe("GET /api/v1/cancelled-flights/summary", () => {
  const airlineIds: number[] = [];
  const airportIds: number[] = [];
  const flightsA: SeededFlight[] = [];
  let airlineB = 0;

  let adminTokenA = "";
  let cancelledFlightsOnlyTokenA = "";
  let dashboardOnlyTokenA = "";
  let noAccessTokenA = "";
  let platformToken = "";
  let seededAt: Date;

  beforeAll(async () => {
    const suffix = `${Date.now()}`.slice(-8);

    const platformEmail = `summary-super-${suffix}@e2e-summary.test`;
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
      code: `E2ESA${suffix}`,
      contactEmail: `airline-a-${suffix}@e2e-summary.test`,
      timezone: COLOMBO,
      currency: "USD",
    });
    airlineB = await insertDashboardAirline({
      code: `E2ESB${suffix}`,
      contactEmail: `airline-b-${suffix}@e2e-summary.test`,
      timezone: "UTC",
      currency: "USD",
    });
    airlineIds.push(airlineA, airlineB);

    const users: { key: string; role: "AIRLINE_ADMIN" | "AIRLINE_STAFF"; asset?: string }[] = [
      { key: "admin", role: "AIRLINE_ADMIN" },
      { key: "cf-only", role: "AIRLINE_STAFF", asset: "CANCELLED_FLIGHTS" },
      { key: "dash-only", role: "AIRLINE_STAFF", asset: "DASHBOARD" },
      { key: "no-access", role: "AIRLINE_STAFF", asset: "BOOKINGS" },
    ];
    const tokens: string[] = [];
    for (const user of users) {
      const email = `${user.key}-${suffix}@e2e-summary.test`;
      const userId = await insertAirlineUserRow({
        airlineId: airlineA,
        email,
        password: TEST_PASSWORD,
        role: user.role,
      });
      if (user.asset) {
        await grantAirlineAccess(userId, user.asset, "VIEW");
      }
      tokens.push((await getAirlineTokens(email, TEST_PASSWORD)).accessToken);
    }
    [adminTokenA, cancelledFlightsOnlyTokenA, dashboardOnlyTokenA, noAccessTokenA] =
      tokens;

    // For every request timezone: a flight exactly on each range start
    // (inside) and one second before it (outside). The starts differ per
    // timezone, so each zone sees a different subset of the same data.
    seededAt = new Date();
    let price = 1;
    for (const zone of REQUEST_ZONES) {
      for (const timeFrame of TIME_FRAMES) {
        const { start } = rangeFor(timeFrame, seededAt, zone);
        for (const createdAt of [new Date(start), new Date(start - SECOND_MS)]) {
          flightsA.push({ status: "published", createdAt, adults: 1, children: 1, price });
          price += 1;
        }
      }
    }
    // Status rules, one minute into today in Colombo.
    const todayStart = rangeFor("today", seededAt, COLOMBO).start;
    const statusMixAt = new Date(todayStart + 60 * SECOND_MS);
    flightsA.push(
      { status: "draft", createdAt: statusMixAt, adults: 9, children: 0, price: 1000 },
      { status: "in_progress", createdAt: statusMixAt, adults: 3, children: 0, price: 2000 },
      { status: "allocated", createdAt: statusMixAt, adults: 2, children: 0, price: 4000 },
      // Old flight, only reachable through the cancellationDate filters.
      {
        status: "draft",
        createdAt: new Date(Date.UTC(2019, 5, 1, 12)),
        adults: 1,
        children: 0,
        price: 8000,
        cancellationDate: REGRESSION_DATE,
      },
    );

    for (const flight of flightsA) {
      await insertDashboardCancelledFlight({
        airlineId: airlineA,
        airportId,
        status: flight.status,
        createdAt: flight.createdAt,
        cancellationDate: flight.cancellationDate,
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
      createdAt: statusMixAt,
      totalAdults: 50,
      totalChildren: 0,
      totalPrice: 1_000_000,
    });
  });

  afterAll(async () => {
    await deleteDashboardData({ airlineIds, airportIds });
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  const getSummary = (token: string, query: Record<string, unknown>) =>
    api
      .get(SUMMARY_PATH)
      .query(query)
      .set("Authorization", `Bearer ${token}`);

  describe.each(REQUEST_ZONES)("timeFrame with timezone=%s", (timezone) => {
    it.each(TIME_FRAMES)(
      "timeFrame=%s counts flights on the range start, excludes the second before it, and echoes the range",
      async (timeFrame) => {
        const res = await getSummary(adminTokenA, { timeFrame, timezone });

        expect(res.status).toBe(200);
        const range = rangeFor(timeFrame, seededAt, timezone);
        const expected = expectedTotals(flightsA, range);
        const data = res.body.data;
        expect(data.totalCancelFlights).toBe(expected.totalCancelFlights);
        expect(data.totalAdults + data.totalChildren).toBe(expected.passengers);
        expect(data.totalCost).toBeCloseTo(expected.totalCost, 2);

        expect(data.timeFrame).toBe(timeFrame);
        expect(data.timezone).toBe(timezone);
        expect(data.startDate).toMatch(/T00:00:00[+-]\d{2}:\d{2}$/);
        expect(data.startDate.endsWith(offsetSuffix(timezone, range.start))).toBe(true);
        expect(data.endDate).toMatch(/T23:59:59[+-]\d{2}:\d{2}$/);
        expect(data.endDate.endsWith(offsetSuffix(timezone, range.end - SECOND_MS))).toBe(true);
      },
    );

    it.each(TIME_FRAMES)(
      "timeFrame=%s totals equal the sums of the matching trends",
      async (timeFrame) => {
        const query = { timeFrame, timezone };
        const trend = (path: string) =>
          api
            .get(`${TREND_PATH}/${path}`)
            .query(query)
            .set("Authorization", `Bearer ${adminTokenA}`);
        const [summary, flights, spend, passengers] = await Promise.all([
          getSummary(adminTokenA, query),
          trend("cancelled-flights-trend"),
          trend("hotel-spend-trend"),
          trend("affected-passengers-trend"),
        ]);

        const sum = (res: { body: { data: { points: Record<string, number>[] } } }, field: string) =>
          res.body.data.points.reduce((total, point) => total + point[field], 0);

        expect(summary.status).toBe(200);
        expect(summary.body.data.totalCancelFlights).toBe(sum(flights, "flights"));
        expect(summary.body.data.totalCost).toBeCloseTo(sum(spend, "spend"), 2);
        expect(
          summary.body.data.totalAdults + summary.body.data.totalChildren,
        ).toBe(sum(passengers, "passengers"));
        expect(summary.body.data.startDate).toBe(flights.body.data.startDate);
        expect(summary.body.data.endDate).toBe(flights.body.data.endDate);
      },
    );
  });

  describe("timezone behaviour", () => {
    it("gives different totals for the same data in different timezones", async () => {
      const [colombo, newYork] = await Promise.all([
        getSummary(adminTokenA, { timeFrame: "today", timezone: COLOMBO }),
        getSummary(adminTokenA, { timeFrame: "today", timezone: NEW_YORK }),
      ]);

      expect(colombo.status).toBe(200);
      expect(newYork.status).toBe(200);
      expect(colombo.body.data.totalCost).toBeCloseTo(
        expectedTotals(flightsA, rangeFor("today", seededAt, COLOMBO)).totalCost,
        2,
      );
      expect(newYork.body.data.totalCost).toBeCloseTo(
        expectedTotals(flightsA, rangeFor("today", seededAt, NEW_YORK)).totalCost,
        2,
      );
      // The midnight-boundary flights fall on different sides per timezone,
      // so "today" covers a different set of flights in each zone.
      const included = (zone: string) => {
        const { start, end } = rangeFor("today", seededAt, zone);
        return flightsA
          .map((f, index) => (f.createdAt.getTime() >= start && f.createdAt.getTime() < end ? index : -1))
          .filter((index) => index >= 0);
      };
      expect(included(COLOMBO)).not.toEqual(included(NEW_YORK));
    });

    it("uses the request timezone, not the airline's stored timezone", async () => {
      // Airline A is stored as Asia/Colombo.
      const res = await getSummary(adminTokenA, { timeFrame: "today", timezone: KATHMANDU });
      expect(res.status).toBe(200);
      expect(res.body.data.timezone).toBe(KATHMANDU);
      expect(res.body.data.startDate).toMatch(/\+05:45$/);
      expect(res.body.data.totalCost).toBeCloseTo(
        expectedTotals(flightsA, rangeFor("today", seededAt, KATHMANDU)).totalCost,
        2,
      );
    });

    it("uses the request timezone for platform users (not UTC)", async () => {
      const res = await getSummary(platformToken, {
        timeFrame: "today",
        timezone: NEW_YORK,
        airlineId: airlineIds[0],
      });

      expect(res.status).toBe(200);
      const expected = expectedTotals(flightsA, rangeFor("today", seededAt, NEW_YORK));
      expect(res.body.data.timezone).toBe(NEW_YORK);
      expect(res.body.data.totalCancelFlights).toBe(expected.totalCancelFlights);
      expect(res.body.data.totalCost).toBeCloseTo(expected.totalCost, 2);
      expect(res.body.data.platformFeePercentage).toBeNull();
    });

    it("excludes draft flights from counts and unsettled flights from money", async () => {
      const res = await getSummary(adminTokenA, { timeFrame: "today", timezone: COLOMBO });
      const range = rangeFor("today", seededAt, COLOMBO);
      const inToday = flightsA.filter(
        (f) => f.createdAt.getTime() >= range.start && f.createdAt.getTime() < range.end,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.totalCancelFlights).toBe(
        inToday.filter((f) => f.status !== "draft").length,
      );
      // Money: published + allocated only (no draft, no in_progress).
      expect(res.body.data.totalCost).toBeCloseTo(
        inToday
          .filter((f) => SPEND_STATUSES.includes(f.status))
          .reduce((sum, f) => sum + f.price, 0),
        2,
      );
    });
  });

  describe("validation", () => {
    it.each([
      [{ timeFrame: "week", timezone: COLOMBO, startDate: "2026-01-01" }],
      [{ timeFrame: "week", timezone: COLOMBO, endDate: "2026-12-31" }],
      [{ timeFrame: "week", timezone: COLOMBO, startDate: "2026-01-01", endDate: "2026-12-31" }],
    ])("returns 400 for timeFrame combined with dates: %j", async (query) => {
      const res = await getSummary(adminTokenA, query);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/timeFrame cannot be combined/);
    });

    it("returns 400 for an invalid timeFrame", async () => {
      const res = await getSummary(adminTokenA, { timeFrame: "decade", timezone: COLOMBO });
      expect(res.status).toBe(400);
    });

    it("returns 400 when timeFrame is sent without timezone", async () => {
      const res = await getSummary(adminTokenA, { timeFrame: "week" });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/timezone is required/);
    });

    it.each(["", "+05:30", "UTC+5:30", "Invalid/Zone"])(
      "returns 400 for timezone %j with timeFrame",
      async (timezone) => {
        const res = await getSummary(adminTokenA, { timeFrame: "week", timezone });
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body)).toMatch(/valid IANA timezone/);
      },
    );
  });

  describe("without timeFrame (unchanged behaviour)", () => {
    it("counts every status and every flight's money, with no range fields", async () => {
      const res = await getSummary(adminTokenA, {});

      expect(res.status).toBe(200);
      expect(res.body.data.totalCancelFlights).toBe(flightsA.length);
      expect(res.body.data.totalCost).toBeCloseTo(
        flightsA.reduce((sum, flight) => sum + flight.price, 0),
        2,
      );
      for (const field of ["timeFrame", "timezone", "startDate", "endDate"]) {
        expect(res.body.data).not.toHaveProperty(field);
      }
    });

    it("accepts and ignores timezone (even an invalid one) without timeFrame", async () => {
      const [plain, withTimezone, withBadTimezone] = await Promise.all([
        getSummary(adminTokenA, {}),
        getSummary(adminTokenA, { timezone: NEW_YORK }),
        getSummary(adminTokenA, { timezone: "+05:30" }),
      ]);

      expect(withTimezone.status).toBe(200);
      expect(withBadTimezone.status).toBe(200);
      expect(withTimezone.body.data).toEqual(plain.body.data);
      expect(withBadTimezone.body.data).toEqual(plain.body.data);
    });

    it("filters startDate/endDate on cancellationDate, drafts included", async () => {
      const res = await getSummary(adminTokenA, {
        startDate: REGRESSION_DATE,
        endDate: REGRESSION_DATE,
      });
      const regressionFlight = flightsA.find(
        (flight) => flight.cancellationDate === REGRESSION_DATE,
      )!;

      expect(res.status).toBe(200);
      expect(res.body.data.totalCancelFlights).toBe(1);
      expect(res.body.data.totalCost).toBeCloseTo(regressionFlight.price, 2);
    });
  });

  describe("airline scoping", () => {
    it("ignores an airlineId param for airline users", async () => {
      const query = { timeFrame: "week", timezone: COLOMBO };
      const [own, withOtherAirline] = await Promise.all([
        getSummary(adminTokenA, query),
        getSummary(adminTokenA, { ...query, airlineId: airlineB }),
      ]);

      expect(withOtherAirline.status).toBe(200);
      expect(withOtherAirline.body.data).toEqual(own.body.data);
    });

    it("never includes airline B's flights in airline A's totals", async () => {
      const res = await getSummary(adminTokenA, {});
      expect(res.status).toBe(200);
      expect(res.body.data.totalCost).toBeLessThan(1_000_000);
      expect(res.body.data.totalCancelFlights).toBe(flightsA.length);
    });
  });

  describe("permissions", () => {
    const query = { timeFrame: "week", timezone: COLOMBO };

    it("allows AIRLINE_STAFF with only CANCELLED_FLIGHTS VIEW", async () => {
      const res = await getSummary(cancelledFlightsOnlyTokenA, query);
      expect(res.status).toBe(200);
    });

    it("allows AIRLINE_STAFF with only DASHBOARD VIEW", async () => {
      const res = await getSummary(dashboardOnlyTokenA, query);
      expect(res.status).toBe(200);
    });

    it("returns 403 for AIRLINE_STAFF with neither permission", async () => {
      const res = await getSummary(noAccessTokenA, query);
      expect(res.status).toBe(403);
    });

    it("returns 401 without a token", async () => {
      const res = await api.get(SUMMARY_PATH).query(query);
      expect(res.status).toBe(401);
    });
  });
});
