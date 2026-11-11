import { describe, expect, it } from "@jest/globals";
import {
  buildCandidatePlan,
  buildOrderCandidatePlan,
  buildSupplyPools,
  shapeKey,
  toRoomNeeds,
} from "../../src/cancelled-flights/hotel-allocation.planner";

const ROOM = { adults: 2, children: 1 };

const hotel = (
  hotelCode: string,
  stars: number,
  radius: number,
  netPrice: number,
  allotment = 5,
) => ({
  hotelCode,
  hotelName: hotelCode,
  category: `${stars} STARS`,
  address: "",
  stars,
  radius,
  rates: [
    {
      hotelCode,
      hotelName: hotelCode,
      category: `${stars} STARS`,
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
    },
  ],
});

/** Ranked hotel codes for one 2+1 room with the given class minimum. */
const ranked = (hotels: ReturnType<typeof hotel>[], min: number, poolRooms = 1) => {
  const needs = toRoomNeeds([ROOM]);
  const pools = buildSupplyPools(
    hotels as any,
    new Map([[shapeKey(ROOM), { shape: ROOM, roomsNeeded: poolRooms }]]),
    1.5,
  );
  return buildCandidatePlan(hotels as any, needs, pools, { min, preferred: min }).map(
    (candidate) => candidate.hotelCode,
  );
};

describe("star ladder ranking", () => {
  it("takes 5 stars first, even when a 4-star hotel is nearer or cheaper", () => {
    expect(
      ranked([hotel("four-near", 4, 10, 90), hotel("five-far", 5, 40, 300)], 3),
    ).toEqual(["five-far", "four-near"]);
  });

  it("goes 5 -> 4 -> 3 for a class whose minimum is 3", () => {
    expect(
      ranked([hotel("three", 3, 10, 60), hotel("five", 5, 30, 250), hotel("four", 4, 20, 120)], 3),
    ).toEqual(["five", "four", "three"]);
  });

  it("never goes below the class minimum (first class: 5 only)", () => {
    expect(ranked([hotel("four", 4, 10, 90), hotel("three", 3, 10, 60)], 5)).toEqual([]);
    expect(
      ranked([hotel("four", 4, 10, 90), hotel("five", 5, 30, 250)], 5),
    ).toEqual(["five"]);
  });

  it("stops at 4 stars for business (minimum 4)", () => {
    expect(
      ranked([hotel("three", 3, 10, 60), hotel("four", 4, 20, 120), hotel("five", 5, 30, 250)], 4),
    ).toEqual(["five", "four"]);
  });

  it("within the same stars, takes the cheapest hotel even when it is farther", () => {
    expect(
      ranked([hotel("near-pricey", 4, 10, 140), hotel("far-cheap", 4, 30, 80)], 3),
    ).toEqual(["far-cheap", "near-pricey"]);
  });

  it("within the same stars and price, takes the nearest search ring", () => {
    expect(
      ranked([hotel("far", 4, 30, 100, 5), hotel("near", 4, 10, 100, 5)], 3, 10),
    ).toEqual(["near", "far"]);
  });

  it("compares price only within the same stars", () => {
    expect(
      ranked([hotel("four-cheap", 4, 10, 70), hotel("five-pricey", 5, 10, 400)], 3),
    ).toEqual(["five-pricey", "four-cheap"]);
  });

  it("multi-room orders follow the same ladder and minimum", () => {
    const rooms = [
      { adults: 2, children: 1 },
      { adults: 2, children: 0 },
    ];
    const orderHotel = (hotelCode: string, stars: number, radius: number, netPrice: number) => ({
      ...hotel(hotelCode, stars, radius, netPrice),
      rates: [
        {
          ...hotel(hotelCode, stars, radius, netPrice).rates[0],
          adults: 4,
          children: 1,
          rooms,
        },
      ],
    });

    const order = buildOrderCandidatePlan(
      [
        orderHotel("three", 3, 10, 150),
        orderHotel("four-pricey", 4, 10, 260),
        orderHotel("four-cheap", 4, 30, 200),
        orderHotel("five-far", 5, 40, 420),
      ] as any,
      rooms,
      { min: 4, preferred: 4 },
    ).map((candidate) => candidate.hotelCode);

    expect(order).toEqual(["five-far", "four-cheap", "four-pricey"]);
  });
});

describe("hotelSetCapacity (one PNR's whole split in one hotel)", () => {
  const { hotelSetCapacity } = require("../../src/cancelled-flights/hotel-allocation.planner");
  const rate = (adults: number, children: number, allotment: number) => ({
    adults,
    children,
    allotment,
  });

  it("counts whole sets: the scarcest room type of the split decides", () => {
    const hotel = { rates: [rate(4, 1, 5), rate(3, 0, 2)] };
    expect(
      hotelSetCapacity(hotel, [
        { adults: 4, children: 1 },
        { adults: 3, children: 0 },
      ]),
    ).toBe(2);
  });

  it("counts a room type needed twice per set", () => {
    const hotel = { rates: [rate(2, 1, 5)] };
    expect(
      hotelSetCapacity(hotel, [
        { adults: 2, children: 1 },
        { adults: 2, children: 1 },
      ]),
    ).toBe(2);
  });

  it("is 0 when the hotel lacks one of the split's room types", () => {
    const hotel = { rates: [rate(4, 1, 9)] };
    expect(
      hotelSetCapacity(hotel, [
        { adults: 4, children: 1 },
        { adults: 3, children: 0 },
      ]),
    ).toBe(0);
  });
});
