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

const EMAIL_PATTERN = "%@e2e-summary.test";
const TEST_PASSWORD = "Password@123";
const SUMMARY_PATH = "/api/v1/cancelled-flights/summary";
const TREND_PATH = "/api/v1/dashboard/airline";

// Airline A uses Colombo: UTC+05:30 all year (no DST). Its local midnight is
// 18:30 UTC on the previous UTC day, so every range boundary below is also a
// point where the UTC date differs from the airline's local date.
const COLOMBO = "Asia/Colombo";
const COLOMBO_OFFSET_MS = 330 * 60_000;
const UTC_OFFSET_MS = 0;
const SECOND_MS = 1000;
const REGRESSION_DATE = "2019-06-01";

const TIME_FRAMES = ["today", "yesterday", "week", "month", "year"] as const;
type TimeFrame = (typeof TIME_FRAMES)[number];

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

/** [start, end) of a time frame, in a fixed-offset timezone. */
function rangeFor(
  timeFrame: TimeFrame,
  now: Date,
  offsetMs: number,
): { start: number; end: number } {
  const local = new Date(now.getTime() + offsetMs);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const at = (year: number, month: number, day: number) =>
    Date.UTC(year, month, day) - offsetMs;

  switch (timeFrame) {
    case "today":
      return { start: at(y, m, d), end: at(y, m, d + 1) };
    case "yesterday":
      return { start: at(y, m, d - 1), end: at(y, m, d) };
    case "week":
      return { start: at(y, m, d - 6), end: at(y, m, d + 1) };
    case "month":
      return { start: at(y, m - 11, 1), end: at(y, m + 1, 1) };
    case "year":
      return { start: at(y - 5, 0, 1), end: at(y + 1, 0, 1) };
  }
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

    // A flight exactly on each range start (inside) and one second before it
    // (outside). Prices are distinct powers of two, so any wrongly included
    // or excluded flight changes the total.
    seededAt = new Date();
    let price = 1;
    for (const timeFrame of TIME_FRAMES) {
      const { start } = rangeFor(timeFrame, seededAt, COLOMBO_OFFSET_MS);
      for (const createdAt of [new Date(start), new Date(start - SECOND_MS)]) {
        flightsA.push({ status: "published", createdAt, adults: 1, children: 1, price });
        price *= 2;
      }
    }
    // Status rules, one minute into today.
    const todayStart = rangeFor("today", seededAt, COLOMBO_OFFSET_MS).start;
    const statusMixAt = new Date(todayStart + 60 * SECOND_MS);
    flightsA.push(
      { status: "draft", createdAt: statusMixAt, adults: 9, children: 0, price: (price *= 2) },
      { status: "in_progress", createdAt: statusMixAt, adults: 3, children: 0, price: (price *= 2) },
      { status: "allocated", createdAt: statusMixAt, adults: 2, children: 0, price: (price *= 2) },
      // Old flight, only reachable through the cancellationDate filters.
      {
        status: "draft",
        createdAt: new Date(Date.UTC(2019, 5, 1, 12)),
        adults: 1,
        children: 0,
        price: (price *= 2),
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

  describe("timeFrame", () => {
    it.each(TIME_FRAMES)(
      "timeFrame=%s counts flights on the range start and excludes the second before it",
      async (timeFrame) => {
        const res = await getSummary(adminTokenA, { timeFrame });

        expect(res.status).toBe(200);
        const expected = expectedTotals(
          flightsA,
          rangeFor(timeFrame, seededAt, COLOMBO_OFFSET_MS),
        );
        expect(res.body.data.totalCancelFlights).toBe(
          expected.totalCancelFlights,
        );
        expect(res.body.data.totalAdults + res.body.data.totalChildren).toBe(
          expected.passengers,
        );
        expect(res.body.data.totalCost).toBeCloseTo(expected.totalCost, 2);
      },
    );

    it.each(TIME_FRAMES)(
      "timeFrame=%s totals equal the sums of the matching trends",
      async (timeFrame) => {
        const [summary, flights, spend, passengers] = await Promise.all([
          getSummary(adminTokenA, { timeFrame }),
          api
            .get(`${TREND_PATH}/cancelled-flights-trend`)
            .query({ timeFrame })
            .set("Authorization", `Bearer ${adminTokenA}`),
          api
            .get(`${TREND_PATH}/hotel-spend-trend`)
            .query({ timeFrame })
            .set("Authorization", `Bearer ${adminTokenA}`),
          api
            .get(`${TREND_PATH}/affected-passengers-trend`)
            .query({ timeFrame })
            .set("Authorization", `Bearer ${adminTokenA}`),
        ]);

        const sum = (res: { body: { data: { points: Record<string, number>[] } } }, field: string) =>
          res.body.data.points.reduce((total, point) => total + point[field], 0);

        expect(summary.status).toBe(200);
        expect(summary.body.data.totalCancelFlights).toBe(sum(flights, "flights"));
        expect(summary.body.data.totalCost).toBeCloseTo(sum(spend, "spend"), 2);
        expect(
          summary.body.data.totalAdults + summary.body.data.totalChildren,
        ).toBe(sum(passengers, "passengers"));
      },
    );

    it("excludes draft flights from counts and unsettled flights from money", async () => {
      const res = await getSummary(adminTokenA, { timeFrame: "today" });
      const expected = expectedTotals(
        flightsA,
        rangeFor("today", seededAt, COLOMBO_OFFSET_MS),
      );
      const todayStart = rangeFor("today", seededAt, COLOMBO_OFFSET_MS).start;
      const publishedAtMidnight = flightsA.find(
        (f) => f.status === "published" && f.createdAt.getTime() === todayStart,
      )!;
      const allocated = flightsA.find((f) => f.status === "allocated")!;

      expect(res.status).toBe(200);
      // today: the published flight on midnight, plus in_progress + allocated.
      expect(res.body.data.totalCancelFlights).toBe(3);
      expect(res.body.data.totalCancelFlights).toBe(expected.totalCancelFlights);
      // Money: published + allocated only (no draft, no in_progress).
      expect(res.body.data.totalCost).toBeCloseTo(
        publishedAtMidnight.price + allocated.price,
        2,
      );
    });

    it("uses UTC for platform users", async () => {
      const res = await getSummary(platformToken, {
        timeFrame: "today",
        airlineId: airlineIds[0],
      });

      expect(res.status).toBe(200);
      const expected = expectedTotals(
        flightsA,
        rangeFor("today", seededAt, UTC_OFFSET_MS),
      );
      expect(res.body.data.totalCancelFlights).toBe(expected.totalCancelFlights);
      expect(res.body.data.totalCost).toBeCloseTo(expected.totalCost, 2);
      expect(res.body.data.platformFeePercentage).toBeNull();
    });
  });

  describe("validation", () => {
    it.each([
      [{ timeFrame: "week", startDate: "2026-01-01" }],
      [{ timeFrame: "week", endDate: "2026-12-31" }],
      [{ timeFrame: "week", startDate: "2026-01-01", endDate: "2026-12-31" }],
    ])("returns 400 for timeFrame combined with dates: %j", async (query) => {
      const res = await getSummary(adminTokenA, query);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/timeFrame cannot be combined/);
    });

    it("returns 400 for an invalid timeFrame", async () => {
      const res = await getSummary(adminTokenA, { timeFrame: "decade" });
      expect(res.status).toBe(400);
    });
  });

  describe("without timeFrame (unchanged behaviour)", () => {
    it("counts every status and every flight's money", async () => {
      const res = await getSummary(adminTokenA, {});

      expect(res.status).toBe(200);
      expect(res.body.data.totalCancelFlights).toBe(flightsA.length);
      expect(res.body.data.totalCost).toBeCloseTo(
        flightsA.reduce((sum, flight) => sum + flight.price, 0),
        2,
      );
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
      const [own, withOtherAirline] = await Promise.all([
        getSummary(adminTokenA, { timeFrame: "week" }),
        getSummary(adminTokenA, { timeFrame: "week", airlineId: airlineB }),
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
    it("allows AIRLINE_STAFF with only CANCELLED_FLIGHTS VIEW", async () => {
      const res = await getSummary(cancelledFlightsOnlyTokenA, { timeFrame: "week" });
      expect(res.status).toBe(200);
    });

    it("allows AIRLINE_STAFF with only DASHBOARD VIEW", async () => {
      const res = await getSummary(dashboardOnlyTokenA, { timeFrame: "week" });
      expect(res.status).toBe(200);
    });

    it("returns 403 for AIRLINE_STAFF with neither permission", async () => {
      const res = await getSummary(noAccessTokenA, { timeFrame: "week" });
      expect(res.status).toBe(403);
    });

    it("returns 401 without a token", async () => {
      const res = await api.get(SUMMARY_PATH).query({ timeFrame: "week" });
      expect(res.status).toBe(401);
    });
  });
});
