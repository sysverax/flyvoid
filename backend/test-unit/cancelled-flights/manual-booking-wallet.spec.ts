import { describe, expect, it, jest } from "@jest/globals";
import { ServiceUnavailableException } from "@nestjs/common";
import { createLogger, transports } from "winston";
import { HotelAllocationService } from "../../src/cancelled-flights/hotel-allocation.service";
import {
  HotelBookingAttemptStatus,
  HotelBookingFailureCode,
} from "../../src/cancelled-flights/entities/enums";
import { HotelBookingOutcomeUnknownError } from "../../src/cancelled-flights/hotel-providers/hotel-provider.interface";
import { InsufficientWalletBalanceError } from "../../src/finance/repositories/wallet-hold.repository";
import { config } from "../../src/config/config";

const logger = createLogger({
  transports: [new transports.Console({ silent: true })],
});

const flight = { id: 7, airlineId: 3, airline: {} } as any;
const booking = {
  id: 21,
  pnr: "ABC123",
  firstName: "Ana",
  lastName: "Lee",
  residency: "ae",
  adults: 2,
  children: 0,
} as any;

// One room at 200; with a 10% platform fee the PNR costs 220.
const rateCheck = {
  hotelCode: "h1",
  hotelName: "Airport Inn",
  category: "3 STARS",
  address: null,
  checkInDate: "2026-11-10",
  checkOutDate: "2026-11-11",
  roomName: "Double",
  boardName: "RO",
  adults: 2,
  children: 0,
  netPrice: 200,
  currency: "USD",
  cancellationPolicies: [],
  rateComments: null,
  priceChanged: false,
  taxesAtProperty: [],
};

function setup() {
  const repository = {
    startBookingAttempt: jest.fn(async (..._args: any[]) => ({
      started: true,
      attempt: { id: 55 },
    })),
    finishBookingAttempt: jest.fn(async (..._args: any[]) => ({
      updated: true,
      allocation: null,
    })),
    markAttemptRequestSent: jest.fn(
      async (..._args: any[]) => true,
    ) as jest.Mock<(...args: any[]) => Promise<boolean>>,
    recordProviderOrder: jest.fn(async (..._args: any[]) => true),
    reserveWalletForRun: jest.fn(async (..._args: any[]) => ({
      lockedAmount: 220,
      heldPnrs: 1,
      alreadyHeldPnrs: 0,
    })) as jest.Mock<(...args: any[]) => Promise<any>>,
    releaseWalletShare: jest.fn(async (..._args: any[]) => undefined),
  };
  const provider = {
    checkRate: jest.fn(async (..._args: any[]) => rateCheck),
    bookHotel: jest.fn(async (..._args: any[]) => {
      throw new ServiceUnavailableException("RateHawk Bookings API failed: soldout");
    }) as jest.Mock<(...args: any[]) => Promise<any>>,
  };
  const service = new HotelAllocationService(
    repository as any,
    provider as any,
    {} as any,
    {} as any,
  ) as any;
  const book = (reserveWallet: boolean) =>
    service.attemptHotelBooking({
      flight,
      booking,
      stay: { checkIn: "2026-11-10", checkOut: "2026-11-11" },
      rooms: [{ rateKey: "rk1", shape: { adults: 2, children: 0 } }],
      party: { adults: 2, children: 0 },
      platformFeePercentage: 10,
      requestId: "req",
      requestLogger: logger,
      reserveWallet,
    });
  return { service, repository, provider, book };
}

describe("manual hotel booking and the wallet", () => {
  it("reserves the PNR's cost (hotel + platform fee) before calling the supplier", async () => {
    const { repository, provider, book } = setup();

    await book(true);

    expect(repository.reserveWalletForRun).toHaveBeenCalledWith(
      {
        cancelledFlightId: 7,
        runId: "manual-55",
        items: [{ bookingId: 21, amount: 220 }],
      },
      logger,
    );
    const reserved = repository.reserveWalletForRun.mock.invocationCallOrder[0];
    const sent = repository.markAttemptRequestSent.mock.invocationCallOrder[0];
    const supplier = provider.bookHotel.mock.invocationCallOrder[0];
    expect(reserved).toBeLessThan(sent);
    expect(sent).toBeLessThan(supplier);
  });

  it("refuses the booking without calling the supplier when the wallet cannot cover it", async () => {
    const { repository, provider, book } = setup();
    repository.reserveWalletForRun.mockRejectedValue(
      new InsufficientWalletBalanceError(50, 220),
    );

    const outcome = await book(true);

    expect(outcome.kind).toBe("rejected");
    expect(outcome.reason).toBe(
      "Insufficient wallet balance: 50.00 available, 220.00 required to book the remaining PNRs",
    );
    expect(provider.bookHotel).not.toHaveBeenCalled();
    expect(repository.markAttemptRequestSent).not.toHaveBeenCalled();
    const [, , changes] = repository.finishBookingAttempt.mock.calls[0] as any[];
    expect(changes.status).toBe(HotelBookingAttemptStatus.FAILED);
    expect(changes.failureCode).toBe(
      HotelBookingFailureCode.INSUFFICIENT_WALLET_BALANCE,
    );
    // Nothing was reserved, so nothing is released.
    expect(repository.releaseWalletShare).not.toHaveBeenCalled();
  });

  it("does not call the supplier when the reservation itself fails", async () => {
    const { repository, provider, book } = setup();
    repository.reserveWalletForRun.mockRejectedValue(new Error("db down"));

    const outcome = await book(true);

    expect(outcome.kind).toBe("rejected");
    expect(provider.bookHotel).not.toHaveBeenCalled();
    const [, , changes] = repository.finishBookingAttempt.mock.calls[0] as any[];
    expect(changes.failureCode).toBe(HotelBookingFailureCode.WALLET_RESERVE_FAILED);
  });

  it("releases the reserved share as soon as the supplier rejects the booking", async () => {
    const { repository, book } = setup();

    const outcome = await book(true);

    expect(outcome.kind).toBe("rejected");
    expect(repository.releaseWalletShare).toHaveBeenCalledTimes(1);
    expect(repository.releaseWalletShare).toHaveBeenCalledWith(
      21,
      expect.stringContaining("Hotel booking failed"),
      logger,
    );
  });

  it("keeps the share when the outcome is unknown (MANUAL_CHECK)", async () => {
    const { repository, provider, book } = setup();
    provider.bookHotel.mockRejectedValue(
      new HotelBookingOutcomeUnknownError("no booking webhook within 180s", "order-1"),
    );

    const outcome = await book(true);

    expect(outcome.kind).toBe("unknown");
    expect(repository.releaseWalletShare).not.toHaveBeenCalled();
  });

  it("releases the share when the attempt was settled elsewhere before the supplier request", async () => {
    const { repository, provider, book } = setup();
    repository.markAttemptRequestSent.mockResolvedValue(false);

    const outcome = await book(true);

    expect(outcome.kind).toBe("blocked");
    expect(provider.bookHotel).not.toHaveBeenCalled();
    expect(repository.releaseWalletShare).toHaveBeenCalledTimes(1);
  });

  describe("manual bookings interrupted by a restart", () => {
    it("recovers stale manual attempts and schedules the status check for sent ones", async () => {
      const { service, repository } = setup();
      (repository as any).recoverInterruptedManualAttempts = jest.fn(async () => [
        { cancelledFlightId: 7, bookingId: 21, sent: true },
        { cancelledFlightId: 7, bookingId: 22, sent: true },
        { cancelledFlightId: 8, bookingId: 31, sent: false },
      ]);
      service.schedulePostRunCheck = jest.fn();

      await service.recoverInterruptedManualBookings();

      expect(
        (repository as any).recoverInterruptedManualAttempts,
      ).toHaveBeenCalledWith(config.hotelBooking.staleBookingAttemptMs, expect.anything());
      // Once per flight with a sent attempt; unsent ones are already FAILED.
      expect(service.schedulePostRunCheck).toHaveBeenCalledTimes(1);
      expect(service.schedulePostRunCheck).toHaveBeenCalledWith(
        7,
        expect.any(String),
        expect.anything(),
      );
    });

    it("keeps running when the recovery query fails", async () => {
      const { service, repository } = setup();
      (repository as any).recoverInterruptedManualAttempts = jest.fn(async () => {
        throw new Error("db down");
      });
      service.schedulePostRunCheck = jest.fn();

      await expect(service.recoverInterruptedManualBookings()).resolves.toBeUndefined();
      expect(service.schedulePostRunCheck).not.toHaveBeenCalled();
    });
  });

  it("allocation runs do not reserve per attempt (they reserve for all PNRs up front)", async () => {
    const { repository, book } = setup();

    await book(false);

    expect(repository.reserveWalletForRun).not.toHaveBeenCalled();
    expect(repository.releaseWalletShare).not.toHaveBeenCalled();
  });
});
