import { describe, expect, it, jest } from "@jest/globals";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { createLogger, transports } from "winston";
import { CancelledFlightsService } from "../../src/cancelled-flights/cancelled-flights.service";
import { HotelAllocationService } from "../../src/cancelled-flights/hotel-allocation.service";
import { FlightStatus } from "../../src/cancelled-flights/entities/enums";
import { UserType } from "../../src/common/constants/user.constants";

jest.mock("../../src/common/pdf/pdf.service", () => ({ PdfService: class {} }));

const logger = createLogger({
  transports: [new transports.Console({ silent: true })],
});

// Flight 42 belongs to airline B (id 2).
const flightOfB = {
  id: 42,
  airlineId: 2,
  status: FlightStatus.IN_PROGRESS,
  flightNumber: "BB100",
};

const airlineA = { sub: 1, userType: UserType.AIRLINE, airlineId: 1 } as any;
const airlineB = { sub: 2, userType: UserType.AIRLINE, airlineId: 2 } as any;
const airlineWithoutId = { sub: 3, userType: UserType.AIRLINE } as any;
const platformAdmin = { sub: 9, userType: UserType.PLATFORM } as any;

function setup() {
  const repository = {
    findFlightById: jest.fn(async (..._args: any[]) => flightOfB as any) as jest.Mock<(...args: any[]) => Promise<any>>,
    findFlightWithRelations: jest.fn(async (..._args: any[]) => flightOfB),
    findBookingStatsByFlightId: jest.fn(async (..._args: any[]) => ({
      totalBookings: 0,
    })),
    findBookingsByFlightIdWithPagination: jest.fn(async (..._args: any[]) => ({
      bookings: [],
      totalBookings: 0,
    })),
    findHotelSummaryByFlightId: jest.fn(async (..._args: any[]) => ({
      totalRooms: 0,
    })),
    deleteBooking: jest.fn(async (..._args: any[]) => undefined),
    findImportFailures: jest.fn(async (..._args: any[]) => []),
  };
  const service = new CancelledFlightsService(
    repository as any,
    {} as any,
  ) as any;
  return { service, repository };
}

// Each call reaches a flight by id; all must refuse airline A on B's flight.
const flightCalls: Array<[string, (service: any, user: any) => Promise<unknown>]> = [
  ["listBookings", (s, u) => s.listBookings(42, u, {}, "req", logger)],
  ["addBooking", (s, u) => s.addBooking(42, u, {}, "req", logger)],
  ["importBookings", (s, u) => s.importBookings(42, u, Buffer.from(""), "req", logger)],
  ["listImportFailures", (s, u) => s.listImportFailures(42, u, "req", logger)],
  ["resolveImportFailure", (s, u) => s.resolveImportFailure(42, u, 1, {}, "req", logger)],
  ["deleteImportFailures", (s, u) => s.deleteImportFailures(42, u, undefined, "req", logger)],
  ["updateBooking", (s, u) => s.updateBooking(42, u, 5, {}, "req", logger)],
  ["deleteBooking", (s, u) => s.deleteBooking(42, u, 5, "req", logger)],
  ["reviewFlight", (s, u) => s.reviewFlight(42, u, "req", logger)],
  ["confirmPassengerBookingDetails", (s, u) => s.confirmPassengerBookingDetails(42, u, "req", logger)],
  ["hotelSummaryByFlight", (s, u) => s.hotelSummaryByFlight(42, u, "req", logger)],
  ["listHotelBookings", (s, u) => s.listHotelBookings(42, u, {}, "req", logger)],
  ["publishFlight", (s, u) => s.publishFlight(42, u, "req", logger)],
];

describe("cancelled flight access by airline", () => {
  it.each(flightCalls)(
    "%s: another airline's flight is a 404",
    async (_name, call) => {
      const { service } = setup();
      await expect(call(service, airlineA)).rejects.toThrow(
        new NotFoundException("Cancelled flight '42' not found"),
      );
    },
  );

  it.each(flightCalls)(
    "%s: an airline user without an airline id is a 404",
    async (_name, call) => {
      const { service } = setup();
      await expect(call(service, airlineWithoutId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    },
  );

  it("does not delete another airline's booking", async () => {
    const { service, repository } = setup();

    await expect(
      service.deleteBooking(42, airlineA, 5, "req", logger),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.deleteBooking).not.toHaveBeenCalled();
  });

  it.each([
    ["the owning airline", airlineB],
    ["a platform (admin portal) user", platformAdmin],
  ])("lets %s read the flight's bookings", async (_label, user) => {
    const { service, repository } = setup();

    await service.listBookings(42, user, {}, "req", logger);

    expect(repository.findBookingsByFlightIdWithPagination).toHaveBeenCalled();
  });

  it.each([
    ["the owning airline", airlineB],
    ["a platform (admin portal) user", platformAdmin],
  ])("lets %s read the flight's import failures", async (_label, user) => {
    const { service, repository } = setup();

    await service.listImportFailures(42, user, "req", logger);

    expect(repository.findImportFailures).toHaveBeenCalled();
  });

  describe("booking changes after hotel allocation has started", () => {
    const changes: Array<[string, (service: any) => Promise<unknown>]> = [
      ["addBooking", (s) => s.addBooking(42, airlineB, {}, "req", logger)],
      ["importBookings", (s) => s.importBookings(42, airlineB, Buffer.from(""), "req", logger)],
      ["resolveImportFailure", (s) => s.resolveImportFailure(42, airlineB, 1, {}, "req", logger)],
      ["updateBooking", (s) => s.updateBooking(42, airlineB, 5, {}, "req", logger)],
      ["deleteBooking", (s) => s.deleteBooking(42, airlineB, 5, "req", logger)],
    ];
    const lockedStatuses = [
      FlightStatus.PASSENGERS_BOOKING_CONFIRMED,
      FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS,
      FlightStatus.ALLOCATED,
      FlightStatus.PAID,
      FlightStatus.PUBLISHED,
    ];

    it.each(
      changes.flatMap(([name, call]) =>
        lockedStatuses.map((status) => [name, status, call] as const),
      ),
    )("%s on a %s flight is a 409", async (_name, status, call) => {
      const { service, repository } = setup();
      repository.findFlightById.mockResolvedValue({ ...flightOfB, status } as any);

      await expect(call(service)).rejects.toThrow(
        new ConflictException(
          "Bookings can't be changed after hotel allocation has started",
        ),
      );
      expect(repository.deleteBooking).not.toHaveBeenCalled();
    });

    it.each([FlightStatus.DRAFT, FlightStatus.IN_PROGRESS])(
      "deleteBooking on a %s flight is allowed",
      async (status) => {
        const { service, repository } = setup();
        repository.findFlightById.mockResolvedValue({ ...flightOfB, status } as any);
        (repository as any).findBookingById = jest.fn(async () => ({
          id: 5,
          cancelledFlightId: 42,
        }));

        await service.deleteBooking(42, airlineB, 5, "req", logger);

        expect(repository.deleteBooking).toHaveBeenCalled();
      },
    );
  });

  it("refuses another airline's hotel recommendations", async () => {
    const repository = {
      findFlightWithRelations: jest.fn(async (..._args: any[]) => ({
        ...flightOfB,
        status: FlightStatus.PASSENGERS_BOOKING_CONFIRMED,
      })),
    };
    const service = new HotelAllocationService(
      repository as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.getHotelRecommendationsForFlight(42, airlineA, "req", logger),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
