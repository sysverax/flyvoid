import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createLogger, transports } from "winston";
import { HotelAllocationService } from "../../src/cancelled-flights/hotel-allocation.service";
import { TravelClass } from "../../src/cancelled-flights/entities/enums";
import { config } from "../../src/config/config";

/**
 * The plan-preview test APIs must give what a real allocation run gives.
 * Both sides run the real code here; only the supplier search, the
 * repository and the supplier booking call are stubbed, with the same data.
 */

const logger = createLogger({
  transports: [new transports.Console({ silent: true })],
});

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const STAY = { checkIn: inDays(5), checkOut: inDays(6) };

const airport = {
  id: 4,
  iataCode: "DXB",
  countryCode: "AE",
  latitude: "25.25",
  longitude: "55.36",
  timezone: "Asia/Dubai",
};
const flight = { id: 42, airlineId: 3, departureAirport: airport } as any;

const familyRate = (hotelCode: string, netPrice: number, allotment: number) => ({
  hotelCode,
  hotelName: hotelCode,
  category: "",
  roomCode: null,
  roomName: "Family",
  boardCode: null,
  boardName: "RO",
  rateKey: `rk-${hotelCode}`,
  rateType: null,
  netPrice,
  currency: "USD",
  allotment,
  adults: 2,
  children: 1,
  childrenAges: [],
  cancellationPolicies: [],
  rateComments: null,
  paymentType: null,
});
const hotel = (
  hotelCode: string,
  stars: number,
  radius: number,
  netPrice: number,
  allotment: number,
) => ({
  hotelCode,
  hotelName: hotelCode,
  category: `${stars} STARS`,
  address: "",
  stars,
  radius,
  rates: [familyRate(hotelCode, netPrice, allotment)],
});

// Supplier results: one 2+1 room each, except H3 (5 rooms).
const SEARCH = {
  hotels: [
    hotel("H4a", 4, 10, 200, 1),
    hotel("H2", 2, 10, 50, 5),
    hotel("H5", 5, 10, 300, 1),
    hotel("H3", 3, 20, 90, 5),
    hotel("H4b", 4, 20, 150, 1),
  ],
  orderHotels: undefined,
};

const pnr = (id: number, travelClass: TravelClass) =>
  ({
    id,
    pnr: `PNR${id}`,
    adults: 2,
    children: 1,
    childAges: [],
    travelClass,
    residency: "ae",
    specialNotes: null,
  }) as any;

function newService() {
  const repository = {
    findFreshPlanBookingIds: jest.fn(async () => new Set<number>()),
    savePnrPlans: jest.fn(async (..._args: any[]) => undefined),
    markPnrFailed: jest.fn(async (..._args: any[]) => true),
    findAirportByIataCode: jest.fn(async () => airport),
  };
  const service = new HotelAllocationService(
    repository as any,
    {} as any,
    {} as any,
    {} as any,
  ) as any;
  service.searchSplits = jest.fn(async () =>
    JSON.parse(JSON.stringify(SEARCH)),
  );
  return { service, repository };
}

/** What a real run saves as each PNR's ranked candidates. */
async function realRunPlan(bookings: any[]) {
  const { service, repository } = newService();
  await service.planPendingBookings(
    { flight, stay: STAY, requestId: "req", requestLogger: logger },
    bookings,
    [],
  );
  const [, , , plans] = repository.savePnrPlans.mock.calls[0] as any[];
  return { service, plans };
}

let savedMinRate: number;
beforeEach(() => {
  savedMinRate = config.hotelSearch.minRate;
  (config.hotelSearch as any).minRate = 3;
});
afterEach(() => {
  (config.hotelSearch as any).minRate = savedMinRate;
});

describe("plan preview vs a real allocation run", () => {
  it("plans exactly the same ranked candidates as a run", async () => {
    const bookings = [
      pnr(1, TravelClass.FIRST_CLASS),
      pnr(2, TravelClass.ECONOMY),
      pnr(3, TravelClass.BUSINESS),
    ];
    const { plans } = await realRunPlan(bookings);

    const { service } = newService();
    const preview = await service.computePnrPlans(
      flight,
      STAY,
      bookings,
      "req",
      logger,
    );

    for (const entry of preview.entries) {
      const saved = plans.find((p: any) => p.bookingId === entry.booking.id);
      expect(entry.candidates).toEqual(saved.candidates);
    }
    // Star ladder with each class's minimum, cheapest within the same stars.
    const order = (id: number) =>
      plans.find((p: any) => p.bookingId === id).candidates.map((c: any) => c.hotelCode);
    expect(order(1)).toEqual(["H5"]); // first: 5 only
    expect(order(3)).toEqual(["H5", "H4b", "H4a"]); // business: 5 -> 4
    expect(order(2)).toEqual(["H5", "H4b", "H4a", "H3"]); // economy: 5 -> 4 -> 3
  });

  it("searches the same demand as a run (only the read-only flag differs)", async () => {
    const bookings = [pnr(1, TravelClass.ECONOMY), pnr(2, TravelClass.ECONOMY)];
    const run = newService();
    await run.service.planPendingBookings(
      { flight, stay: STAY, requestId: "req", requestLogger: logger },
      bookings,
      [],
    );
    const preview = newService();
    await preview.service.computePnrPlans(flight, STAY, bookings, "req", logger);

    const runArgs = run.service.searchSplits.mock.calls[0];
    const previewArgs = preview.service.searchSplits.mock.calls[0];
    expect(previewArgs.slice(0, 6)).toEqual(runArgs.slice(0, 6));
    expect(runArgs[7]).toBeUndefined(); // run saves hotel content as before
    expect(previewArgs[7]).toBe(true); // preview never writes
  });

  it("the preview API ranks like a run for an economy party (minimum 3 = global floor)", async () => {
    const bookings = [1, 2, 3].map((id) => pnr(id, TravelClass.ECONOMY));
    const { plans } = await realRunPlan(bookings);

    const { service } = newService();
    const result = await service.previewRecommendation(
      {
        checkInDate: STAY.checkIn,
        checkOutDate: STAY.checkOut,
        departureAirport: "DXB",
        residency: "AE",
        adults: 2,
        children: 1,
        allocation: 3,
      },
      "req",
      logger,
    );

    expect(result.candidates.map((c: any) => c.hotelCode)).toEqual(
      plans[0].candidates.map((c: any) => c.hotelCode),
    );
  });

  it("the preview API with minStars 4 ranks like a real business run (minimum 4)", async () => {
    const { plans } = await realRunPlan([pnr(1, TravelClass.BUSINESS)]);

    const { service } = newService();
    const result = await service.previewRecommendation(
      {
        checkInDate: STAY.checkIn,
        checkOutDate: STAY.checkOut,
        departureAirport: "DXB",
        residency: "AE",
        adults: 2,
        children: 1,
        minStars: 4,
      },
      "req",
      logger,
    );

    expect(result.candidates.map((c: any) => c.hotelCode)).toEqual(
      plans[0].candidates.map((c: any) => c.hotelCode),
    );
    expect(result.candidates.map((c: any) => c.hotelCode)).toEqual(["H5", "H4b", "H4a"]);
  });

  it("gives each PNR the same hotel a run books (when every booking succeeds)", async () => {
    const bookings = [1, 2, 3].map((id) => pnr(id, TravelClass.ECONOMY));
    const { service: runService, plans } = await realRunPlan(bookings);

    // Run side: the real per-PNR booking loop over the saved candidates.
    let nextId = 1;
    const saved = plans.map((plan: any) => ({
      bookingId: plan.bookingId,
      candidates: plan.candidates.map((c: any) => ({ ...c, id: nextId++, planId: "plan-1" })),
    }));
    const planning = {
      ledger: runService.buildPlanLedger(saved.flatMap((p: any) => p.candidates), []),
      contentCache: new Map(),
      restrictedHotels: new Set<string>(),
    };
    const booked: Record<number, string> = {};
    runService.attemptHotelBooking = jest.fn(async (input: any) => {
      booked[input.booking.id] = input.hotel.hotelCode;
      return { kind: "confirmed" };
    });
    for (const booking of bookings) {
      await runService.bookPlannedPnr(
        { flight, stay: STAY, requestId: "req", requestLogger: logger, runId: "run-1", platformFeePercentage: 10 },
        planning,
        booking,
        saved.find((p: any) => p.bookingId === booking.id).candidates,
        [],
      );
    }

    // Preview side.
    const { service } = newService();
    const result = await service.previewRecommendation(
      {
        checkInDate: STAY.checkIn,
        checkOutDate: STAY.checkOut,
        departureAirport: "DXB",
        residency: "AE",
        adults: 2,
        children: 1,
        allocation: 3,
      },
      "req",
      logger,
    );

    expect(result.allocations.map((a: any) => a.hotelCode)).toEqual([
      booked[1],
      booked[2],
      booked[3],
    ]);
    // H5 and H4b have one room each: PNRs spread 5* -> cheapest 4* -> next 4*.
    expect([booked[1], booked[2], booked[3]]).toEqual(["H5", "H4b", "H4a"]);
  });
});

describe("supply buffer ratio (the 150%)", () => {
  // Real searchSplits with a stubbed supplier: 2 rooms of 2+1 within 10 km,
  // 3 more within 20 km.
  function searchService() {
    const provider = {
      searchNearbyHotelsWithOccupancies: jest.fn(
        async (_a: any, _in: any, _out: any, _occ: any, _r: any, _l: any, opts: any) =>
          opts.radius <= 10
            ? [hotel("NEAR", 4, 0, 100, 2)]
            : [hotel("NEAR", 4, 0, 100, 2), hotel("FAR", 4, 0, 90, 3)],
      ),
    };
    const content = { enrichSearchResults: jest.fn(async (hotels: any) => hotels) };
    const service = new HotelAllocationService(
      {} as any,
      provider as any,
      {} as any,
      content as any,
    ) as any;
    return { service, provider };
  }
  const demand = [
    { plan: { preferred: [{ adults: 2, children: 1 }], fallbacks: [] }, minStars: 3 },
  ];
  let saved: { defaultRadius: number; maxRadius: number };
  beforeEach(() => {
    saved = {
      defaultRadius: config.hotelSearch.defaultRadius,
      maxRadius: config.hotelSearch.maxRadius,
    };
    Object.assign(config.hotelSearch, { defaultRadius: 10, maxRadius: 30 });
  });
  afterEach(() => {
    Object.assign(config.hotelSearch, saved);
  });

  it("1.5 (150%): 1 room needs 2 in supply, found within 10 km, no widening", async () => {
    const { service, provider } = searchService();

    await service.searchSplits(flight, STAY, demand, "ae", "req", logger, undefined, true, 1.5);

    expect(provider.searchNearbyHotelsWithOccupancies).toHaveBeenCalledTimes(1);
  });

  it("3 (300%): 1 room needs 3 in supply, so the search widens to 20 km", async () => {
    const { service, provider } = searchService();

    const found = await service.searchSplits(flight, STAY, demand, "ae", "req", logger, undefined, true, 3);

    expect(provider.searchNearbyHotelsWithOccupancies).toHaveBeenCalledTimes(2);
    expect(found.hotels.map((h: any) => h.hotelCode).sort()).toEqual(["FAR", "NEAR"]);
  });

  it("a real run (no ratio passed) uses HOTEL_SUPPLY_BUFFER_RATIO", async () => {
    const savedRatio = config.hotelBooking.supplyBufferRatio;
    (config.hotelBooking as any).supplyBufferRatio = 3;
    try {
      const { service, provider } = searchService();
      await service.searchSplits(flight, STAY, demand, "ae", "req", logger);
      expect(provider.searchNearbyHotelsWithOccupancies).toHaveBeenCalledTimes(2);
    } finally {
      (config.hotelBooking as any).supplyBufferRatio = savedRatio;
    }
  });

  it("the preview passes the body's ratio to both the search and the pool", async () => {
    const { service } = newService();
    service.searchSplits = jest.fn(async () => JSON.parse(JSON.stringify(SEARCH)));

    const result = await service.previewRecommendation(
      {
        checkInDate: STAY.checkIn,
        checkOutDate: STAY.checkOut,
        departureAirport: "DXB",
        adults: 2,
        children: 1,
        allocation: 2,
        supplyBufferRatio: 2,
      },
      "req",
      logger,
    );

    expect(service.searchSplits.mock.calls[0][8]).toBe(2);
    // 2 PNRs x 1 room = 2 rooms; x2 = target 4.
    expect(result.supplyPool[0]).toMatchObject({ roomsNeeded: 2, target: 4 });
  });
});

describe("search counts whole PNR sets per hotel", () => {
  const rateOf = (code: string, adults: number, children: number, allotment: number) => ({
    ...familyRate(code, 100, allotment),
    rateKey: `rk-${code}-${adults}${children}`,
    adults,
    children,
  });
  const hotelWith = (code: string, rates: any[]) => ({
    hotelCode: code,
    hotelName: code,
    category: "4 STARS",
    address: "",
    stars: 4,
    rates,
  });
  let saved: { defaultRadius: number; maxRadius: number };
  beforeEach(() => {
    saved = {
      defaultRadius: config.hotelSearch.defaultRadius,
      maxRadius: config.hotelSearch.maxRadius,
    };
    Object.assign(config.hotelSearch, { defaultRadius: 10, maxRadius: 30 });
  });
  afterEach(() => {
    Object.assign(config.hotelSearch, saved);
  });

  it("widens when the room types are in different hotels, until hotels hold whole sets", async () => {
    // 10 km: A has only 4+1 rooms, B only 3+0 rooms -> no hotel holds a set.
    // 20 km: C has both, 3 sets.
    const ring10 = [
      hotelWith("A", [rateOf("A", 4, 1, 5)]),
      hotelWith("B", [rateOf("B", 3, 0, 5)]),
    ];
    const ring20 = [
      ...ring10,
      hotelWith("C", [rateOf("C", 4, 1, 3), rateOf("C", 3, 0, 3)]),
    ];
    const provider = {
      searchNearbyHotelsWithOccupancies: jest.fn(
        async (_a: any, _in: any, _out: any, occupancies: any, _r: any, _l: any, opts: any) => {
          provider.occupancies.push(occupancies.map((o: any) => `${o.adults}+${o.children}`).sort());
          return JSON.parse(JSON.stringify(opts.radius <= 10 ? ring10 : ring20));
        },
      ),
      occupancies: [] as string[][],
    };
    const content = { enrichSearchResults: jest.fn(async (hotels: any) => hotels) };
    const service = new HotelAllocationService(
      {} as any,
      provider as any,
      {} as any,
      content as any,
    ) as any;
    const split = [
      { adults: 4, children: 1 },
      { adults: 3, children: 0 },
    ];

    await service.searchSplits(
      flight,
      STAY,
      [{ plan: { preferred: split, fallbacks: [] }, minStars: 3 }],
      "ae",
      "req",
      logger,
    );

    // 1 PNR x 1.5 -> 2 sets; 10 km has 5+5 rooms but 0 sets, so it widens.
    expect(provider.searchNearbyHotelsWithOccupancies).toHaveBeenCalledTimes(2);
    // The wider search asks for every room type of the short set.
    expect(provider.occupancies[1]).toEqual(["3+0", "4+1"]);
  });
});
