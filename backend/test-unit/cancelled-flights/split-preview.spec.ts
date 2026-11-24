import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { createLogger, transports } from "winston";
import { HotelAllocationService } from "../../src/cancelled-flights/hotel-allocation.service";
import { HotelSplitPreviewService } from "../../src/cancelled-flights/hotel-split-preview.service";
import {
  SplitPreviewNeed,
  SplitPreviewRequestDto,
} from "../../src/cancelled-flights/dto/plan-preview-request.dto";
import { config } from "../../src/config/config";

const logger = createLogger({
  transports: [new transports.Console({ silent: true })],
});

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
const STAY = {
  iataCode: "DXB",
  airport,
  residency: "ae",
  checkIn: CHECK_IN,
  checkOut: CHECK_OUT,
};

const rate = (hotelCode: string, adults: number, children: number, netPrice: number, allotment: number) => ({
  hotelCode,
  hotelName: hotelCode,
  category: "",
  roomCode: null,
  roomName: `${adults}+${children}`,
  boardCode: null,
  boardName: "RO",
  rateKey: `${hotelCode}-${adults}${children}`,
  rateType: null,
  netPrice,
  currency: "USD",
  allotment,
  adults,
  children,
  childrenAges: [],
  cancellationPolicies: [],
  rateComments: null,
  paymentType: "deposit",
});
const hotel = (code: string, stars: number, latitude: number, rates: any[]) => ({
  hotelCode: code,
  hotelName: `Hotel ${code}`,
  category: `${stars} STARS`,
  address: "",
  stars,
  latitude,
  longitude: 55.36,
  rates,
});

const body = (extra: object = {}): any => ({
  checkInDate: CHECK_IN,
  checkOutDate: CHECK_OUT,
  departureAirport: "DXB",
  residency: "AE",
  distance: 20,
  need: SplitPreviewNeed.RECOMMEND,
  splits: [{ rooms: [{ adults: 2, children: 1 }], allocation: 2 }],
  ...extra,
});

/**
 * `search` plays the supplier search for one split. It can fill in the
 * diagnostics (what the supplier returned and what was removed); otherwise the
 * hotels it returns count as returned by the supplier, none removed.
 */
function newService(search: (rooms: any[], diagnostics: any) => any) {
  // Stored hotel details: the coordinates of every hotel the search returned.
  const found = new Map<string, any>();
  const content = {
    ensureHotelContent: jest.fn(async (codes: string[]) =>
      new Map(
        codes.map((code) => [
          code,
          {
            address: `${code} Road`,
            latitude: String(found.get(code).latitude),
            longitude: String(found.get(code).longitude),
          },
        ]),
      ),
    ),
  };
  const service = new HotelAllocationService(
    {} as any,
    {} as any,
    {} as any,
    content as any,
  ) as any;
  service.searchSplits = jest.fn(
    async (_f: any, _s: any, demand: any[], _r: any, _id: any, _l: any, _radius: any, _ro: any, diagnostics: any) => {
      const result = search(demand[0].plan.preferred, diagnostics);
      const returned = [...result.hotels, ...(result.orderHotels ?? [])];
      for (const h of returned) found.set(h.hotelCode, h);
      if (diagnostics && diagnostics.returned === 0) diagnostics.returned = returned.length;
      return result;
    },
  );
  service.content = content;
  return service;
}

describe("split preview: one search per split at exactly the distance", () => {
  it("searches each split once, at the given distance, read only", async () => {
    const service = newService(() => ({ hotels: [], orderHotels: undefined }));

    await service.computeSplitPreview(
      body({
        splits: [
          { rooms: [{ adults: 2, children: 1 }], allocation: 3 },
          { rooms: [{ adults: 2, children: 2 }], allocation: 4 },
        ],
      }),
      STAY,
      "req",
      logger,
    );

    expect(service.searchSplits).toHaveBeenCalledTimes(2);
    const [flight, stay, demand, residency, , , radius, readOnly] =
      service.searchSplits.mock.calls[1];
    expect(flight.departureAirport).toBe(airport);
    expect(stay).toEqual({ checkIn: CHECK_IN, checkOut: CHECK_OUT });
    expect(demand).toEqual([
      {
        plan: { preferred: [{ adults: 2, children: 2 }], fallbacks: [] },
        minStars: config.hotelSearch.minRate,
      },
    ]);
    expect([residency, radius, readOnly]).toEqual(["ae", 20, true]);
  });

  it("need=all returns every hotel found, nearest first, with whole sets per hotel", async () => {
    const service = newService(() => ({
      hotels: [
        hotel("FAR", 5, 25.5, [rate("FAR", 2, 1, 300, 4)]),
        hotel("NEAR", 2, 25.26, [rate("NEAR", 2, 1, 80, 1)]),
      ],
      orderHotels: undefined,
    }));

    const result = await service.computeSplitPreview(
      body({ need: SplitPreviewNeed.ALL }),
      STAY,
      "req",
      logger,
    );

    expect(result).toMatchObject({ need: "all", distance: 20, departureAirport: "DXB", residency: "AE" });
    const [split] = result.splits;
    expect(split).toMatchObject({ splitNo: 1, allocation: 2, totalHotels: 2 });
    expect(split.hotels.map((h: any) => [h.hotelCode, h.stars, h.sets])).toEqual([
      ["NEAR", 2, 1], // below the minimum stars, still listed
      ["FAR", 5, 4],
    ]);
    expect(split.hotels[0]).toMatchObject({ distanceKm: 1.1, address: "NEAR Road" });
    expect(split.hotels[0].rates[0]).toMatchObject({ rateKey: "NEAR-21", netPrice: 80 });
    // Coordinates come from stored hotel details, read without saving.
    expect(service.content.ensureHotelContent.mock.calls[0][4]).toBe(true);
  });

  it("need=recommend takes ceil(allocation x 1.5) sets, most stars first, cheapest within the same stars", async () => {
    const service = newService(() => ({
      hotels: [
        hotel("FOUR_CHEAP", 4, 25.3, [rate("FOUR_CHEAP", 2, 1, 150, 1)]),
        hotel("FIVE", 5, 25.4, [rate("FIVE", 2, 1, 300, 1)]),
        hotel("FOUR_DEAR", 4, 25.27, [rate("FOUR_DEAR", 2, 1, 200, 5)]),
        hotel("TWO", 2, 25.26, [rate("TWO", 2, 1, 50, 9)]),
      ],
      orderHotels: undefined,
    }));

    const result = await service.computeSplitPreview(
      body({ splits: [{ rooms: [{ adults: 2, children: 1 }], allocation: 3 }] }),
      STAY,
      "req",
      logger,
    );

    const [split] = result.splits;
    // 3 allocations x 1.5 -> 5 sets: 5* (1), cheapest 4* (1), next 4* (3).
    expect(split).toMatchObject({ setsNeeded: 3, target: 5, setsFound: 5, targetMet: true });
    expect(
      split.recommendedHotels.map((h: any) => [h.rank, h.hotelCode, h.sets, h.totalPrice]),
    ).toEqual([
      [1, "FIVE", 1, 300],
      [2, "FOUR_CHEAP", 1, 150],
      [3, "FOUR_DEAR", 3, 600],
    ]);
  });

  it("keeps all of an allocation's rooms in one hotel", async () => {
    const rooms = [
      { adults: 2, children: 1 },
      { adults: 1, children: 2 },
    ];
    const service = newService(() => ({
      hotels: [
        // Only the 2+1 room: cannot take a whole set.
        hotel("HALF", 5, 25.3, [rate("HALF", 2, 1, 100, 9)]),
        // Both rooms, enough for two sets.
        hotel("BOTH", 4, 25.3, [rate("BOTH", 2, 1, 100, 2), rate("BOTH", 1, 2, 90, 2)]),
      ],
      orderHotels: undefined,
    }));

    const result = await service.computeSplitPreview(
      body({ splits: [{ rooms, allocation: 2 }] }),
      STAY,
      "req",
      logger,
    );

    const [split] = result.splits;
    expect(split.recommendedHotels.map((h: any) => [h.hotelCode, h.sets])).toEqual([["BOTH", 2]]);
    // 2 x 1.5 = 3 sets needed; only 2 whole sets exist.
    expect(split).toMatchObject({ target: 3, setsFound: 2, targetMet: false });
    expect(split.recommendedHotels[0].setPrices).toEqual([190, 190]);
  });

  it("prices a multi-room split booked as one order once per set (order price covers all rooms)", async () => {
    const rooms = [
      { adults: 2, children: 0 },
      { adults: 2, children: 0 },
    ];
    const orderRate = { ...rate("ORDER", 2, 0, 404, 4), rooms };
    const service = newService(() => ({
      hotels: [],
      orderHotels: [hotel("ORDER", 5, 25.3, [orderRate])],
    }));

    const result = await service.computeSplitPreview(
      body({ splits: [{ rooms, allocation: 1 }] }),
      STAY,
      "req",
      logger,
    );

    const [split] = result.splits;
    expect(split).toMatchObject({ bookedAsOneOrder: true, target: 2, setsFound: 2 });
    expect(split.recommendedHotels[0]).toMatchObject({
      hotelCode: "ORDER",
      sets: 2,
      setPrices: [404, 404],
      totalPrice: 808,
    });
  });

  it("treats splits independently: each sees the full stock", async () => {
    const service = newService(() => ({
      hotels: [hotel("ONLY", 4, 25.3, [rate("ONLY", 2, 1, 100, 2)])],
      orderHotels: undefined,
    }));

    const result = await service.computeSplitPreview(
      body({
        splits: [
          { rooms: [{ adults: 2, children: 1 }], allocation: 1 },
          { rooms: [{ adults: 2, children: 1 }], allocation: 1 },
        ],
      }),
      STAY,
      "req",
      logger,
    );

    expect(result.splits.map((s: any) => s.recommendedHotels[0].sets)).toEqual([2, 2]);
  });

  it("reports a failed search on its split and carries on with the others", async () => {
    let call = 0;
    const service = newService(() => {
      call += 1;
      if (call === 1) throw new Error("RateHawk serp/geo failed (HTTP 429)");
      throw new NotFoundException("No hotels found");
    });

    const result = await service.computeSplitPreview(
      body({
        splits: [
          { rooms: [{ adults: 2, children: 1 }], allocation: 1 },
          { rooms: [{ adults: 2, children: 2 }], allocation: 1 },
        ],
      }),
      STAY,
      "req",
      logger,
    );

    expect(result.splits[0].error).toContain("HTTP 429");
    expect(result.splits[1]).toMatchObject({ setsFound: 0, targetMet: false, recommendedHotels: [] });
  });
});

describe("split preview request body", () => {
  const messages = (error: any): string[] => [
    ...(Object.values(error.constraints ?? {}) as string[]),
    ...(error.children ?? []).flatMap(messages),
  ];
  const errorsFor = async (input: object) =>
    (
      await validate(plainToInstance(SplitPreviewRequestDto, input), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).flatMap(messages);

  it("accepts several splits with their allocations", async () => {
    expect(
      await errorsFor(
        body({
          splits: [
            { rooms: [{ adults: 2, children: 1 }, { adults: 1, children: 2 }], allocation: 3 },
            { rooms: [{ adults: 2, children: 2 }], allocation: 4 },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it.each([
    [{ need: "best" }, "need must be 'all' or 'recommend'"],
    [{ distance: 0 }, "distance must be at least 1"],
    [{ distance: undefined }, "distance must be an integer"],
    [{ splits: [] }, "splits must have at least 1 room split"],
    [{ splits: [{ rooms: [{ adults: 2, children: 0 }] }] }, "allocation must be an integer"],
    [{ splits: [{ rooms: [{ adults: 0, children: 1 }], allocation: 1 }] }, "Each room needs at least 1 adult"],
    [{ checkInDate: "20/11/2026" }, "checkInDate must be a calendar date in YYYY-MM-DD format"],
  ])("rejects %j", async (change, message) => {
    expect((await errorsFor(body(change))).join(" | ")).toContain(message);
  });
});

describe("split preview jobs (POST starts, GET reads)", () => {
  function jobs(row: any = null) {
    const executed: string[] = [];
    const builder: any = {
      delete: () => builder,
      insert: () => builder,
      values: (values: any) => {
        builder.inserted = values;
        return builder;
      },
      where: (sql: string) => {
        executed.push(sql);
        return builder;
      },
      select: () => builder,
      addSelect: () => builder,
      andWhere: (sql: string) => {
        executed.push(sql);
        return builder;
      },
      setParameter: () => builder,
      execute: jest.fn(async () => undefined),
      getRawAndEntities: jest.fn(async () =>
        row ? { entities: [row.entity], raw: [{ stale: row.stale ?? false }] } : { entities: [], raw: [] },
      ),
    };
    const previews = {
      createQueryBuilder: () => builder,
      update: jest.fn(async (..._args: any[]) => undefined),
    };
    const allocation = {
      resolvePreviewStay: jest.fn(async () => STAY),
      computeSplitPreview: jest.fn(async () => ({ splits: [] })),
    };
    const service = new HotelSplitPreviewService(previews as any, allocation as any);
    return { service, previews, allocation, builder, executed };
  }
  const airlineUser = { sub: 7, userType: "AIRLINE", airlineId: 3 } as any;

  it("checks the body, stores a RUNNING row with a 5-day expiry, and returns its id at once", async () => {
    const { service, previews, allocation, builder, executed } = jobs();

    const started = await service.start(body(), airlineUser, "http-req", logger);

    expect(allocation.resolvePreviewStay).toHaveBeenCalled();
    expect(executed).toContain("expires_at <= now()"); // expired rows removed
    expect(builder.inserted).toMatchObject({
      id: started.requestId,
      status: "RUNNING",
      airlineId: 3,
      userId: 7,
    });
    expect(builder.inserted.expiresAt()).toBe("now() + interval '5 days'");
    expect(started).toMatchObject({ status: "RUNNING", need: "recommend", splits: 1 });
    expect(started.requestId).toMatch(/^[0-9a-f-]{36}$/);

    await new Promise((resolve) => setImmediate(resolve));
    expect(previews.update).toHaveBeenCalledWith(
      { id: started.requestId },
      { status: "COMPLETED", result: { splits: [] } },
    );
  });

  it("saves FAILED with the error when the background work throws", async () => {
    const { service, previews, allocation } = jobs();
    allocation.computeSplitPreview.mockRejectedValue(new Error("boom") as never);

    const started = await service.start(body(), airlineUser, "http-req", logger);
    await new Promise((resolve) => setImmediate(resolve));

    expect(previews.update).toHaveBeenCalledWith(
      { id: started.requestId },
      { status: "FAILED", error: "boom" },
    );
  });

  it("rejects a bad airport or dates with 400 before storing anything", async () => {
    const { service, allocation, builder } = jobs();
    allocation.resolvePreviewStay.mockRejectedValue(
      new BadRequestException("Airport 'ZZZ' not found") as never,
    );

    await expect(service.start(body(), airlineUser, "http-req", logger)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(builder.inserted).toBeUndefined();
    expect(allocation.computeSplitPreview).not.toHaveBeenCalled();
  });

  it("GET returns the stored result to the same airline and to platform users", async () => {
    const entity = {
      id: "9d6e7d8c-3a51-4f0e-9c1a-2f3b4c5d6e7f",
      status: "COMPLETED",
      request: body(),
      result: { splits: [] },
      error: null,
      airlineId: 3,
    };
    const { service, executed } = jobs({ entity });

    await expect(service.get(entity.id, airlineUser)).resolves.toMatchObject({
      requestId: entity.id,
      status: "COMPLETED",
      result: { splits: [] },
    });
    expect(executed).toContain("p.expires_at > now()");
    await expect(service.get(entity.id, { userType: "PLATFORM" } as any)).resolves.toMatchObject({
      status: "COMPLETED",
    });
  });

  it("GET hides another airline's preview and unknown or expired ids (404)", async () => {
    const other = jobs({ entity: { id: "x", status: "COMPLETED", airlineId: 9 } });
    await expect(other.service.get("x", airlineUser)).rejects.toBeInstanceOf(NotFoundException);
    const missing = jobs();
    await expect(missing.service.get("x", airlineUser)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("GET reports a job cut off while RUNNING (e.g. by a restart) as FAILED", async () => {
    const { service } = jobs({ entity: { id: "x", status: "RUNNING", airlineId: 3 }, stale: true });

    const result = await service.get("x", airlineUser);

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("stopped before it finished");
  });
});

describe("split preview explains a split with no hotels", () => {
  const allBody = (extra: object = {}) => body({ need: SplitPreviewNeed.ALL, ...extra });
  let savedMinRate: number;
  beforeEach(() => {
    savedMinRate = config.hotelSearch.minRate;
    (config.hotelSearch as any).minRate = 3;
  });
  afterEach(() => {
    (config.hotelSearch as any).minRate = savedMinRate;
  });

  it("says the supplier's geo search returned nothing when it did", async () => {
    const service = newService(() => {
      throw new NotFoundException("No hotels found");
    });

    const result = await service.computeSplitPreview(allBody(), STAY, "req", logger);

    const [split] = result.splits;
    expect(split).toMatchObject({
      totalHotels: 0,
      hotels: [],
      search: { radius: 20, supplierHotels: 0, removedNoUsableRate: 0, removedClosed: 0, hotels: 0 },
    });
    expect(split.emptyReason).toContain("geo search returned no hotels within 20 km of DXB for 2+1");
    expect(split.emptyReason).toContain("Nothing was removed by our filters");
  });

  it("says how many hotels the supplier returned and why each was removed", async () => {
    const service = newService((_rooms, diagnostics) => {
      diagnostics.supplierHotels = 5;
      diagnostics.returned = 3; // the other 2 had no usable rate
      diagnostics.closedOrRemoved = 3;
      throw new NotFoundException("No hotels found");
    });

    const result = await service.computeSplitPreview(allBody(), STAY, "req", logger);

    const [split] = result.splits;
    expect(split.search).toMatchObject({ supplierHotels: 5, removedNoUsableRate: 2, removedClosed: 3, hotels: 0 });
    expect(split.emptyReason).toBe(
      "The supplier returned 5 hotels, but all were removed: 2 hotels had no usable rate (no payment option); 3 hotels are closed or removed according to the supplier's hotel content.",
    );
  });

  it("recommend: explains why hotels were found but none can take an allocation", async () => {
    const service = newService(() => ({
      hotels: [
        hotel("FULL", 4, 25.3, [rate("FULL", 2, 1, 90, 0)]), // no rooms left
        hotel("UNKNOWN", 5, 25.3, [{ ...rate("UNKNOWN", 2, 1, 90, 0), allotment: null }]), // rooms left not given
      ],
      orderHotels: undefined,
    }));

    const result = await service.computeSplitPreview(body(), STAY, "req", logger);

    const [split] = result.splits;
    expect(split).toMatchObject({ setsFound: 0, recommendedHotels: [], totalHotelsFound: 2 });
    expect(split.emptyReason).toBe(
      "The search found 2 hotels, but none can take one allocation: 2 hotels without free rooms (allotment missing or too low) for every room of the split.",
    );
  });

  it("recommend: falls back to hotels below the minimum stars instead of leaving the split empty", async () => {
    const service = newService(() => ({
      hotels: [hotel("LOW", 2, 25.3, [rate("LOW", 2, 1, 50, 9)])],
      orderHotels: undefined,
    }));

    const result = await service.computeSplitPreview(body(), STAY, "req", logger);

    const [split] = result.splits;
    expect(split.emptyReason).toBeUndefined();
    expect(split.recommendedHotels.map((h: any) => [h.hotelCode, h.stars])).toEqual([["LOW", 2]]);
  });

  it("gives no reason when a split has hotels, but always shows the search counts", async () => {
    const service = newService(() => ({
      hotels: [hotel("A", 4, 25.3, [rate("A", 2, 1, 100, 3)])],
      orderHotels: undefined,
    }));

    const result = await service.computeSplitPreview(allBody(), STAY, "req", logger);

    const [split] = result.splits;
    expect(split.emptyReason).toBeUndefined();
    expect(split.search).toMatchObject({ supplierHotels: 1, removedNoUsableRate: 0, removedClosed: 0, hotels: 1 });
  });
});

describe("split preview shows each hotel's taxes", () => {
  const taxedRate = (code: string) => ({
    ...rate(code, 2, 1, 100, 4),
    taxesIncluded: [{ name: "Vat", amount: 5, currencyCode: "USD" }],
    taxesAtProperty: [{ name: "Tourism dirham fee", amount: 4.08, currencyCode: "USD" }],
  });

  it("need = all: every rate's taxes, and a flag on hotels with a tax payable at the hotel", async () => {
    const service = newService(() => ({
      hotels: [
        hotel("TAXED", 5, 25.3, [taxedRate("TAXED")]),
        hotel("FREE", 4, 25.4, [rate("FREE", 2, 1, 90, 2)]),
      ],
      orderHotels: undefined,
    }));

    const result = await service.computeSplitPreview(body({ need: SplitPreviewNeed.ALL }), STAY, "req", logger);

    const byCode = Object.fromEntries(result.splits[0].hotels.map((h: any) => [h.hotelCode, h]));
    expect(byCode.TAXED.taxPayableAtHotel).toBe(true);
    expect(byCode.TAXED.rates[0]).toMatchObject({
      taxesIncluded: [{ name: "Vat", amount: 5, currencyCode: "USD" }],
      taxesAtProperty: [{ name: "Tourism dirham fee", amount: 4.08, currencyCode: "USD" }],
    });
    expect(byCode.FREE.taxPayableAtHotel).toBe(false);
    expect(byCode.FREE.rates[0]).toMatchObject({ taxesIncluded: [], taxesAtProperty: [] });
  });

  it("need = recommend: the recommended hotel's flag and its rooms' taxes", async () => {
    const service = newService(() => ({
      hotels: [hotel("TAXED", 5, 25.3, [taxedRate("TAXED")])],
      orderHotels: undefined,
    }));

    const result = await service.computeSplitPreview(body(), STAY, "req", logger);

    const [recommended] = result.splits[0].recommendedHotels;
    expect(recommended).toMatchObject({ hotelCode: "TAXED", taxPayableAtHotel: true });
    expect(recommended.rooms[0].taxesAtProperty).toEqual([
      { name: "Tourism dirham fee", amount: 4.08, currencyCode: "USD" },
    ]);
  });
});

describe("split preview read message", () => {
  it("names each split left without hotels, and why", () => {
    const message = HotelSplitPreviewService.messageFor({
      status: "COMPLETED",
      result: {
        splits: [
          { splitNo: 1, hotels: [{ hotelCode: "A" }] },
          { splitNo: 2, emptyReason: "The supplier (ratehawk) geo search returned no hotels." },
        ],
      },
    });

    expect(message).toBe(
      "Hotel split preview fetched; no hotels for split 2: The supplier (ratehawk) geo search returned no hotels.",
    );
  });

  it("keeps the usual message when every split has hotels, and while running", () => {
    expect(
      HotelSplitPreviewService.messageFor({ status: "COMPLETED", result: { splits: [{ splitNo: 1 }] } }),
    ).toBe("Hotel split preview fetched successfully");
    expect(HotelSplitPreviewService.messageFor({ status: "RUNNING", result: null })).toBe(
      "Hotel split preview fetched successfully",
    );
  });
});

describe("allocation search counts what it found, only when a preview asks", () => {
  const demand = [{ plan: { preferred: [{ adults: 2, children: 1 }], fallbacks: [] }, minStars: 3 }];
  const flight = { id: 0, departureAirport: airport } as any;
  const stay = { checkIn: CHECK_IN, checkOut: CHECK_OUT };
  function searchService() {
    const provider = {
      searchNearbyHotelsWithOccupancies: jest.fn(async (...args: any[]) => {
        const options = args[6];
        if (options.stats) {
          options.stats.supplierHotels += 3; // one more was dropped by the supplier search
          options.stats.withTaxAtHotel += 1;
        }
        return [
          hotel("OPEN", 4, 25.3, [rate("OPEN", 2, 1, 100, 2)]),
          hotel("SHUT", 4, 25.3, [rate("SHUT", 2, 1, 100, 2)]),
        ];
      }),
    };
    // The stored content says SHUT is closed.
    const content = {
      enrichSearchResults: jest.fn(async (hotels: any[]) => hotels.filter((h) => h.hotelCode !== "SHUT")),
    };
    const service = new HotelAllocationService({} as any, provider as any, {} as any, content as any) as any;
    return { service, provider };
  }

  it("a real allocation search passes the supplier exactly the same options as before", async () => {
    const { service, provider } = searchService();

    await service.searchSplits(flight, stay, demand, "ae", "req", logger, 20);

    expect(provider.searchNearbyHotelsWithOccupancies.mock.calls[0][6]).toEqual({ residency: "ae", radius: 20 });
  });

  it("a preview gets what the supplier returned and what was removed as closed", async () => {
    const { service, provider } = searchService();
    const diagnostics = { supplierHotels: 0, withTaxAtHotel: 0, returned: 0, closedOrRemoved: 0 };

    const found = await service.searchSplits(flight, stay, demand, "ae", "req", logger, 20, true, diagnostics);

    expect(provider.searchNearbyHotelsWithOccupancies.mock.calls[0][6]).toMatchObject({
      residency: "ae",
      radius: 20,
      stats: diagnostics,
    });
    expect(diagnostics).toEqual({ supplierHotels: 3, withTaxAtHotel: 1, returned: 2, closedOrRemoved: 1 });
    expect(found.hotels.map((h: any) => h.hotelCode)).toEqual(["OPEN"]);
  });
});
