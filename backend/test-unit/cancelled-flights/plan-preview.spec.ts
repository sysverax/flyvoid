import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { createLogger, transports } from "winston";
import { HotelAllocationService } from "../../src/cancelled-flights/hotel-allocation.service";
import { HotelContentService } from "../../src/cancelled-flights/hotel-content.service";
import { PlanPreviewRequestDto } from "../../src/cancelled-flights/dto/plan-preview-request.dto";
import { config } from "../../src/config/config";

const logger = createLogger({
  transports: [new transports.Console({ silent: true })],
});

// Future dates, so the "check-in today or later" rule passes on any day.
const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const CHECK_IN = inDays(5);
const CHECK_OUT = inDays(6);

const airport = {
  id: 4,
  iataCode: "DXB",
  countryCode: "AE",
  latitude: "25.25",
  longitude: "55.36",
  timezone: "Asia/Dubai",
};

// One PNR: 7 adults + 1 child in 2 rooms.
const SPLIT = [
  { adults: 4, children: 1 },
  { adults: 3, children: 0 },
];
const body = (extra: object = {}) =>
  ({
    checkInDate: CHECK_IN,
    checkOutDate: CHECK_OUT,
    departureAirport: "dxb",
    residency: "AE",
    adults: 7,
    children: 1,
    rooms: SPLIT,
    allocation: 3,
    ...extra,
  }) as any;

const option = (
  rateKey: string,
  adults: number,
  children: number,
  netPrice: number,
  allotment: number,
) => ({ rateKey, adults, children, netPrice, allotment, inPool: true });

// bigRoom / smallRoom: rooms left for the 4+1 and 3+0 rates.
const candidate = (code: string, stars: number, bigRoom: number, smallRoom: number) => ({
  hotelCode: code,
  hotelName: `Hotel ${code}`,
  category: `${stars} STARS`,
  stars,
  tier: "pool",
  estimatedPrice: 300,
  currency: "USD",
  rooms: [
    {
      adults: 4,
      children: 1,
      roomsNeeded: 1,
      rateOptions: [option(`${code}-41`, 4, 1, 180, bigRoom)],
    },
    {
      adults: 3,
      children: 0,
      roomsNeeded: 1,
      rateOptions: [option(`${code}-30`, 3, 0, 120, smallRoom)],
    },
  ],
});

function setup(candidates = [candidate("A", 4, 2, 5), candidate("B", 3, 3, 3)]) {
  const repository = {
    findAirportByIataCode: jest.fn(async (..._args: any[]) => airport as any),
  };
  const service = new HotelAllocationService(
    repository as any,
    {} as any,
    {} as any,
    {} as any,
  ) as any;
  service.computePnrPlans = jest.fn(async (_f: any, _s: any, bookings: any[]) => ({
    invalid: [],
    hotels: [
      { hotelCode: "A", hotelName: "Hotel A", category: "4 STARS", stars: 4, radius: 10, rates: [] },
      { hotelCode: "C", hotelName: "Hotel C", category: "1 STARS", stars: 1, radius: 20, rates: [] },
    ],
    orderHotels: undefined,
    pools: new Map([
      [
        "4_1",
        {
          shapeKey: "4_1",
          shape: { adults: 4, children: 1 },
          demand: 3,
          target: 5,
          poolAllotment: 5,
          totalAllotment: 5,
          rateKeys: new Set(["A-41", "B-41"]),
          hotelCodes: new Set(["A", "B"]),
        },
      ],
    ]),
    entries: bookings.map((booking) => ({
      booking,
      stars: { min: 3, preferred: 3 },
      plan: { preferred: SPLIT, fallbacks: [] },
      rooms: SPLIT,
      needs: [],
      asOrder: false,
      candidates,
    })),
  }));
  return { service, repository };
}

describe("plan preview from the request body", () => {
  it("plans `allocation` PNRs with the same party and split, without a class star rule", async () => {
    const { service, repository } = setup();

    await service.previewRecommendation(body(), "req", logger);

    expect(repository.findAirportByIataCode).toHaveBeenCalledWith("DXB");
    const [flight, stay, bookings, , , rooms, stars] =
      service.computePnrPlans.mock.calls[0];
    expect(flight.departureAirport).toBe(airport);
    expect(stay).toEqual({ checkIn: CHECK_IN, checkOut: CHECK_OUT });
    expect(bookings).toHaveLength(3);
    bookings.forEach((booking: any) =>
      expect(booking).toMatchObject({ adults: 7, children: 1, residency: "ae" }),
    );
    expect(rooms).toEqual(SPLIT);
    const floor = config.hotelSearch.minRate;
    expect(stars).toEqual({ min: floor, preferred: floor });
  });

  it("gives each PNR all its rooms in one hotel, moving on when rooms run out", async () => {
    const { service } = setup();

    const result = await service.previewRecommendation(body(), "req", logger);

    // Hotel A has two 4+1 rooms: PNRs 1-2 there, PNR 3 moves on to B.
    expect(
      result.allocations.map((a: any) => [a.pnrNo, a.hotelCode, a.rank]),
    ).toEqual([
      [1, "A", 1],
      [2, "A", 1],
      [3, "B", 2],
    ]);
    expect(result.allocations[0].rooms.map((r: any) => r.rateKey)).toEqual([
      "A-41",
      "A-30",
    ]);
    expect(result.allocations[0].price).toBe(300);
    expect(result.allAllocated).toBe(true);
  });

  it("reports a PNR that no hotel can take", async () => {
    const { service } = setup([candidate("A", 4, 1, 5), candidate("B", 3, 1, 3)]);

    const result = await service.previewRecommendation(body(), "req", logger);

    expect(result.allocations.map((a: any) => a.hotelCode)).toEqual(["A", "B", null]);
    expect(result.allocations[2].reason).toContain(
      "No ranked hotel has free rooms left",
    );
    expect(result.allAllocated).toBe(false);
  });

  it("echoes the demand and shows the 150% supply pool", async () => {
    const { service } = setup();

    const result = await service.previewRecommendation(body(), "req", logger);

    expect(result).toMatchObject({
      adults: 7,
      children: 1,
      allocation: 3,
      roomsPerPnr: 2,
      totalRooms: 6,
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      departureAirport: "DXB",
      residency: "AE",
      chosenRooms: SPLIT,
      roomSplitGiven: true,
      supplyBufferRatio: config.hotelBooking.supplyBufferRatio,
    });
    expect(result.supplyPool).toEqual([
      {
        shape: { adults: 4, children: 1 },
        roomsNeeded: 3,
        target: 5,
        poolAllotment: 5,
        targetMet: true,
        totalAllotment: 5,
        hotels: ["A", "B"],
        rates: 2,
      },
    ]);
    expect(result.recommended).toMatchObject({ rank: 1, hotelCode: "A" });
  });

  it("uses minStars and supplyBufferRatio from the body", async () => {
    const { service } = setup();

    const result = await service.previewRecommendation(
      body({ minStars: 4, supplyBufferRatio: 2 }),
      "req",
      logger,
    );

    const args = service.computePnrPlans.mock.calls[0];
    expect(args[6]).toEqual({ min: 4, preferred: 4 });
    expect(args[7]).toBe(2);
    expect(result).toMatchObject({ minStars: 4, supplyBufferRatio: 2 });
  });

  it("defaults minStars and supplyBufferRatio to the configured values", async () => {
    const { service } = setup();

    const result = await service.previewRecommendation(body(), "req", logger);

    const args = service.computePnrPlans.mock.calls[0];
    expect(args[7]).toBe(config.hotelBooking.supplyBufferRatio);
    expect(result.minStars).toBe(config.hotelSearch.minRate);
  });

  it("shows how many whole PNR sets each hotel can host, against the target", async () => {
    const { service } = setup();
    const rates = (big: number, small: number) => [
      { rateKey: "b", adults: 4, children: 1, allotment: big, netPrice: 1, currency: "USD" },
      { rateKey: "s", adults: 3, children: 0, allotment: small, netPrice: 1, currency: "USD" },
    ];
    const original = service.computePnrPlans;
    service.computePnrPlans = jest.fn(async (...args: any[]) => ({
      ...(await original(...args)),
      hotels: [
        { hotelCode: "A", hotelName: "A", stars: 4, rates: rates(4, 2) }, // 2 sets
        { hotelCode: "B", hotelName: "B", stars: 5, rates: rates(1, 9) }, // 1 set
        { hotelCode: "C", hotelName: "C", stars: 4, rates: rates(5, 0) }, // 0 sets
        { hotelCode: "D", hotelName: "D", stars: 1, rates: rates(9, 9) }, // below minStars
      ],
    }));

    const result = await service.previewRecommendation(body({ minStars: 3 }), "req", logger);

    // 3 PNRs x 1.5 -> 5 sets needed; A 2 + B 1 = 3.
    expect(result.supplySets).toEqual({
      setsNeeded: 3,
      target: 5,
      setsAvailable: 3,
      targetMet: false,
      hotels: [
        { hotelCode: "B", hotelName: "B", stars: 5, sets: 1 },
        { hotelCode: "A", hotelName: "A", stars: 4, sets: 2 },
      ],
    });
  });

  it("defaults to one PNR and to the split allocation would choose", async () => {
    const { service } = setup();

    await service.previewRecommendation(
      body({ allocation: undefined, rooms: undefined }),
      "req",
      logger,
    );

    const [, , bookings, , , rooms] = service.computePnrPlans.mock.calls[0];
    expect(bookings).toHaveLength(1);
    expect(rooms).toBeUndefined();
  });

  it.each([
    ["an unknown airport", body({ departureAirport: "ZZZ" }), "Airport 'ZZZ' not found"],
    ["check-out not after check-in", body({ checkOutDate: CHECK_IN }), "checkOutDate must be after checkInDate"],
    ["a stay over 30 nights", body({ checkOutDate: inDays(40) }), "The stay can be at most 30 nights"],
    ["a check-in in the past", body({ checkInDate: inDays(-2) }), "checkInDate must be today"],
    [
      "a split that does not hold the party",
      body({ rooms: [{ adults: 4, children: 1 }, { adults: 2, children: 0 }] }),
      "rooms must hold exactly 7 adult(s) and 1 child(ren)",
    ],
  ])("rejects %s with 400 before any supplier search", async (_label, input, message) => {
    const { service, repository } = setup();
    if (input.departureAirport === "ZZZ") {
      repository.findAirportByIataCode.mockResolvedValue(null);
    }

    const call = service.previewRecommendation(input, "req", logger);

    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    await expect(call).rejects.toThrow(message);
    expect(service.computePnrPlans).not.toHaveBeenCalled();
  });
});

describe("plan preview request body validation", () => {
  const errorsFor = async (input: object) =>
    (
      await validate(plainToInstance(PlanPreviewRequestDto, input), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).flatMap((e: any) => [
      ...Object.values(e.constraints ?? {}),
      ...(e.children ?? []).flatMap((c: any) =>
        (c.children ?? []).flatMap((g: any) => Object.values(g.constraints ?? {})),
      ),
    ]);

  it("accepts the full body", async () => {
    expect(
      await errorsFor({
        ...body(),
        departureAirport: "DXB",
        minStars: 3,
        supplyBufferRatio: 1.5,
      }),
    ).toEqual([]);
  });

  it.each([
    [{ checkInDate: "20/11/2026" }, "checkInDate must be a calendar date in YYYY-MM-DD format"],
    [{ departureAirport: "DUBAI" }, "departureAirport must be a 3-letter IATA code"],
    [{ adults: 0 }, "adults must be at least 1"],
    [{ allocation: 0 }, "allocation must be at least 1"],
    [{ rooms: [{ adults: 0, children: 1 }] }, "Each room needs at least 1 adult"],
    [{ travelClass: "economy" }, "property travelClass should not exist"],
    [{ minStars: 6 }, "minStars can be at most 5"],
    [{ supplyBufferRatio: 0.5 }, "supplyBufferRatio must be at least 1"],
    [{ supplyBufferRatio: "1.5" }, "supplyBufferRatio must be a number"],
  ])("rejects %j", async (change, message) => {
    const errors = await errorsFor({ ...body(), departureAirport: "DXB", ...change });
    expect(errors.join(" | ")).toContain(message);
  });
});

describe("plan preview writes nothing", () => {
  it("read-only content enrichment uses fetched hotel content without saving it", async () => {
    const repository = {
      findHotelsByCodes: jest.fn(async () => []),
      saveHotelContent: jest.fn(async () => undefined),
    };
    const adapter = {
      fetchHotelsStaticContent: jest.fn(async () => [
        { hotelCode: "h1", name: "Airport Inn", starRating: 4, address: "1 Road", isActive: true },
      ]),
    };
    const saved = (config.hotelSearch as any).isAllowFetchHotelDetails;
    (config.hotelSearch as any).isAllowFetchHotelDetails = true;
    try {
      const content = new HotelContentService(
        repository as any,
        adapter as any,
        {} as any,
      );

      const hotels = await content.enrichSearchResults(
        [{ hotelCode: "h1", hotelName: "", category: "", address: "", stars: 0, rates: [] }] as any,
        "req",
        logger,
        true,
      );

      expect(repository.saveHotelContent).not.toHaveBeenCalled();
      expect(hotels[0]).toMatchObject({ hotelName: "Airport Inn", stars: 4 });
    } finally {
      (config.hotelSearch as any).isAllowFetchHotelDetails = saved;
    }
  });
});

describe("hotels preview: one plain geo search around the airport", () => {
  const geoBody = (extra: object = {}) =>
    ({
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      departureAirport: "DXB",
      residency: "AE",
      adults: 7,
      children: 1,
      rooms: SPLIT,
      ...extra,
    }) as any;
  const supplierHotel = (code: string, stars: number, extra: object = {}) => ({
    hotelCode: code,
    hotelName: `supplier ${code}`,
    category: "",
    address: "",
    stars,
    rates: [
      { rateKey: `rk-${code}`, roomName: "Family", boardName: "RO", adults: 4, children: 1, netPrice: 120, currency: "USD", allotment: 2, paymentType: "deposit" },
    ],
    ...extra,
  });

  function geoSetup(found: any[], stored: Map<string, any> = new Map()) {
    const repository = { findAirportByIataCode: jest.fn(async () => airport) };
    const provider = {
      searchNearbyHotelsWithOccupancies: jest.fn(async (..._args: any[]) => found) as jest.Mock<(...args: any[]) => Promise<any>>,
    };
    const content = {
      ensureHotelContent: jest.fn(async (..._args: any[]) => stored),
    };
    const service = new HotelAllocationService(
      repository as any,
      provider as any,
      {} as any,
      content as any,
    ) as any;
    return { service, provider, content };
  }

  it("makes one search at the given radius for the rooms' occupancies, with no filters", async () => {
    const { service, provider, content } = geoSetup([supplierHotel("A", 4)]);

    await service.previewHotels(geoBody({ radius: 25 }), "req", logger);

    expect(provider.searchNearbyHotelsWithOccupancies).toHaveBeenCalledTimes(1);
    const [point, checkIn, checkOut, occupancies, , , options] =
      provider.searchNearbyHotelsWithOccupancies.mock.calls[0];
    expect(point).toEqual({ iataCode: "DXB", latitude: 25.25, longitude: 55.36 });
    expect([checkIn, checkOut]).toEqual([CHECK_IN, CHECK_OUT]);
    expect(occupancies).toEqual([
      { adults: 4, children: 1 },
      { adults: 3, children: 0 },
    ]);
    expect(options).toEqual({ residency: "ae", radius: 25, includePayAtHotel: true });
    // Hotel content is read without saving.
    expect(content.ensureHotelContent.mock.calls[0][4]).toBe(true);
  });

  it("returns every hotel, nearest first, with its distance and stored stars and name", async () => {
    const stored = new Map([
      ["NEAR", { name: "Near Inn", starRating: 2, address: "1 Road", isActive: true, latitude: "25.26", longitude: "55.36" }],
      ["FAR", { name: "Far Hotel", starRating: 5, address: "9 Road", isActive: false, latitude: "25.50", longitude: "55.36" }],
    ]);
    const { service } = geoSetup(
      [supplierHotel("FAR", 0), supplierHotel("NEAR", 0), supplierHotel("NOCOORD", 3)],
      stored,
    );

    const result = await service.previewHotels(geoBody(), "req", logger);

    expect(result.totalHotels).toBe(3);
    expect(result.hotels.map((h: any) => [h.hotelCode, h.hotelName, h.stars, h.active])).toEqual([
      ["NEAR", "Near Inn", 2, true], // a 2-star hotel is not filtered out
      ["FAR", "Far Hotel", 5, false], // nor a closed one
      ["NOCOORD", "supplier NOCOORD", 3, true], // no coordinates: last
    ]);
    expect(result.hotels[0].distanceKm).toBe(1.1);
    expect(result.hotels[1].distanceKm).toBe(27.8);
    expect(result.hotels[2].distanceKm).toBeNull();
    expect(result.hotels[0].rates[0]).toMatchObject({ rateKey: "rk-NEAR", netPrice: 120, paymentType: "deposit" });
  });

  it("defaults to the configured radius and to the split allocation would choose", async () => {
    const { service, provider } = geoSetup([]);

    const result = await service.previewHotels(
      geoBody({ adults: 2, children: 1, rooms: undefined }),
      "req",
      logger,
    );

    const options = provider.searchNearbyHotelsWithOccupancies.mock.calls[0][6];
    expect(options.radius).toBe(config.hotelSearch.defaultRadius);
    expect(result).toMatchObject({ roomSplitGiven: false, totalHotels: 0, hotels: [] });
    expect(result.rooms.length).toBeGreaterThan(0);
  });

  it("returns an empty list when the supplier finds nothing", async () => {
    const { service, provider } = geoSetup([]);
    provider.searchNearbyHotelsWithOccupancies.mockRejectedValue(
      new (require("@nestjs/common").NotFoundException)("No hotels found"),
    );

    const result = await service.previewHotels(geoBody(), "req", logger);

    expect(result).toMatchObject({ totalHotels: 0, hotels: [] });
  });

  it("validates the hotels body: radius allowed, planning fields not", async () => {
    const { PlanPreviewHotelsRequestDto } = require("../../src/cancelled-flights/dto/plan-preview-request.dto");
    const errors = async (input: object) =>
      (await validate(plainToInstance(PlanPreviewHotelsRequestDto, input), { whitelist: true, forbidNonWhitelisted: true }))
        .flatMap((e: any) => Object.values(e.constraints ?? {}));

    expect(await errors(geoBody({ radius: 30 }))).toEqual([]);
    expect((await errors(geoBody({ radius: 71 }))).join()).toContain("radius can be at most 70");
    expect((await errors(geoBody({ allocation: 3 }))).join()).toContain("property allocation should not exist");
    expect((await errors(geoBody({ minStars: 3 }))).join()).toContain("property minStars should not exist");
  });
});
