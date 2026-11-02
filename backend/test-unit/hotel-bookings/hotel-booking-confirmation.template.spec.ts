import { describe, expect, it } from "@jest/globals";
import {
  buildHotelBookingConfirmationHtml,
  HotelBookingConfirmationInput,
} from "../../src/hotel-bookings/templates/hotel-booking-confirmation.template";

// Fake data only.
const input = (overrides: Partial<HotelBookingConfirmationInput> = {}): HotelBookingConfirmationInput => ({
  flyveraxConfirmationId: "445",
  partnerOrderId: null,
  references: [{ rooms: [1, 2], reference: "102-1234567", hotelConfirmation: null }],
  referenceQrDataUrl: null,
  issuedDate: "Nov 01, 2026",
  airlineName: "Example Airways",
  airlineSupport: null,
  guest: {
    names: ["Alex Sample"],
    email: "alex@example.test",
    phone: null,
    pnr: "TEST001",
    adults: 2,
    children: 1,
  },
  flight: {
    flightNumber: "XX0001",
    departure: "CDG - Paris",
    arrival: "JFK - New York",
    cancellationDate: "Thu, Nov 26, 2026",
  },
  hotel: {
    policies: {
      checkInTime: "15:00",
      checkOutTime: "12:00",
      extraInfo: "Please bring a valid photo ID and a credit card.",
      items: [{ category: "Deposit", details: ["EUR 100 per stay, refundable"] }],
    },
    name: "Hotel Example",
    rating: "4 STARS",
    address: "1 Example Street, Paris",
    frontDeskPhone: null,
    reservationsPhone: null,
    distanceFromAirportKm: 24.6,
    airportCode: "CDG",
  },
  stay: {
    checkInDate: "Thu, Nov 26, 2026",
    checkOutDate: "Fri, Nov 27, 2026",
    nights: 1,
    rooms: [
      { roomNo: 1, roomName: "Superior Double room", boardName: "Breakfast included", adults: 1, children: 0, taxesAtProperty: [{ name: "City tax", amount: 5.2, currencyCode: "EUR" }] },
      { roomNo: 2, roomName: "Superior Twin room", boardName: "Breakfast included", adults: 1, children: 1, taxesAtProperty: [{ name: "City tax", amount: 2.6, currencyCode: "EUR" }] },
    ],
  },
  ...overrides,
});

const visibleText = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&ndash;/g, "–")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("hotel booking confirmation template", () => {
  it("shows the key facts and the supplier reference exactly as stored", () => {
    const text = visibleText(buildHotelBookingConfirmationHtml(input()));
    for (const fact of [
      "Booking reference – show this at check-in",
      "102-1234567",
      "Alex Sample",
      "Hotel Example",
      "1 Example Street, Paris",
      "24.6 km from CDG airport",
      "Thu, Nov 26, 2026",
      "Fri, Nov 27, 2026",
      "Room and meals prepaid by Example Airways",
      "Disruption Hotel Accommodation Services",
      "Flyverax confirmation ID: 445",
      "Airport transfers are not included.",
      "If your flight is rebooked and you no longer need this room, please contact Example Airways",
    ]) {
      expect(text).toContain(fact);
    }
    expect(text).not.toMatch(/flyvoid/i);
    expect(text).not.toContain("FULLY PREPAID");
  });

  it("totals local taxes per currency and lists deposit and ID/credit card only from the data", () => {
    const text = visibleText(buildHotelBookingConfirmationHtml(input()));
    expect(text).toContain("What you may need to pay or show at the hotel");
    expect(text).toContain("7.80 EUR in total");
    expect(text).toContain("Deposit: EUR 100 per stay, refundable");
    expect(text).toContain("Please present photo ID and a credit card");

    const plain = visibleText(
      buildHotelBookingConfirmationHtml(
        input({
          hotel: { ...input().hotel, policies: null },
          stay: { ...input().stay, rooms: input().stay.rooms.map((room) => ({ ...room, taxesAtProperty: [] })) },
        }),
      ),
    );
    expect(plain).not.toContain("What you may need to pay or show at the hotel");
    expect(plain).not.toContain("Deposit");
  });

  it("lists one reference per room when rooms have different references, with no QR code", () => {
    const html = buildHotelBookingConfirmationHtml(
      input({
        references: [
          { rooms: [1], reference: "102-1111111", hotelConfirmation: "H-1" },
          { rooms: [2], reference: "102-2222222", hotelConfirmation: null },
        ],
        referenceQrDataUrl: "data:image/png;base64,AAAA",
      }),
    );
    const text = visibleText(html);
    expect(text).toContain("Room 1 102-1111111");
    expect(text).toContain("Hotel confirmation no. H-1");
    expect(text).toContain("Room 2 102-2222222");
    expect(html).not.toContain('<img class="ref-qr"');
  });

  it("says room only when no meals are included", () => {
    const text = visibleText(
      buildHotelBookingConfirmationHtml(
        input({
          stay: { ...input().stay, rooms: [{ ...input().stay.rooms[0], boardName: "Room only" }] },
        }),
      ),
    );
    expect(text).toContain("Room prepaid by Example Airways");
    expect(text).toContain("Meals are not included.");
  });

  it("never shows children's ages and copes with missing optional fields", () => {
    const html = buildHotelBookingConfirmationHtml(
      input({
        guest: { names: ["Alex Sample"], email: null, phone: null, pnr: "TEST002", adults: 1, children: 1 },
        hotel: { policies: null, name: "Hotel Minimal", rating: "Unrated", address: null, frontDeskPhone: null, reservationsPhone: null, distanceFromAirportKm: null, airportCode: null },
      }),
    );
    const text = visibleText(html);
    expect(text).not.toMatch(/\bage\b|aged|\(6\)/i);
    expect(text).toContain("1 Adult, 1 Child");
    expect(text).not.toMatch(/undefined|null|NaN/);
    expect(text).not.toContain("km from");
    expect(text).not.toContain("Need help?");
  });

  it("shows the airline help contact when one is given", () => {
    const text = visibleText(
      buildHotelBookingConfirmationHtml(
        input({ airlineSupport: { phone: "+00 0000", email: "help@example.test" } }),
      ),
    );
    expect(text).toContain("Need help? Contact Example Airways");
    expect(text).toContain("help@example.test");
  });
});
