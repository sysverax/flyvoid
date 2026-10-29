import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { createLogger, transports } from "winston";
import { HotelAllocationService } from "../../src/cancelled-flights/hotel-allocation.service";
import { FlightStatus } from "../../src/cancelled-flights/entities/enums";

const logger = createLogger({ transports: [new transports.Console({ silent: true })] });

// Saved stay of 3 nights, starting the day after the cancellation.
const flight = {
  id: 7,
  status: FlightStatus.PASSENGERS_BOOKING_CONFIRMED,
  cancellationDate: "2026-11-10",
  checkInDate: "2026-11-11",
  checkOutDate: "2026-11-14",
  departureAirport: {
    iataCode: "DXB",
    latitude: "25.2531750",
    longitude: "55.3656730",
  },
};

const booking = {
  id: 21,
  pnr: "ABC123",
  adults: 2,
  children: 0,
  travelClass: "economy",
  residency: "ae",
};

function setup(overrides: Partial<typeof flight> = {}) {
  const savedFlight = { ...flight, ...overrides };
  const repository = {
    findFlightWithRelations: jest.fn(async (..._args: any[]) => savedFlight as any),
    findBookingsByFlightId: jest.fn(async (..._args: any[]) => [booking] as any[]),
    startBookingAttempt: jest.fn(async (..._args: any[]) => ({
      started: false,
      reason: "stopped by test",
    }) as any),
  };
  const provider = {
    searchNearbyHotelsWithOccupancies: jest.fn(async (..._args: any[]) => {
      throw new NotFoundException("no hotels");
    }),
  };
  const content = {
    enrichSearchResults: jest.fn(async (hotels: any) => hotels),
  };
  const service = new HotelAllocationService(
    repository as any,
    provider as any,
    {} as any,
    content as any,
  ) as any;
  return { service, repository, provider, savedFlight };
}

describe("HotelAllocationService stay dates", () => {
  describe("resolveStayDates", () => {
    it("uses the flight's saved check-in and check-out, not cancellation date + 1", () => {
      const { service, savedFlight } = setup();
      expect(service.resolveStayDates(savedFlight, logger)).toEqual({
        checkIn: "2026-11-11",
        checkOut: "2026-11-14",
      });
    });

    it("keeps a one-night stay as saved", () => {
      const { service, savedFlight } = setup({
        checkInDate: "2026-11-10",
        checkOutDate: "2026-11-11",
      });
      expect(service.resolveStayDates(savedFlight, logger)).toEqual({
        checkIn: "2026-11-10",
        checkOut: "2026-11-11",
      });
    });

    it.each([
      ["missing check-out", { checkOutDate: null as any }],
      ["missing check-in", { checkInDate: null as any }],
      ["check-out equal to check-in", { checkOutDate: "2026-11-11" }],
      ["check-out before check-in", { checkOutDate: "2026-11-09" }],
    ])("rejects %s", (_label, overrides) => {
      const { service, savedFlight } = setup(overrides);
      expect(() => service.resolveStayDates(savedFlight, logger)).toThrow(
        BadRequestException,
      );
    });
  });

  describe("getHotelRecommendationsForFlight", () => {
    it("searches the supplier for the saved multi-night stay", async () => {
      const { service, provider } = setup();

      await expect(
        service.getHotelRecommendationsForFlight(flight.id, "req-1", logger),
      ).rejects.toThrow(NotFoundException);

      expect(provider.searchNearbyHotelsWithOccupancies).toHaveBeenCalled();
      for (const call of provider.searchNearbyHotelsWithOccupancies.mock.calls) {
        expect(call[1]).toBe("2026-11-11");
        expect(call[2]).toBe("2026-11-14");
      }
    });

    it("fails before searching when the saved stay is invalid", async () => {
      const { service, provider } = setup({ checkOutDate: "2026-11-11" });

      await expect(
        service.getHotelRecommendationsForFlight(flight.id, "req-1", logger),
      ).rejects.toThrow(BadRequestException);
      expect(provider.searchNearbyHotelsWithOccupancies).not.toHaveBeenCalled();
    });
  });

  describe("attemptHotelBooking", () => {
    it("records the hotel booking with the saved stay dates", async () => {
      const { service, repository, savedFlight } = setup();

      const outcome = await service.attemptHotelBooking({
        flight: savedFlight,
        booking,
        stay: service.resolveStayDates(savedFlight, logger),
        rooms: [{ rateKey: "rate-1", shape: { adults: 2, children: 0 } }],
        platformFeePercentage: 0,
        requestId: "req-1",
        requestLogger: logger,
      });

      expect(outcome).toEqual({ kind: "blocked", reason: "stopped by test" });
      expect(repository.startBookingAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          checkInDate: "2026-11-11",
          checkOutDate: "2026-11-14",
        }),
        logger,
      );
    });
  });
});
