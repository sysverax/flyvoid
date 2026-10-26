import { describe, expect, it } from "@jest/globals";
import {
  AvailabilityHotel,
  AvailabilityRoomRate,
} from "../../src/cancelled-flights/hotel-providers/hotel-provider.interface";
import {
  cancellationOf,
  compareHotelItems,
  radiusInUnit,
  radiusToKm,
  toHotelItem,
} from "../../src/hotel-availability/hotel-availability.mapper";

const rate = (overrides: Partial<AvailabilityRoomRate> = {}): AvailabilityRoomRate => ({
  hotelCode: "6291054",
  hotelName: "Grand Hotel Dubai",
  category: "Unrated",
  roomCode: null,
  roomName: "Deluxe Double",
  boardCode: "nomeal",
  boardName: "Room Only",
  rateKey: "key",
  rateType: "RECHECK",
  netPrice: 364.8,
  currency: "USD",
  allotment: 3,
  adults: 2,
  children: 0,
  childrenAges: [],
  cancellationPolicies: [],
  rateComments: null,
  paymentType: "deposit",
  ...overrides,
});

const hotel = (rates: AvailabilityRoomRate[], overrides: Partial<AvailabilityHotel> = {}): AvailabilityHotel => ({
  hotelCode: "6291054",
  hotelName: "Grand Hotel Dubai (slug)",
  category: "Unrated",
  address: "Near Airport",
  stars: 0,
  rates,
  ...overrides,
});

// DXB
const airport = { latitude: "25.2531750", longitude: "55.3656730" };

describe("cancellationOf", () => {
  it("uses RateHawk's free cancellation deadline and the penalty after it", () => {
    expect(
      cancellationOf(
        rate({
          freeCancellationBefore: "2026-11-08T12:00:00",
          cancellationPolicies: [{ amount: 182.4, from: "2026-11-08T12:00:00" }],
        }),
      ),
    ).toEqual({ freeUntil: "2026-11-08T12:00:00", penaltyAmount: 182.4 });
  });

  it("treats a null RateHawk deadline as non-refundable", () => {
    expect(
      cancellationOf(
        rate({
          freeCancellationBefore: null,
          cancellationPolicies: [{ amount: 364.8, from: "2026-10-27T00:00:00" }],
        }),
      ),
    ).toEqual({ freeUntil: null, penaltyAmount: null });
  });

  it("falls back to the earliest penalty for suppliers without a deadline", () => {
    expect(
      cancellationOf(
        rate({
          cancellationPolicies: [
            { amount: 300, from: "2026-11-09T00:00:00Z" },
            { amount: 100, from: "2026-11-07T00:00:00Z" },
          ],
        }),
      ),
    ).toEqual({ freeUntil: "2026-11-07T00:00:00Z", penaltyAmount: 100 });
  });
});

describe("toHotelItem", () => {
  it("prefers stored content, prices per night, and sorts options cheapest first", () => {
    const item = toHotelItem(
      hotel([
        rate({ roomName: "Suite", netPrice: 700 }),
        rate({
          netPrice: 364.8,
          maxGuests: 2,
          features: ["Wi-Fi"],
          taxesIncluded: [{ name: "VAT", amount: 21.3, currencyCode: "USD" }],
          taxesAtProperty: [{ name: "City tax", amount: 8, currencyCode: "AED" }],
          freeCancellationBefore: "2026-11-08T12:00:00",
        }),
      ]),
      {
        name: "Grand Hotel Dubai",
        starRating: 4,
        address: "Al Garhoud Rd, Dubai",
        latitude: "25.2400000",
        longitude: "55.3500000",
      },
      airport,
      2,
      "ratehawk",
    )!;

    expect(item).toMatchObject({
      hid: 6291054,
      name: "Grand Hotel Dubai",
      stars: 4,
      address: "Al Garhoud Rd, Dubai",
      currency: "USD",
      lowestPricePerNight: 182.4,
      lowestTotalPrice: 364.8,
      freeCancellationUntil: "2026-11-08T12:00:00",
    });
    expect(item.distanceKm).toBeGreaterThan(1);
    expect(item.distanceKm).toBeLessThan(3);
    expect(item.options.map((option) => option.roomType)).toEqual(["Deluxe Double", "Suite"]);
    expect(item.options[0]).toMatchObject({
      maxGuests: 2,
      pricePerNight: 182.4,
      totalPrice: 364.8,
      roomsAvailable: 3,
      features: ["Wi-Fi"],
      taxesIncluded: [{ name: "VAT", amount: 21.3, currency: "USD" }],
      taxesAtProperty: [{ name: "City tax", amount: 8, currency: "AED" }],
    });
  });

  it("uses search data when nothing is stored and has no HID for other suppliers", () => {
    const item = toHotelItem(
      hotel([rate()], { hotelCode: "ABC1", stars: 3, address: "1 Beach Rd", latitude: null }),
      undefined,
      airport,
      1,
      "hotelbeds",
    )!;
    expect(item).toMatchObject({
      hid: null,
      name: "Grand Hotel Dubai (slug)",
      stars: 3,
      address: "1 Beach Rd",
      distanceKm: null,
    });
  });

  it("drops hotels without a priced rate", () => {
    expect(toHotelItem(hotel([rate({ netPrice: 0 })]), undefined, airport, 1, "ratehawk")).toBeNull();
  });
});

describe("compareHotelItems", () => {
  it("sorts nearest first, unknown distance last, then cheapest", () => {
    const items = [
      { distanceKm: null, lowestTotalPrice: 10 },
      { distanceKm: 5, lowestTotalPrice: 300 },
      { distanceKm: 5, lowestTotalPrice: 100 },
      { distanceKm: 1, lowestTotalPrice: 900 },
    ] as any[];
    expect(items.sort(compareHotelItems).map((item) => [item.distanceKm, item.lowestTotalPrice])).toEqual([
      [1, 900],
      [5, 100],
      [5, 300],
      [null, 10],
    ]);
  });
});

describe("radius conversion", () => {
  it("converts km to the configured unit and back", () => {
    expect(radiusInUnit(10, "km")).toBe(10);
    expect(radiusInUnit(10, "m")).toBe(10000);
    expect(radiusInUnit(16.09344, "mi")).toBeCloseTo(10);
    expect(radiusToKm(10, "km")).toBe(10);
    expect(radiusToKm(10, "mi")).toBe(16);
    expect(radiusToKm(5000, "m")).toBe(5);
  });
});
