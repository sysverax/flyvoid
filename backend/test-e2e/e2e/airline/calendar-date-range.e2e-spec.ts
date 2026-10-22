import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";
import { api } from "../../helpers/http-client.helper";
import { endPool } from "../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../helpers/db-cleanup.helper";
import { getAirlineTokens } from "../../helpers/airline-auth.helper";
import { insertActiveAdmin } from "../../seeders/admin.seeder";
import { insertAirlineUserRow } from "../../seeders/airline-invitation.seeder";
import {
  deleteDashboardData,
  insertDashboardAirline,
  insertDashboardAirport,
  insertDashboardCancelledFlight,
} from "../../seeders/airline-dashboard.seeder";
import {
  deleteDateRangeData,
  insertBookedPassenger,
  insertHotelBooking,
  insertProvider,
} from "../../seeders/date-range.seeder";

// Category B (DATE columns): cancelled_flights.cancellation_date and
// hotel_bookings.check_in_date. YYYY-MM-DD, both ends inclusive.

const EMAIL_PATTERN = "%@e2e-calendar-range.test";
const TEST_PASSWORD = "Password@123";

// One flight (with one booked hotel, checking in the same day) per date.
const DATES = ["2026-09-30", "2026-10-01", "2026-10-05", "2026-10-06"];
const RANGE = { startDate: "2026-10-01", endDate: "2026-10-05" };

const ENDPOINTS: { name: string; path: string; count: (body: any) => number }[] = [
  {
    name: "cancelled flights",
    path: "/api/v1/cancelled-flights",
    count: (body) => body.data.pagination.totalCount,
  },
  {
    name: "cancelled flights summary",
    path: "/api/v1/cancelled-flights/summary",
    count: (body) => body.data.totalCancelFlights,
  },
  {
    name: "hotel bookings",
    path: "/api/v1/hotel-bookings",
    count: (body) => body.data.pagination.totalCount,
  },
  {
    name: "hotel bookings summary",
    path: "/api/v1/hotel-bookings/summary",
    count: (body) => body.data.totalBookings,
  },
];

describe("Calendar date (YYYY-MM-DD) range filters", () => {
  const airlineIds: number[] = [];
  const airportIds: number[] = [];
  const providerIds: number[] = [];
  let token = "";

  beforeAll(async () => {
    const suffix = `${Date.now()}`.slice(-8);
    const admin = await insertActiveAdmin({
      email: `super-${suffix}@e2e-calendar-range.test`,
      password: TEST_PASSWORD,
      role: "SUPER_ADMIN",
    });
    const airportId = await insertDashboardAirport(admin.id);
    airportIds.push(airportId);
    const providerId = await insertProvider(`e2e-${suffix}`);
    providerIds.push(providerId);

    const airlineId = await insertDashboardAirline({
      code: `E2ECR${suffix}`,
      contactEmail: `airline-${suffix}@e2e-calendar-range.test`,
      timezone: "Asia/Colombo",
      currency: "USD",
    });
    airlineIds.push(airlineId);

    const email = `admin-${suffix}@e2e-calendar-range.test`;
    await insertAirlineUserRow({
      airlineId,
      email,
      password: TEST_PASSWORD,
      role: "AIRLINE_ADMIN",
    });
    token = (await getAirlineTokens(email, TEST_PASSWORD)).accessToken;

    for (const date of DATES) {
      const flightId = await insertDashboardCancelledFlight({
        airlineId,
        airportId,
        status: "published",
        createdAt: new Date(`${date}T12:00:00Z`),
        cancellationDate: date,
      });
      const bookingId = await insertBookedPassenger(
        flightId,
        `pax-${date}-${suffix}@e2e-calendar-range.test`,
      );
      await insertHotelBooking({
        cancelledFlightId: flightId,
        bookingId,
        providerId,
        checkInDate: date,
      });
    }
  });

  afterAll(async () => {
    await deleteDateRangeData({ airlineIds, providerIds });
    await deleteDashboardData({ airlineIds, airportIds });
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  describe.each(ENDPOINTS)("GET $path", ({ path, count }) => {
    const get = (query: Record<string, unknown>) =>
      api.get(path).query(query).set("Authorization", `Bearer ${token}`);

    it("includes rows on both startDate and endDate", async () => {
      const res = await get(RANGE);
      expect(res.status).toBe(200);
      expect(count(res.body)).toBe(2); // 2026-10-01 and 2026-10-05
    });

    it("accepts equal startDate and endDate (a single day)", async () => {
      const res = await get({ startDate: "2026-10-05", endDate: "2026-10-05" });
      expect(res.status).toBe(200);
      expect(count(res.body)).toBe(1);
    });

    it.each([
      ["timestamp", "2026-10-01T00:00:00.000Z"],
      ["timestamp with offset", "2026-10-01T00:00:00+05:30"],
      ["invalid date", "2026-02-30"],
    ])("returns 400 for a %s startDate", async (_label, startDate) => {
      const res = await get({ startDate });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(
        /startDate must be a calendar date in YYYY-MM-DD format/,
      );
    });

    it("returns 400 for a reversed range", async () => {
      const res = await get({ startDate: "2026-10-05", endDate: "2026-10-01" });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/endDate must be on or after startDate/);
    });
  });

  describe("open-ended ranges (GET /api/v1/cancelled-flights)", () => {
    const get = (query: Record<string, unknown>) =>
      api
        .get("/api/v1/cancelled-flights")
        .query(query)
        .set("Authorization", `Bearer ${token}`);

    it("supports only startDate", async () => {
      const res = await get({ startDate: "2026-10-01" });
      expect(res.status).toBe(200);
      expect(res.body.data.pagination.totalCount).toBe(3);
    });

    it("supports only endDate", async () => {
      const res = await get({ endDate: "2026-10-05" });
      expect(res.status).toBe(200);
      expect(res.body.data.pagination.totalCount).toBe(3);
    });
  });

  describe("hotel bookings summary bug fix", () => {
    it("search and date filters no longer fail", async () => {
      const res = await api
        .get("/api/v1/hotel-bookings/summary")
        .query({ ...RANGE, search: "e2e-calendar-range" })
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalBookings).toBe(2);
    });
  });
});
