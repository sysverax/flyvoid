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
  insertHotelBookingRoom,
  insertProvider,
} from "../../seeders/date-range.seeder";

// GET /api/v1/hotel-bookings/summary: hotel totals match the hotel bookings
// list; totalPnrs / totalAllocatedPnrs count PNRs by flight status.
//
// Flight A (published):
//   PNR 1: 2 adults + 1 child, hotel 2026-10-01, cost 100, fee 10,
//          2 booked rooms + 1 failed room
//   PNR 2: 1 adult, failed attempt (cost 999) then hotel 2026-10-05,
//          cost 50, fee 5, 1 room
//   PNR 3: 1 adult, allocation failed, no hotel
// Flight B (paid):
//   PNR 4: 1 adult, hotel 2026-10-10, cost 30, fee 3, 1 room
// Flight C (in_progress):
//   PNR 5, PNR 6: draft, no hotel
// Another airline: 1 PNR with a hotel - must never be counted.

const DOMAIN = "e2e-hb-summary.test";
const EMAIL_PATTERN = `%@${DOMAIN}`;
const TEST_PASSWORD = "Password@123";
const SUMMARY_PATH = "/api/v1/hotel-bookings/summary";

describe("GET /api/v1/hotel-bookings/summary totals", () => {
  const airlineIds: number[] = [];
  const airportIds: number[] = [];
  const providerIds: number[] = [];
  let token = "";
  let flightAId = 0;
  let pnr4Email = "";

  const getSummary = (query: Record<string, unknown> = {}) =>
    api.get(SUMMARY_PATH).query(query).set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    const suffix = `${Date.now()}`.slice(-8);
    const admin = await insertActiveAdmin({
      email: `super-${suffix}@${DOMAIN}`,
      password: TEST_PASSWORD,
      role: "SUPER_ADMIN",
    });
    const airportId = await insertDashboardAirport(admin.id);
    airportIds.push(airportId);
    const providerId = await insertProvider(`e2e-hbs-${suffix}`);
    providerIds.push(providerId);

    const airlineId = await insertDashboardAirline({
      code: `E2EHS${suffix}`,
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

    const createdAt = new Date("2026-09-30T12:00:00Z");
    const pax = (label: string) => `${label}-${suffix}@${DOMAIN}`;

    // Flight A (published)
    flightAId = await insertDashboardCancelledFlight({
      airlineId,
      airportId,
      status: "published",
      createdAt,
    });

    const pnr1 = await insertBookedPassenger(flightAId, pax("pnr1"), {
      adults: 2,
      children: 1,
    });
    const hotel1 = await insertHotelBooking({
      cancelledFlightId: flightAId,
      bookingId: pnr1,
      providerId,
      checkInDate: "2026-10-01",
      totalPrice: 100,
      platformFee: 10,
    });
    await insertHotelBookingRoom({ hotelBookingId: hotel1, roomNo: 1 });
    await insertHotelBookingRoom({ hotelBookingId: hotel1, roomNo: 2 });
    await insertHotelBookingRoom({
      hotelBookingId: hotel1,
      roomNo: 3,
      status: "failed",
    });

    const pnr2 = await insertBookedPassenger(flightAId, pax("pnr2"));
    await insertHotelBooking({
      cancelledFlightId: flightAId,
      bookingId: pnr2,
      providerId,
      checkInDate: "2026-10-05",
      status: "failed",
      attemptOrder: 1,
      totalPrice: 999,
      platformFee: 99,
    });
    const hotel2 = await insertHotelBooking({
      cancelledFlightId: flightAId,
      bookingId: pnr2,
      providerId,
      checkInDate: "2026-10-05",
      attemptOrder: 2,
      totalPrice: 50,
      platformFee: 5,
    });
    await insertHotelBookingRoom({ hotelBookingId: hotel2, roomNo: 1 });

    await insertBookedPassenger(flightAId, pax("pnr3"), {
      allocationStatus: "failed",
    });

    // Flight B (paid)
    const flightBId = await insertDashboardCancelledFlight({
      airlineId,
      airportId,
      status: "paid",
      createdAt,
    });
    pnr4Email = pax("pnr4");
    const pnr4 = await insertBookedPassenger(flightBId, pnr4Email);
    const hotel4 = await insertHotelBooking({
      cancelledFlightId: flightBId,
      bookingId: pnr4,
      providerId,
      checkInDate: "2026-10-10",
      totalPrice: 30,
      platformFee: 3,
    });
    await insertHotelBookingRoom({ hotelBookingId: hotel4, roomNo: 1 });

    // Flight C (in_progress)
    const flightCId = await insertDashboardCancelledFlight({
      airlineId,
      airportId,
      status: "in_progress",
      createdAt,
    });
    await insertBookedPassenger(flightCId, pax("pnr5"), {
      allocationStatus: "draft",
    });
    await insertBookedPassenger(flightCId, pax("pnr6"), {
      allocationStatus: "draft",
    });

    // Another airline's data
    const otherAirlineId = await insertDashboardAirline({
      code: `E2EHO${suffix}`,
      contactEmail: `other-${suffix}@${DOMAIN}`,
      timezone: "Asia/Colombo",
      currency: "USD",
    });
    airlineIds.push(otherAirlineId);
    const otherFlightId = await insertDashboardCancelledFlight({
      airlineId: otherAirlineId,
      airportId,
      status: "published",
      createdAt,
    });
    const otherPnr = await insertBookedPassenger(otherFlightId, pax("other"));
    await insertHotelBooking({
      cancelledFlightId: otherFlightId,
      bookingId: otherPnr,
      providerId,
      checkInDate: "2026-10-01",
      totalPrice: 500,
      platformFee: 50,
    });
  });

  afterAll(async () => {
    await deleteDateRangeData({ airlineIds, providerIds });
    await deleteDashboardData({ airlineIds, airportIds });
    await deleteAdminsByEmailPattern(EMAIL_PATTERN);
    await endPool();
  });

  it("returns hotel totals and PNR counts without filters", async () => {
    const res = await getSummary();
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Hotel bookings summary fetched successfully");
    expect(res.body.data).toEqual({
      totalBookings: 3,
      totalPassengers: 5,
      totalRooms: 4,
      totalCost: 180,
      totalPlatformFee: 18,
      totalPnrs: 6,
      totalAllocatedPnrs: 4,
    });
  });

  it("no longer returns totalCancelFlights", async () => {
    const res = await getSummary();
    expect(res.body.data).not.toHaveProperty("totalCancelFlights");
  });

  it("totalBookings matches the hotel bookings list", async () => {
    const list = await api
      .get("/api/v1/hotel-bookings")
      .set("Authorization", `Bearer ${token}`);
    const summary = await getSummary();
    expect(list.status).toBe(200);
    expect(summary.body.data.totalBookings).toBe(
      list.body.data.pagination.totalCount,
    );
  });

  it("narrows every total by cancelledFlightId", async () => {
    const res = await getSummary({ cancelledFlightId: flightAId });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalBookings: 2,
      totalPassengers: 4,
      totalRooms: 3,
      totalCost: 150,
      totalPlatformFee: 15,
      totalPnrs: 3,
      totalAllocatedPnrs: 3,
    });
  });

  it("narrows hotel totals but not PNR counts by check-in date", async () => {
    const res = await getSummary({
      startDate: "2026-10-01",
      endDate: "2026-10-05",
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalBookings: 2,
      totalPassengers: 4,
      totalRooms: 3,
      totalCost: 150,
      totalPlatformFee: 15,
      totalPnrs: 6,
      totalAllocatedPnrs: 4,
    });
  });

  // The dashboard's "Total Hotel Bookings" card reads this endpoint.
  it("cancelled flights summary returns the same live hotel bookings count", async () => {
    const res = await api
      .get("/api/v1/cancelled-flights/summary")
      .set("Authorization", `Bearer ${token}`);
    const hotelSummary = await getSummary();
    expect(res.status).toBe(200);
    expect(res.body.data.totalHotelBookings).toBe(3);
    expect(res.body.data.totalHotelBookings).toBe(
      hotelSummary.body.data.totalBookings,
    );
  });

  it("narrows hotel totals but not PNR counts by search", async () => {
    const res = await getSummary({ search: pnr4Email });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalBookings: 1,
      totalPassengers: 1,
      totalRooms: 1,
      totalCost: 30,
      totalPlatformFee: 3,
      totalPnrs: 6,
      totalAllocatedPnrs: 4,
    });
  });
});
