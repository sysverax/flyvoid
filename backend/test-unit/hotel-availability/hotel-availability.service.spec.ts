import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createLogger, transports } from "winston";
import { HotelAvailabilityService } from "../../src/hotel-availability/hotel-availability.service";
import { HotelAvailabilityQueryDto } from "../../src/hotel-availability/dto/hotel-availability-query.dto";
import { todayIn, addDays } from "../../src/cancelled-flights/stay-dates";

const logger = createLogger({ transports: [new transports.Console({ silent: true })] });

const airport = {
  id: 4,
  name: "Dubai International",
  iataCode: "DXB",
  countryCode: "AE",
  latitude: "25.2531750",
  longitude: "55.3656730",
  timezone: "Asia/Dubai",
};
const today = todayIn(airport.timezone);

const supplierHotel = {
  hotelCode: "6291054",
  hotelName: "Slug Name",
  category: "Unrated",
  address: "Near Airport",
  stars: 0,
  rates: [
    {
      hotelCode: "6291054",
      hotelName: "Slug Name",
      category: "Unrated",
      roomCode: null,
      roomName: "Deluxe Double",
      boardCode: null,
      boardName: "Room Only",
      rateKey: "k",
      rateType: "RECHECK",
      netPrice: 200,
      currency: "USD",
      allotment: null,
      adults: 2,
      children: 0,
      childrenAges: [],
      cancellationPolicies: [],
      rateComments: null,
      paymentType: "deposit",
    },
  ],
};

function setup() {
  const adapter = {
    searchNearbyHotelsWithOccupancies: jest.fn(async (..._args: any[]) => [supplierHotel] as any[]),
    searchMultiRoomOrders: jest.fn(async (..._args: any[]) => [] as any[]),
  };
  const provider = { id: 1, code: "ratehawk", name: "RateHawk", isActive: true };
  const providerRepository = { findOne: jest.fn(async () => provider as any) };
  const airportRepository = { findOne: jest.fn(async () => airport as any) };
  const registry = {
    get: jest.fn(() => adapter as any),
    isConfigured: jest.fn(() => true),
  };
  const content = {
    ensureHotelContent: jest.fn(async (..._args: any[]) =>
      new Map([["6291054", { name: "Grand Hotel Dubai", starRating: 4, isActive: true }]]),
    ),
  };
  const service = new HotelAvailabilityService(
    providerRepository as any,
    airportRepository as any,
    registry as any,
    content as any,
  );
  return { service, adapter, provider, registry, content, airportRepository };
}

const query = (overrides: Partial<HotelAvailabilityQueryDto> = {}): HotelAvailabilityQueryDto =>
  Object.assign(new HotelAvailabilityQueryDto(), {
    providerId: 1,
    airportId: 4,
    checkInDate: addDays(today, 14),
    checkOutDate: addDays(today, 16),
    rooms: [{ adults: 2, childrenAges: [] }],
    ...overrides,
  });

describe("HotelAvailabilityService.searchAvailability", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("searches one room with the airport's country and the given radius, keeping pay-at-hotel hotels", async () => {
    const result = await ctx.service.searchAvailability(query({ radius: 20 }), "req", logger);

    expect(ctx.adapter.searchNearbyHotelsWithOccupancies).toHaveBeenCalledTimes(1);
    const args = ctx.adapter.searchNearbyHotelsWithOccupancies.mock.calls[0];
    expect(args[3]).toEqual([{ adults: 2, children: 0, childrenAges: [] }]);
    expect(args[6]).toMatchObject({ residency: "AE", includePayAtHotel: true });
    expect(ctx.adapter.searchMultiRoomOrders).not.toHaveBeenCalled();
    expect(ctx.content.ensureHotelContent).toHaveBeenCalledWith(
      ["6291054"],
      "req",
      logger,
      { code: "ratehawk", adapter: ctx.adapter },
    );

    expect(result).toMatchObject({
      nights: 2,
      radius: 20,
      radiusUnit: "km",
      residency: "AE",
      airport: { id: 4, code: "DXB" },
      provider: { id: 1, code: "ratehawk" },
    });
    expect(result.hotels).toHaveLength(1);
    expect(result.hotels[0]).toMatchObject({
      hid: 6291054,
      name: "Grand Hotel Dubai",
      stars: 4,
      lowestPricePerNight: 100,
      lowestTotalPrice: 200,
    });
  });

  it("uses one multiroom search for several rooms", async () => {
    const rooms = [
      { adults: 2, childrenAges: [7] },
      { adults: 1, childrenAges: [] },
    ];
    await ctx.service.searchAvailability(query({ rooms, residency: "GB" }), "req", logger);
    expect(ctx.adapter.searchMultiRoomOrders).toHaveBeenCalledTimes(1);
    const args = ctx.adapter.searchMultiRoomOrders.mock.calls[0];
    expect(args[3]).toEqual([
      [
        { adults: 2, children: 1, childrenAges: [7] },
        { adults: 1, children: 0, childrenAges: [] },
      ],
    ]);
    expect(args[6]).toMatchObject({ residency: "GB" });
  });

  it("returns an empty list when the supplier finds nothing", async () => {
    ctx.adapter.searchNearbyHotelsWithOccupancies.mockRejectedValueOnce(
      new NotFoundException("No hotels found"),
    );
    const result = await ctx.service.searchAvailability(query(), "req", logger);
    expect(result.hotels).toEqual([]);
    expect(ctx.content.ensureHotelContent).not.toHaveBeenCalled();
  });

  it("skips hotels the content API reports closed", async () => {
    ctx.content.ensureHotelContent.mockResolvedValueOnce(
      new Map([["6291054", { name: "Closed", isActive: false }]]) as any,
    );
    const result = await ctx.service.searchAvailability(query(), "req", logger);
    expect(result.hotels).toEqual([]);
  });

  it.each([
    ["check-in before today", { checkInDate: addDays(today, -1), checkOutDate: addDays(today, 1) }, /today or later/],
    ["check-out on check-in", { checkInDate: addDays(today, 3), checkOutDate: addDays(today, 3) }, /after the check-in date/],
    ["over 30 nights", { checkInDate: addDays(today, 1), checkOutDate: addDays(today, 32) }, /longer than 30 nights/],
  ])("rejects %s", async (_label, change, message) => {
    await expect(
      ctx.service.searchAvailability(query(change), "req", logger),
    ).rejects.toThrow(message);
    expect(ctx.adapter.searchNearbyHotelsWithOccupancies).not.toHaveBeenCalled();
  });

  it("rejects an inactive provider", async () => {
    ctx.provider.isActive = false;
    await expect(ctx.service.searchAvailability(query(), "req", logger)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("rejects a provider without credentials", async () => {
    ctx.registry.isConfigured.mockReturnValue(false);
    await expect(ctx.service.searchAvailability(query(), "req", logger)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("rejects several rooms for a supplier without multiroom search", async () => {
    delete (ctx.adapter as any).searchMultiRoomOrders;
    await expect(
      ctx.service.searchAvailability(
        query({ rooms: [{ adults: 1, childrenAges: [] }, { adults: 1, childrenAges: [] }] }),
        "req",
        logger,
      ),
    ).rejects.toThrow(/one room per search/);
  });

  it("404s an unknown airport", async () => {
    ctx.airportRepository.findOne.mockResolvedValueOnce(null as any);
    await expect(ctx.service.searchAvailability(query(), "req", logger)).rejects.toThrow(
      NotFoundException,
    );
  });
});
