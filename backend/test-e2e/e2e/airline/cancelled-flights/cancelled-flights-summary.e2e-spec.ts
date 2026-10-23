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

// GET /api/v1/cancelled-flights/summary: totals over the same filters as the
// cancelled flights list. No timeFrame/timezone - the airline dashboard uses
// GET /api/v1/dashboard/airline/summary for that.

const EMAIL_PATTERN = "%@e2e-summary.test";
const TEST_PASSWORD = "Password@123";
const SUMMARY_PATH = "/api/v1/cancelled-flights/summary";
const REGRESSION_DATE = "2019-06-01";

interface SeededFlight {
  status: DashboardFlightStatus;
  adults: number;
  children: number;
  price: number;
  cancellationDate: string;
}

// Airline A. Every status counts, drafts included.
const FLIGHTS_A: SeededFlight[] = [
  { status: "published", adults: 1, children: 1, price: 100, cancellationDate: "2026-10-01" },
  { status: "allocated", adults: 2, children: 0, price: 200, cancellationDate: "2026-10-02" },
  { status: "in_progress", adults: 3, children: 0, price: 300, cancellationDate: "2026-10-03" },
  { status: "draft", adults: 9, children: 0, price: 1000, cancellationDate: REGRESSION_DATE },
];

const totalCostOf = (flights: SeededFlight[]) =>
  flights.reduce((sum, flight) => sum + flight.price, 0);

describe("GET /api/v1/cancelled-flights/summary", () => {
  const airlineIds: number[] = [];
  const airportIds: number[] = [];
  let airlineA = 0;
  let airlineB = 0;

  let adminTokenA = "";
  let cancelledFlightsOnlyTokenA = "";
  let dashboardOnlyTokenA = "";
  let noAccessTokenA = "";
  let platformToken = "";

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

    airlineA = await insertDashboardAirline({
      code: `E2ESA${suffix}`,
      contactEmail: `airline-a-${suffix}@e2e-summary.test`,
      timezone: "Asia/Colombo",
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

    const createdAt = new Date();
    for (const flight of FLIGHTS_A) {
      await insertDashboardCancelledFlight({
        airlineId: airlineA,
        airportId,
        status: flight.status,
        createdAt,
        cancellationDate: flight.cancellationDate,
        totalAdults: flight.adults,
        totalChildren: flight.children,
        totalPrice: flight.price,
      });
    }

    // Airline B data must never reach airline A.
    await insertDashboardCancelledFlight({
      airlineId: airlineB,
      airportId,
      status: "published",
      createdAt,
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

  describe("totals", () => {
    it("counts every status (drafts included) and every flight's money", async () => {
      const res = await getSummary(adminTokenA, {});

      expect(res.status).toBe(200);
      expect(res.body.data.totalCancelFlights).toBe(FLIGHTS_A.length);
      expect(res.body.data.totalAdults).toBe(15);
      expect(res.body.data.totalChildren).toBe(1);
      expect(res.body.data.totalCost).toBeCloseTo(totalCostOf(FLIGHTS_A), 2);
      expect(res.body.data.platformFeePercentage).toBe(10);
    });

    it("returns no time-frame range fields", async () => {
      const res = await getSummary(adminTokenA, {});
      for (const field of ["timeFrame", "timezone", "startDate", "endDate"]) {
        expect(res.body.data).not.toHaveProperty(field);
      }
    });

    it("filters startDate/endDate on cancellationDate, drafts included", async () => {
      const res = await getSummary(adminTokenA, {
        startDate: REGRESSION_DATE,
        endDate: REGRESSION_DATE,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.totalCancelFlights).toBe(1);
      expect(res.body.data.totalCost).toBeCloseTo(1000, 2);
    });
  });

  describe("validation", () => {
    it.each([
      [{ timeFrame: "today" }],
      [{ timezone: "Asia/Colombo" }],
      [{ timeFrame: "week", timezone: "Asia/Colombo" }],
    ])("returns 400 for removed time-frame params: %j", async (query) => {
      const res = await getSummary(adminTokenA, query);
      expect(res.status).toBe(400);
    });
  });

  describe("airline scoping", () => {
    it("ignores an airlineId param for airline users", async () => {
      const [own, withOtherAirline] = await Promise.all([
        getSummary(adminTokenA, {}),
        getSummary(adminTokenA, { airlineId: airlineB }),
      ]);

      expect(withOtherAirline.status).toBe(200);
      expect(withOtherAirline.body.data).toEqual(own.body.data);
    });

    it("never includes airline B's flights in airline A's totals", async () => {
      const res = await getSummary(adminTokenA, {});
      expect(res.status).toBe(200);
      expect(res.body.data.totalCost).toBeLessThan(1_000_000);
      expect(res.body.data.totalCancelFlights).toBe(FLIGHTS_A.length);
    });

    it("lets platform users filter by airlineId, with no fee rate", async () => {
      const res = await getSummary(platformToken, { airlineId: airlineA });

      expect(res.status).toBe(200);
      expect(res.body.data.totalCancelFlights).toBe(FLIGHTS_A.length);
      expect(res.body.data.totalCost).toBeCloseTo(totalCostOf(FLIGHTS_A), 2);
      expect(res.body.data.platformFeePercentage).toBeNull();
    });
  });

  describe("permissions", () => {
    it("allows AIRLINE_STAFF with only CANCELLED_FLIGHTS VIEW", async () => {
      const res = await getSummary(cancelledFlightsOnlyTokenA, {});
      expect(res.status).toBe(200);
    });

    it("allows AIRLINE_STAFF with only DASHBOARD VIEW", async () => {
      const res = await getSummary(dashboardOnlyTokenA, {});
      expect(res.status).toBe(200);
    });

    it("returns 403 for AIRLINE_STAFF with neither permission", async () => {
      const res = await getSummary(noAccessTokenA, {});
      expect(res.status).toBe(403);
    });

    it("returns 401 without a token", async () => {
      const res = await api.get(SUMMARY_PATH);
      expect(res.status).toBe(401);
    });
  });
});
