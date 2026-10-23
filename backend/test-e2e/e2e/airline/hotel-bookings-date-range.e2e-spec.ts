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

// Category A (timestamp column): hotel_bookings.created_at, on both
// GET /hotel-bookings and GET /hotel-bookings/summary.
// startDate inclusive, endDate exclusive, timezone info required.

const DOMAIN = "e2e-hb-range.test";
const EMAIL_PATTERN = `%@${DOMAIN}`;
const TEST_PASSWORD = "Password@123";

// 1 Oct 2026 in Colombo (+05:30), as UTC and as local-with-offset.
const START_Z = "2026-09-30T18:30:00.000Z";
const END_Z = "2026-10-01T18:30:00.000Z";
const START_OFFSET = "2026-10-01T00:00:00+05:30";
const END_OFFSET = "2026-10-02T00:00:00+05:30";
const SECOND_MS = 1000;

describe("Hotel bookings created_at date range", () => {
  const airlineIds: number[] = [];
  const airportIds: number[] = [];
  const providerIds: number[] = [];
  let token = "";
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    const suffix = `${Date.now()}`.slice(-8);
    const admin = await insertActiveAdmin({
      email: `super-${suffix}@${DOMAIN}`,
      password: TEST_PASSWORD,
      role: "SUPER_ADMIN",
    });
    const airportId = await insertDashboardAirport(admin.id);
    airportIds.push(airportId);
    const providerId = await insertProvider(`e2e-hbr-${suffix}`);
    providerIds.push(providerId);

    const airlineId = await insertDashboardAirline({
      code: `E2EHR${suffix}`,
      contactEmail: `airline-${suffix}@${DOMAIN}`,
      timezone: "Asia/Colombo",
      currency: "USD",
    });
    airlineIds.push(airlineId);

    const email = `admin-${suffix}@${DOMAIN}`;
    await insertAirlineUserRow({
      airlineId,
      email,
      password: TEST_PASSWORD,
      role: "AIRLINE_ADMIN",
    });
    token = (await getAirlineTokens(email, TEST_PASSWORD)).accessToken;

    const flightId = await insertDashboardCancelledFlight({
      airlineId,
      airportId,
      status: "published",
      createdAt: new Date(START_Z),
    });

    // Check-in is the same day for every row, so only created_at differs.
    const start = new Date(START_Z).getTime();
    const end = new Date(END_Z).getTime();
    const rows: Record<string, number> = {
      beforeStart: start - SECOND_MS,
      atStart: start,
      inside: start + 60 * 60 * SECOND_MS,
      beforeEnd: end - SECOND_MS,
      atEnd: end,
    };
    for (const [key, at] of Object.entries(rows)) {
      const bookingId = await insertBookedPassenger(
        flightId,
        `${key}-${suffix}@${DOMAIN}`,
      );
      ids[key] = await insertHotelBooking({
        cancelledFlightId: flightId,
        bookingId,
        providerId,
        checkInDate: "2026-10-01",
        createdAt: new Date(at),
        totalPrice: 10,
      });
    }
  });

  afterAll(async () => {
    await deleteDateRangeData({ airlineIds, providerIds });
    await deleteDashboardData({ airlineIds, airportIds });
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  const list = (query: Record<string, unknown>) =>
    api
      .get("/api/v1/hotel-bookings")
      .query({ limit: 100, ...query })
      .set("Authorization", `Bearer ${token}`);

  const summary = (query: Record<string, unknown>) =>
    api
      .get("/api/v1/hotel-bookings/summary")
      .query(query)
      .set("Authorization", `Bearer ${token}`);

  const idsOf = (res: { body: { data: { hotelBookings: { id: number }[] } } }) =>
    res.body.data.hotelBookings.map((booking) => booking.id).sort((a, b) => a - b);

  const expectIds = (...keys: string[]) => keys.map((key) => ids[key]).sort((a, b) => a - b);

  describe("GET /api/v1/hotel-bookings", () => {
    it("includes a row exactly at startDate and excludes a row exactly at endDate", async () => {
      const res = await list({ startDate: START_Z, endDate: END_Z });
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual(expectIds("atStart", "inside", "beforeEnd"));
    });

    it("returns identical results for the same range sent as Z and as +05:30", async () => {
      const [utc, offset] = await Promise.all([
        list({ startDate: START_Z, endDate: END_Z }),
        list({ startDate: START_OFFSET, endDate: END_OFFSET }),
      ]);
      expect(offset.status).toBe(200);
      expect(idsOf(offset)).toEqual(idsOf(utc));
    });

    it("supports only startDate (open-ended end)", async () => {
      const res = await list({ startDate: START_Z });
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual(expectIds("atStart", "inside", "beforeEnd", "atEnd"));
    });

    it("supports only endDate (open-ended start)", async () => {
      const res = await list({ endDate: END_Z });
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual(expectIds("beforeStart", "atStart", "inside", "beforeEnd"));
    });
  });

  describe("GET /api/v1/hotel-bookings/summary", () => {
    it("counts the same rows as the list for the same range", async () => {
      const res = await summary({ startDate: START_Z, endDate: END_Z });
      expect(res.status).toBe(200);
      expect(res.body.data.totalBookings).toBe(3);
      expect(res.body.data.totalCost).toBe(30);
    });

    it("returns identical totals for the same range sent as Z and as +05:30", async () => {
      const [utc, offset] = await Promise.all([
        summary({ startDate: START_Z, endDate: END_Z }),
        summary({ startDate: START_OFFSET, endDate: END_OFFSET }),
      ]);
      expect(offset.status).toBe(200);
      expect(offset.body.data).toEqual(utc.body.data);
    });

    it("supports open-ended ranges", async () => {
      const [onlyStart, onlyEnd] = await Promise.all([
        summary({ startDate: START_Z }),
        summary({ endDate: END_Z }),
      ]);
      expect(onlyStart.body.data.totalBookings).toBe(4);
      expect(onlyEnd.body.data.totalBookings).toBe(4);
    });
  });

  describe.each([
    ["GET /api/v1/hotel-bookings", list],
    ["GET /api/v1/hotel-bookings/summary", summary],
  ])("%s validation", (_name, get) => {
    it.each([
      ["date only", "2026-10-01"],
      ["no timezone", "2026-10-01T00:00:00"],
      ["invalid month", "2026-13-01T00:00:00Z"],
      ["garbage", "abc"],
    ])("returns 400 for %s startDate", async (_label, startDate) => {
      const res = await get({ startDate });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(
        /startDate must be an ISO 8601 timestamp with timezone/,
      );
    });

    it.each([
      ["reversed", END_Z, START_Z],
      ["equal (end is exclusive)", START_Z, START_OFFSET],
    ])("returns 400 for a %s range", async (_label, startDate, endDate) => {
      const res = await get({ startDate, endDate });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/endDate must be after startDate/);
    });
  });
});
