import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { ServiceUnavailableException } from "@nestjs/common";
import * as crypto from "node:crypto";
import { createLogger, transports } from "winston";
import { config } from "../../src/config/config";
import { HotelSupplierWebhooksController } from "../../src/cancelled-flights/hotel-supplier-webhooks.controller";
import { HotelAllocationService } from "../../src/cancelled-flights/hotel-allocation.service";
import { HotelBookingAttemptStatus } from "../../src/cancelled-flights/entities/enums";

const logger = createLogger({
  transports: [new transports.Console({ silent: true })],
});
const API_KEY = "test-api-key";

function webhookBody(token = "tok-1", status = "completed") {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", API_KEY)
    .update(`${timestamp}${token}`)
    .digest("hex");
  return {
    data: { partner_order_id: "order-1", status },
    signature: { signature, timestamp, token },
  };
}

function setup(tokenUsed = false) {
  const repository = {
    isWebhookTokenUsed: jest.fn(async (..._args: any[]) => tokenUsed),
    saveWebhookToken: jest.fn(
      async (..._args: any[]) => undefined,
    ) as jest.Mock<(...args: any[]) => Promise<any>>,
  };
  const service = {
    handleSupplierBookingStatus: jest.fn(
      async (..._args: any[]) => "processed",
    ) as jest.Mock<(...args: any[]) => Promise<any>>,
  };
  const controller = new HotelSupplierWebhooksController(
    service as any,
    repository as any,
  );
  const call = () =>
    controller.ratehawkBookingStatus(webhookBody(), "req", logger);
  return { repository, service, call };
}

const ratehawk = config.hotelProvider.ratehawk as any;
const hotelBooking = config.hotelBooking as any;
let savedKey: string;
let savedMode: string;

beforeEach(() => {
  savedKey = ratehawk.apiKey;
  savedMode = hotelBooking.statusMode;
  ratehawk.apiKey = API_KEY;
  hotelBooking.statusMode = "webhook";
});

afterEach(() => {
  ratehawk.apiKey = savedKey;
  hotelBooking.statusMode = savedMode;
});

describe("RateHawk booking webhook: 200 only after the booking is updated", () => {
  it("updates the booking, then saves the token, then answers 200", async () => {
    const { repository, service, call } = setup();

    await expect(call()).resolves.toEqual({ status: "ok" });

    const processed =
      service.handleSupplierBookingStatus.mock.invocationCallOrder[0];
    const tokenSaved = repository.saveWebhookToken.mock.invocationCallOrder[0];
    expect(processed).toBeLessThan(tokenSaved);
  });

  it("asks RateHawk to retry (503) when updating the booking fails, and keeps the token unused", async () => {
    const { repository, service, call } = setup();
    service.handleSupplierBookingStatus.mockRejectedValue(new Error("lock timeout"));

    await expect(call()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.saveWebhookToken).not.toHaveBeenCalled();
  });

  it("asks RateHawk to retry (503) while the booking status is not final", async () => {
    const { repository, service, call } = setup();
    service.handleSupplierBookingStatus.mockResolvedValue("retry");

    await expect(call()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.saveWebhookToken).not.toHaveBeenCalled();
  });

  it("does not answer 200 when the token cannot be saved", async () => {
    const { repository, call } = setup();
    repository.saveWebhookToken.mockRejectedValue(new Error("db down"));

    await expect(call()).rejects.toThrow("db down");
  });

  it("answers 200 to a webhook already processed, without processing it again", async () => {
    const { service, call } = setup(true);

    await expect(call()).resolves.toEqual({ status: "ok" });
    expect(service.handleSupplierBookingStatus).not.toHaveBeenCalled();
  });
});

describe("retried webhook for a booking settled part-way", () => {
  function serviceWith(attempt: any) {
    const repository = {
      findAttemptBySupplierReference: jest.fn(async (..._args: any[]) => attempt),
      refreshFlightTotals: jest.fn(async (..._args: any[]) => ({})),
      promoteFlightAfterLateConfirmation: jest.fn(async (..._args: any[]) => false),
      markPnrFailed: jest.fn(async (..._args: any[]) => false),
    };
    const service = new HotelAllocationService(
      repository as any,
      {} as any,
      {} as any,
      {} as any,
    ) as any;
    return { service, repository };
  }
  const room = (status: string) => ({
    roomNo: 1,
    partnerOrderId: "order-1",
    status,
    rateKey: "rk",
    roomName: "Double",
    boardName: "RO",
    adults: 2,
    children: 0,
    price: 100,
    buyingPrice: 90,
  });
  const webhook = (reportedStatus: string) => ({
    provider: "ratehawk",
    reference: "order-1",
    reportedStatus,
    requestId: "req",
    requestLogger: logger,
  });

  it("refreshes totals and promotes the flight again for a confirmed booking", async () => {
    const { service, repository } = serviceWith({
      id: 1,
      bookingId: 21,
      cancelledFlightId: 7,
      status: HotelBookingAttemptStatus.SUCCESS,
      rooms: [room("booked")],
    });

    await expect(
      service.handleSupplierBookingStatus(webhook("completed")),
    ).resolves.toBe("ignored");

    expect(repository.refreshFlightTotals).toHaveBeenCalledWith(7, logger);
    expect(repository.promoteFlightAfterLateConfirmation).toHaveBeenCalledWith(7);
  });

  it("leaves the PNR alone for an attempt already failed (it may be on its next attempt)", async () => {
    const { service, repository } = serviceWith({
      id: 1,
      bookingId: 21,
      cancelledFlightId: 7,
      status: HotelBookingAttemptStatus.FAILED,
      failureReason: "Booking at Inn failed: supplier reported soldout",
      rooms: [room("failed")],
    });

    await expect(
      service.handleSupplierBookingStatus(webhook("failed")),
    ).resolves.toBe("ignored");

    expect(repository.markPnrFailed).not.toHaveBeenCalled();
  });

  it("repeats no step when the webhook contradicts the booking", async () => {
    const { service, repository } = serviceWith({
      id: 1,
      bookingId: 21,
      cancelledFlightId: 7,
      status: HotelBookingAttemptStatus.FAILED,
      rooms: [room("failed")],
    });

    await service.handleSupplierBookingStatus(webhook("completed"));

    expect(repository.markPnrFailed).not.toHaveBeenCalled();
    expect(repository.refreshFlightTotals).not.toHaveBeenCalled();
  });

  it("lets an error in a repeated step reach RateHawk as a retry", async () => {
    const { service, repository } = serviceWith({
      id: 1,
      bookingId: 21,
      cancelledFlightId: 7,
      status: HotelBookingAttemptStatus.SUCCESS,
      rooms: [room("booked")],
    });
    repository.refreshFlightTotals.mockRejectedValue(new Error("lock timeout"));

    await expect(
      service.handleSupplierBookingStatus(webhook("completed")),
    ).rejects.toThrow("lock timeout");
  });
});
