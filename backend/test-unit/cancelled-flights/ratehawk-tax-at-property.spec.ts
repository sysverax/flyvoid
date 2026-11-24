import { describe, expect, it, jest } from "@jest/globals";
import { createLogger, transports } from "winston";
import { RatehawkProvider } from "../../src/cancelled-flights/hotel-providers/ratehawk/ratehawk.provider";

const logger = createLogger({
  transports: [new transports.Console({ silent: true })],
});

const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const tourismFee = { name: "tourism_fee", amount: "4.08", currency_code: "USD", included_by_supplier: false };
const vat = { name: "vat", amount: "5.00", currency_code: "USD", included_by_supplier: true };

/** One raw serp/geo hotel with one deposit rate carrying these ETG taxes. */
const rawHotel = (hid: number, taxes: object[]) => ({
  id: `hotel_${hid}`,
  hid,
  rates: [
    {
      room_name: "Double room",
      meal: "nomeal",
      rg_ext: { capacity: 2 },
      allotment: 3,
      payment_options: {
        payment_types: [
          {
            type: "deposit",
            amount: "100.00",
            show_amount: "100.00",
            currency_code: "USD",
            show_currency_code: "USD",
            tax_data: { taxes },
            cancellation_penalties: { policies: [], free_cancellation_before: null },
          },
        ],
      },
    },
  ],
});

function provider(rawHotels: object[]) {
  const loggerService = { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() };
  const ratehawk = new RatehawkProvider(loggerService as any) as any;
  ratehawk.keyId = "key";
  ratehawk.apiKey = "secret";
  ratehawk.searchGeo = jest.fn(async () => rawHotels);
  return ratehawk;
}

const search = (ratehawk: any, options: object) =>
  ratehawk.searchNearbyHotelsWithOccupancies(
    { iataCode: "DXB", latitude: 25.25, longitude: 55.36 },
    inDays(5),
    inDays(6),
    [{ adults: 2, children: 0 }],
    "req",
    logger,
    { radius: 20, residency: "AE", ...options },
  );

describe("RateHawk search: hotels with a tax payable at the hotel (filter disabled)", () => {
  it("keeps them, with each rate's taxes in the price and payable at the hotel", async () => {
    const ratehawk = provider([rawHotel(1, [tourismFee, vat]), rawHotel(2, [vat])]);

    const hotels = await search(ratehawk, {});

    expect(hotels.map((h: any) => h.hotelCode).sort()).toEqual(["1", "2"]);
    const taxed = hotels.find((h: any) => h.hotelCode === "1");
    expect(taxed.rates[0].taxesAtProperty).toEqual([{ name: "Tourism fee", amount: 4.08, currencyCode: "USD" }]);
    expect(taxed.rates[0].taxesIncluded).toEqual([{ name: "Vat", amount: 5, currencyCode: "USD" }]);
  });

  it("sends the passengers' residency to the geo search", async () => {
    const ratehawk = provider([rawHotel(1, [])]);

    await search(ratehawk, {});

    // searchGeo(airport, radius, checkin, checkout, rooms, logger, residency)
    expect(ratehawk.searchGeo.mock.calls[0][6]).toBe("ae");
  });

  it("counts what the supplier returned when a preview asks", async () => {
    const ratehawk = provider([rawHotel(1, [tourismFee]), rawHotel(2, [vat]), rawHotel(3, [])]);
    const stats = { supplierHotels: 0, withTaxAtHotel: 0 };

    await search(ratehawk, { stats });

    expect(stats).toEqual({ supplierHotels: 3, withTaxAtHotel: 1 });
  });
});
