import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ConflictException } from "@nestjs/common";
import { createLogger, transports } from "winston";
import { HotelBookingsService } from "../../src/hotel-bookings/hotel-bookings.service";
import { supplierReferencesOf } from "../../src/hotel-bookings/supplier-references";
import { FlightStatus, HotelAllocationStatus } from "../../src/cancelled-flights/entities/enums";
import { UserType } from "../../src/common/constants/user.constants";

// The real renderer imports puppeteer (ESM); the tests pass their own stub.
jest.mock("../../src/common/pdf/pdf.service", () => ({ PdfService: class {} }));

const logger = createLogger({ transports: [new transports.Console({ silent: true })] });
const platformUser = { sub: 1, userType: UserType.PLATFORM } as any;

/** A confirmed hotel booking with fake data and the given stored rooms. */
const fakeBooking = (providerCode: string, rooms: any[], orderInfo: unknown[] | null = null) =>
  ({
    id: 445,
    status: HotelAllocationStatus.CONFIRMED,
    bookingReference: rooms.map((room) => room.partnerOrderId).filter(Boolean).join(","),
    checkInDate: "2026-11-26",
    checkOutDate: "2026-11-27",
    hotelName: "Hotel Example",
    category: "4 STARS",
    address: "1 Example Street",
    contact: null,
    hotelPolicies: null,
    distanceFromAirportKm: 12.3,
    totalRooms: rooms.length,
    rooms: rooms.map(() => ({
      roomName: "Double room",
      boardName: "Room only",
      adults: 2,
      children: 0,
      taxesAtProperty: [],
    })),
    booking: {
      firstName: "Alex",
      lastName: "Sample",
      email: "alex@example.test",
      phone: "",
      pnr: "TEST001",
      adults: 2,
      children: 0,
      createdAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: null,
    },
    cancelledFlight: {
      airlineId: 9,
      status: FlightStatus.ALLOCATED,
      flightNumber: "XX0001",
      cancellationDate: "2026-11-26",
      airline: { name: "Example Airways" },
      departureAirport: { iataCode: "CDG", city: "Paris" },
      arrivalAirport: { iataCode: "JFK", city: "New York" },
    },
    supplier: { providerCode, rooms, orderInfo },
  }) as any;

describe("HotelBookingsService confirmation voucher", () => {
  let repository: { findHotelBookingById: jest.Mock<any> };
  let pdfService: { renderHtmlToPdf: jest.Mock<any> };
  let service: HotelBookingsService;

  beforeEach(() => {
    repository = { findHotelBookingById: jest.fn() };
    pdfService = { renderHtmlToPdf: jest.fn(async () => Buffer.from("%PDF-fake")) };
    service = new HotelBookingsService(repository as any, pdfService as any);
  });

  it.each([
    ["hotelbeds", [{ roomNo: 1, status: "booked", partnerOrderId: "102-1234567", providerOrderId: null }], null],
    [
      "ratehawk",
      [{ roomNo: 1, status: "booked", partnerOrderId: "our-uuid-1", providerOrderId: "987654321" }],
      [{ partner_data: { order_id: "our-uuid-1" }, order_id: 987654321 }],
    ],
  ])("%s: the PDF shows exactly the stored supplier reference", async (provider, rooms, orderInfo) => {
    const booking = fakeBooking(provider, rooms, orderInfo as any);
    repository.findHotelBookingById.mockResolvedValue(booking);

    await service.generateBookingConfirmationPdf(445, platformUser, logger);

    const html = pdfService.renderHtmlToPdf.mock.calls[0][0] as string;
    const stored = supplierReferencesOf(booking.supplier).groups[0].reference;
    expect(stored).toBe(provider === "hotelbeds" ? "102-1234567" : "987654321");
    expect(html).toContain(`<div class="ref-value">${stored}</div>`);
    // Our own RateHawk partner_order_id is never presented as the booking reference.
    expect(html).not.toContain(`<div class="ref-value">our-uuid-1</div>`);
  });

  it("refuses the PDF and the email when the supplier reference is missing", async () => {
    repository.findHotelBookingById.mockResolvedValue(
      fakeBooking("ratehawk", [{ roomNo: 1, status: "booked", partnerOrderId: "our-uuid-2", providerOrderId: null }]),
    );

    const pdf = service.generateBookingConfirmationPdf(445, platformUser, logger);
    await expect(pdf).rejects.toBeInstanceOf(ConflictException);
    await expect(pdf).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SUPPLIER_REFERENCE_MISSING" }),
    });
    expect(pdfService.renderHtmlToPdf).not.toHaveBeenCalled();

    await expect(
      service.sendHotelBookingEmail(445, platformUser, "req", logger),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SUPPLIER_REFERENCE_MISSING" }),
    });
  });

  it("flags the booking in the detail response when its reference is missing", async () => {
    repository.findHotelBookingById.mockResolvedValue({
      ...fakeBooking("hotelbeds", [{ roomNo: 1, status: "booked", partnerOrderId: null, providerOrderId: null }]),
      createdAt: new Date(),
      updatedAt: null,
      paidAt: null,
      cancelledFlight: {
        ...fakeBooking("hotelbeds", []).cancelledFlight,
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const detail: any = await service.getHotelBookingDetail(445, platformUser, logger);
    const hotel = detail.hotelBooking ?? detail.hotel ?? detail;
    expect(JSON.stringify(detail)).toContain("SUPPLIER_REFERENCE_MISSING");
    expect(hotel).toBeDefined();
  });
});
