import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { createLogger, transports } from "winston";
import { HotelAllocationService } from "../../src/cancelled-flights/hotel-allocation.service";
import { HotelContentService } from "../../src/cancelled-flights/hotel-content.service";
import { PlanPreviewHotelsRequestDto } from "../../src/cancelled-flights/dto/plan-preview-request.dto";
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

const booking = (id: number, pnr: string, travelClass: string, extra: object = {}) => ({
  id,
  pnr,
  travelClass,
  adults: 7,
  children: 1,
  childAges: [5],
  specialNotes: null,
  residency: "ae",
  ...extra,
});

const FLIGHT = {
  id: 42,
  airlineId: 3,
  flightNumber: "FV101",
  status: "passengers_booking_confirmed",
  checkInDate: CHECK_IN,
  checkOutDate: CHECK_OUT,
  departureAirport: airport,
};
const AIRLINE_USER = { userType: "AIRLINE", airlineId: 3 };

function setup(
  candidates = [candidate("A", 4, 2, 5), candidate("B", 3, 3, 3)],
  bookings: any[] = [
    booking(1, "ECO1", "economy"),
    booking(2, "FIRST1", "first_class"),
    booking(3, "ECO2", "economy"),
  ],
) {
  const repository = {
    findFlightWithRelations: jest.fn(async (..._args: any[]) => FLIGHT as any),
    findBookingsByFlightId: jest.fn(async (..._args: any[]) => bookings),
  };
  const service = new HotelAllocationService(
    repository as any,
    {} as any,
    {} as any,
    {} as any,
  ) as any;
  service.computePnrPlans = jest.fn(async (_f: any, _s: any, planned: any[]) => ({
    invalid: [],
    hotels: [],
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
    entries: planned.map((b) => ({
      booking: b,
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

const preview = (service: any, user: object = AIRLINE_USER) =>
  service.previewFlightAllocation(42, user, "req", logger);

describe("flight allocation preview (by cancelled flight id)", () => {
  it("plans all the flight's PNRs in the run's order: higher class first", async () => {
    const { service, repository } = setup();

    await preview(service);

    expect(repository.findFlightWithRelations).toHaveBeenCalledWith(42, logger);
    const [flight, stay, planned] = service.computePnrPlans.mock.calls[0];
    expect(flight).toBe(FLIGHT);
    expect(stay).toEqual({ checkIn: CHECK_IN, checkOut: CHECK_OUT });
    expect(planned.map((b: any) => b.pnr)).toEqual(["FIRST1", "ECO1", "ECO2"]);
  });

  it("groups PNRs by class in booking order, each with its ranked hotels", async () => {
    const { service } = setup();

    const result = await preview(service);

    expect(
      result.classes.map((c: any) => [c.travelClass, c.pnrs.map((p: any) => p.pnr)]),
    ).toEqual([
      ["first_class", ["FIRST1"]],
      ["economy", ["ECO1", "ECO2"]],
    ]);
    const first = result.classes[0].pnrs[0];
    expect(first).toMatchObject({
      order: 1,
      bookingId: 2,
      adults: 7,
      children: 1,
      minStars: 3,
      chosenRooms: SPLIT,
      bookedAsOneOrder: false,
      totalCandidates: 2,
    });
    expect(first.candidates.map((c: any) => [c.rank, c.hotelCode])).toEqual([
      [1, "A"],
      [2, "B"],
    ]);
  });

  it("gives each PNR all its rooms in one hotel, moving on when rooms run out", async () => {
    const { service } = setup();

    const result = await preview(service);

    // Hotel A has two 4+1 rooms: the first two PNRs there, the third moves to B.
    const picks = result.classes
      .flatMap((c: any) => c.pnrs)
      .map((p: any) => [p.pnr, p.recommended.hotelCode, p.recommended.rank]);
    expect(picks).toEqual([
      ["FIRST1", "A", 1],
      ["ECO1", "A", 1],
      ["ECO2", "B", 2],
    ]);
    const first = result.classes[0].pnrs[0].recommended;
    expect(first.rooms.map((r: any) => r.rateKey)).toEqual(["A-41", "A-30"]);
    expect(first.price).toBe(300);
    expect(result).toMatchObject({ totalPnrs: 3, allocatedPnrs: 3, allAllocated: true });
  });

  it("reports a PNR that no hotel can take", async () => {
    const { service } = setup([candidate("A", 4, 1, 5), candidate("B", 3, 1, 3)]);

    const result = await preview(service);

    const last = result.classes[1].pnrs[1];
    expect(last.recommended).toBeNull();
    expect(last.reason).toContain("No ranked hotel has free rooms left");
    expect(result).toMatchObject({ allocatedPnrs: 2, unallocatedPnrs: 1, allAllocated: false });
  });

  it("shows the flight, stay and the supply pool", async () => {
    const { service } = setup();

    const result = await preview(service);

    expect(result).toMatchObject({
      cancelledFlightId: 42,
      flightNumber: "FV101",
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      departureAirport: "DXB",
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
  });

  it("lists a PNR with no room split rule with its reason", async () => {
    const { service } = setup();
    const original = service.computePnrPlans;
    service.computePnrPlans = jest.fn(async (...args: any[]) => {
      const plan = await original(...args);
      const [bad, ...rest] = plan.entries;
      return {
        ...plan,
        invalid: [{ booking: bad.booking, reason: "No room split rule configured" }],
        entries: rest,
      };
    });

    const result = await preview(service);

    expect(result.classes[0].pnrs[0]).toMatchObject({
      pnr: "FIRST1",
      recommended: null,
      reason: "Invalid passenger data: No room split rule configured",
    });
  });

  it("hides another airline's flight (404) and lets a platform user see any", async () => {
    const { service } = setup();

    await expect(preview(service, { userType: "AIRLINE", airlineId: 9 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(service.computePnrPlans).not.toHaveBeenCalled();
    await expect(preview(service, { userType: "PLATFORM" })).resolves.toMatchObject({
      cancelledFlightId: 42,
    });
  });

  it("rejects a flight with no PNRs before any supplier search", async () => {
    const { service } = setup(undefined, []);

    await expect(preview(service)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.computePnrPlans).not.toHaveBeenCalled();
  });
});

describe("hotels preview request checks", () => {
  const body = (extra: object = {}) =>
    ({
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      departureAirport: "dxb",
      residency: "AE",
      adults: 7,
      children: 1,
      rooms: SPLIT,
      ...extra,
    }) as any;
  const errorsFor = async (input: object) =>
    (
      await validate(plainToInstance(PlanPreviewHotelsRequestDto, input), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).flatMap((e: any) => [
      ...Object.values(e.constraints ?? {}),
      ...(e.children ?? []).flatMap((c: any) =>
        (c.children ?? []).flatMap((g: any) => Object.values(g.constraints ?? {})),
      ),
    ]);

  it.each([
    [{ checkInDate: "20/11/2026" }, "checkInDate must be a calendar date in YYYY-MM-DD format"],
    [{ departureAirport: "DUBAI" }, "departureAirport must be a 3-letter IATA code"],
    [{ adults: 0 }, "adults must be at least 1"],
    [{ rooms: [{ adults: 0, children: 1 }] }, "Each room needs at least 1 adult"],
  ])("rejects %j", async (change, message) => {
    const errors = await errorsFor({ ...body(), departureAirport: "DXB", ...change });
    expect(errors.join(" | ")).toContain(message);
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
    const repository = {
      findAirportByIataCode: jest.fn(async (code: string) => (code === "DXB" ? airport : null)),
    };
    const provider = { searchNearbyHotelsWithOccupancies: jest.fn() };
    const service = new HotelAllocationService(
      repository as any,
      provider as any,
      {} as any,
      {} as any,
    ) as any;

    const call = service.previewHotels(input, "req", logger);

    await expect(call).rejects.toBeInstanceOf(BadRequestException);
    await expect(call).rejects.toThrow(message);
    expect(provider.searchNearbyHotelsWithOccupancies).not.toHaveBeenCalled();
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
    const errors = async (input: object) =>
      (await validate(plainToInstance(PlanPreviewHotelsRequestDto, input), { whitelist: true, forbidNonWhitelisted: true }))
        .flatMap((e: any) => Object.values(e.constraints ?? {}));

    expect(await errors(geoBody({ radius: 30 }))).toEqual([]);
    expect((await errors(geoBody({ radius: 71 }))).join()).toContain("radius can be at most 70");
    expect((await errors(geoBody({ allocation: 3 }))).join()).toContain("property allocation should not exist");
    expect((await errors(geoBody({ minStars: 3 }))).join()).toContain("property minStars should not exist");
  });
});
