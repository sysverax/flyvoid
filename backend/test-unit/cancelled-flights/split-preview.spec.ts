import { describe, expect, it, jest } from "@jest/globals";
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

function newService(search: (rooms: any[]) => any) {
  const service = new HotelAllocationService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  ) as any;
  service.searchSplits = jest.fn(async (_f: any, _s: any, demand: any[]) =>
    search(demand[0].plan.preferred),
  );
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
    expect(split.hotels[0].distanceKm).toBe(1.1);
    expect(split.hotels[0].rates[0]).toMatchObject({ rateKey: "NEAR-21", netPrice: 80 });
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
