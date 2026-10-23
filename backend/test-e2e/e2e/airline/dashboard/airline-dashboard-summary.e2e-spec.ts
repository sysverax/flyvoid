import { describe, it, beforeAll, afterAll, expect } from "@jest/globals";
import { api } from "../../../helpers/http-client.helper";
import { endPool } from "../../../helpers/db-client.helper";
import { deleteAdminsByEmailPattern } from "../../../helpers/db-cleanup.helper";
import { getAirlineTokens } from "../../../helpers/airline-auth.helper";
import { rangeFor } from "../../../helpers/time-zone.helper";
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
  insertHotelBookingRoom,
  insertProvider,
} from "../../../seeders/date-range.seeder";

// GET /api/v1/dashboard/airline/summary, timeFrame=today in Colombo.
//
// Hotel figures: live hotel bookings by the hotel booking's created_at, on
// allocated / paid / published flights.
//   counted   HB1  flight F1 (allocated, today)      cost 100, fee 7,   2 rooms + 1 failed
//   counted   HB2  flight F0 (published, YESTERDAY)  cost 50,  fee 3.5, 1 room
//   excluded  HB3  flight F1, created 1s before today       cost 1000
//   excluded  HB4  flight F3 (in_progress)                  cost 2000
//   excluded  HB5  flight F2, failed attempt                cost 3000
//   excluded  airline B's hotel booking                     cost 500000
// Flight count: non-draft flights by the flight's created_at.
//   counted   F1 allocated, F2 published, F3 in_progress
//   excluded  F4 draft, F0 created yesterday
// Adults / children: PNRs on non-draft flights by the PNR's created_at.
//   counted   the 5 PNRs behind HB1-HB5 (1 adult each, created now), incl.
//             HB2's PNR on F0 although F0 was created yesterday
//   excluded  a 9-adult + 2-child PNR on draft F4; airline B's PNR

const DOMAIN = "e2e-dash-summary.test";
const EMAIL_PATTERN = `%@${DOMAIN}`;
const TEST_PASSWORD = "Password@123";
const PATH = "/api/v1/dashboard/airline/summary";
const COLOMBO = "Asia/Colombo";
const SECOND_MS = 1000;
const DAY_MS = 24 * 60 * 60 * SECOND_MS;

describe("GET /api/v1/dashboard/airline/summary", () => {
  const airlineIds: number[] = [];
  const airportIds: number[] = [];
  const providerIds: number[] = [];
  let adminToken = "";
  let dashboardOnlyToken = "";
  let noAccessToken = "";

  beforeAll(async () => {
    const suffix = `${Date.now()}`.slice(-8);
    const admin = await insertActiveAdmin({
      email: `super-${suffix}@${DOMAIN}`,
      password: TEST_PASSWORD,
      role: "SUPER_ADMIN",
    });
    const airportId = await insertDashboardAirport(admin.id);
    airportIds.push(airportId);
    const providerId = await insertProvider(`e2e-ds-${suffix}`);
    providerIds.push(providerId);

    const airlineId = await insertDashboardAirline({
      code: `E2EDS${suffix}`,
      contactEmail: `airline-${suffix}@${DOMAIN}`,
      timezone: COLOMBO,
      currency: "USD",
    });
    const otherAirlineId = await insertDashboardAirline({
      code: `E2EDO${suffix}`,
      contactEmail: `other-${suffix}@${DOMAIN}`,
      timezone: COLOMBO,
      currency: "USD",
    });
    airlineIds.push(airlineId, otherAirlineId);

    const users: { key: string; role: "AIRLINE_ADMIN" | "AIRLINE_STAFF"; asset?: string }[] = [
      { key: "admin", role: "AIRLINE_ADMIN" },
      { key: "dash-only", role: "AIRLINE_STAFF", asset: "DASHBOARD" },
      { key: "no-access", role: "AIRLINE_STAFF", asset: "BOOKINGS" },
    ];
    const tokens: string[] = [];
    for (const user of users) {
      const email = `${user.key}-${suffix}@${DOMAIN}`;
      const userId = await insertAirlineUserRow({
        airlineId,
        email,
        password: TEST_PASSWORD,
        role: user.role,
      });
      if (user.asset) {
        await grantAirlineAccess(userId, user.asset, "VIEW");
      }
      tokens.push((await getAirlineTokens(email, TEST_PASSWORD)).accessToken);
    }
    [adminToken, dashboardOnlyToken, noAccessToken] = tokens;

    const todayStart = rangeFor("today", new Date(), COLOMBO).start;
    const inToday = new Date(todayStart + 60 * SECOND_MS);
    const yesterday = new Date(todayStart - DAY_MS + 60 * SECOND_MS);
    const beforeToday = new Date(todayStart - SECOND_MS);

    const flight = (
      status: DashboardFlightStatus,
      createdAt: Date,
      adults: number,
      children: number,
      owner = airlineId,
    ) =>
      insertDashboardCancelledFlight({
        airlineId: owner,
        airportId,
        status,
        createdAt,
        totalAdults: adults,
        totalChildren: children,
      });

    const f0 = await flight("published", yesterday, 4, 4);
    const f1 = await flight("allocated", inToday, 2, 1);
    const f2 = await flight("published", inToday, 1, 0);
    const f3 = await flight("in_progress", inToday, 3, 2);
    const f4 = await flight("draft", inToday, 9, 2);
    await insertBookedPassenger(f4, `draft-pnr-${suffix}@${DOMAIN}`, {
      adults: 9,
      children: 2,
    });
    const otherFlight = await flight("published", inToday, 1, 0, otherAirlineId);

    let pnrNo = 0;
    const hotelBooking = async (params: {
      flightId: number;
      createdAt: Date;
      totalPrice: number;
      platformFee?: number;
      status?: string;
      rooms?: string[];
    }) => {
      pnrNo += 1;
      const bookingId = await insertBookedPassenger(
        params.flightId,
        `pnr${pnrNo}-${suffix}@${DOMAIN}`,
      );
      const id = await insertHotelBooking({
        cancelledFlightId: params.flightId,
        bookingId,
        providerId,
        checkInDate: "2026-10-01",
        createdAt: params.createdAt,
        totalPrice: params.totalPrice,
        platformFee: params.platformFee ?? 0,
        status: params.status,
      });
      for (const [index, status] of (params.rooms ?? []).entries()) {
        await insertHotelBookingRoom({ hotelBookingId: id, roomNo: index + 1, status });
      }
    };

    await hotelBooking({
      flightId: f1,
      createdAt: inToday,
      totalPrice: 100,
      platformFee: 7,
      rooms: ["booked", "booked", "failed"],
    });
    await hotelBooking({
      flightId: f0,
      createdAt: inToday,
      totalPrice: 50,
      platformFee: 3.5,
      rooms: ["booked"],
    });
    await hotelBooking({ flightId: f1, createdAt: beforeToday, totalPrice: 1000, rooms: ["booked"] });
    await hotelBooking({ flightId: f3, createdAt: inToday, totalPrice: 2000, rooms: ["booked"] });
    await hotelBooking({ flightId: f2, createdAt: inToday, totalPrice: 3000, status: "failed" });
    await hotelBooking({ flightId: otherFlight, createdAt: inToday, totalPrice: 500000 });
  });

  afterAll(async () => {
    await deleteDateRangeData({ airlineIds, providerIds });
    await deleteDashboardData({ airlineIds, airportIds });
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  const getSummary = (token: string, query: Record<string, unknown>) =>
    api.get(PATH).query(query).set("Authorization", `Bearer ${token}`);

  it("returns hotel totals by hotel booking created_at and flight totals by flight created_at", async () => {
    const res = await getSummary(adminToken, { timeFrame: "today", timezone: COLOMBO });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Airline dashboard summary fetched successfully");
    const { startDate, endDate, ...totals } = res.body.data;
    expect(totals).toEqual({
      timeFrame: "today",
      timezone: COLOMBO,
      totalHotelBookingCost: 150,
      totalHotelBookings: 2,
      totalRooms: 3,
      totalPlatformFee: 10.5,
      platformFeePercentage: 10,
      totalCancelFlights: 3,
      totalAdults: 5,
      totalChildren: 0,
    });
    expect(startDate).toMatch(/T00:00:00\+05:30$/);
    expect(endDate).toMatch(/T23:59:59\+05:30$/);
  });

  it("counts a hotel booked today on a flight created yesterday", async () => {
    const [today, yesterday] = await Promise.all([
      getSummary(adminToken, { timeFrame: "today", timezone: COLOMBO }),
      getSummary(adminToken, { timeFrame: "yesterday", timezone: COLOMBO }),
    ]);
    // HB2's flight (F0) was created yesterday, but the booking is today's.
    expect(today.body.data.totalHotelBookingCost).toBe(150);
    // Yesterday: only HB3 (1s before today) - and F0 among the flights.
    expect(yesterday.body.data.totalHotelBookings).toBe(1);
    expect(yesterday.body.data.totalHotelBookingCost).toBe(1000);
    expect(yesterday.body.data.totalCancelFlights).toBe(1);
    // F0's PNR was created today, so yesterday has no passengers.
    expect(yesterday.body.data.totalAdults).toBe(0);
  });

  it.each(["today", "yesterday", "week"])(
    "totalHotelBookingCost equals the hotel spend trend total (timeFrame=%s)",
    async (timeFrame) => {
      const query = { timeFrame, timezone: COLOMBO };
      const [summary, trend] = await Promise.all([
        getSummary(adminToken, query),
        api
          .get("/api/v1/dashboard/airline/hotel-spend-trend")
          .query(query)
          .set("Authorization", `Bearer ${adminToken}`),
      ]);
      const trendTotal = trend.body.data.points.reduce(
        (sum: number, point: { spend: number }) => sum + point.spend,
        0,
      );
      expect(trend.status).toBe(200);
      expect(trendTotal).toBeCloseTo(summary.body.data.totalHotelBookingCost, 2);
    },
  );

  const trendTotal = async (
    path: string,
    field: string,
    query: Record<string, unknown>,
  ): Promise<number> => {
    const res = await api
      .get(`/api/v1/dashboard/airline/${path}`)
      .query(query)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    return res.body.data.points.reduce(
      (sum: number, point: Record<string, number>) => sum + point[field],
      0,
    );
  };

  it.each(["today", "yesterday", "week"])(
    "totalCancelFlights equals the cancelled flights trend total (timeFrame=%s)",
    async (timeFrame) => {
      const query = { timeFrame, timezone: COLOMBO };
      const summary = await getSummary(adminToken, query);
      expect(await trendTotal("cancelled-flights-trend", "flights", query)).toBe(
        summary.body.data.totalCancelFlights,
      );
    },
  );

  it.each(["today", "yesterday", "week"])(
    "totalAdults + totalChildren equals the affected passengers trend total (timeFrame=%s)",
    async (timeFrame) => {
      const query = { timeFrame, timezone: COLOMBO };
      const summary = await getSummary(adminToken, query);
      expect(
        await trendTotal("affected-passengers-trend", "passengers", query),
      ).toBe(summary.body.data.totalAdults + summary.body.data.totalChildren);
    },
  );

  it("affected passengers trend counts PNRs by PNR created_at, not the flight's", async () => {
    // Every PNR (1 adult each) is created now: F0 x1, F1 x2, F2 x1, F3 x1.
    // F0 itself was created yesterday, but its PNR still counts today.
    const today = { timeFrame: "today", timezone: COLOMBO };
    const yesterday = { timeFrame: "yesterday", timezone: COLOMBO };
    expect(await trendTotal("affected-passengers-trend", "passengers", today)).toBe(5);
    expect(await trendTotal("affected-passengers-trend", "passengers", yesterday)).toBe(0);
  });

  describe("validation", () => {
    it.each([
      [{ timeFrame: "today" }],
      [{ timezone: COLOMBO }],
      [{ timeFrame: "decade", timezone: COLOMBO }],
      [{ timeFrame: "today", timezone: "+05:30" }],
    ])("returns 400 for %j", async (query) => {
      const res = await getSummary(adminToken, query);
      expect(res.status).toBe(400);
    });
  });

  describe("permissions", () => {
    const query = { timeFrame: "today", timezone: COLOMBO };

    it("allows AIRLINE_STAFF with DASHBOARD VIEW", async () => {
      const res = await getSummary(dashboardOnlyToken, query);
      expect(res.status).toBe(200);
    });

    it("returns 403 without DASHBOARD VIEW", async () => {
      const res = await getSummary(noAccessToken, query);
      expect(res.status).toBe(403);
    });

    it("returns 401 without a token", async () => {
      const res = await api.get(PATH).query(query);
      expect(res.status).toBe(401);
    });
  });
});
