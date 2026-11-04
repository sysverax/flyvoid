import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { createLogger, transports } from "winston";
import { config } from "../../src/config/config";
import { HotelAllocationService } from "../../src/cancelled-flights/hotel-allocation.service";
import {
  FlightStatus,
  HotelBookingAttemptStatus,
  HotelBookingFailureCode,
} from "../../src/cancelled-flights/entities/enums";

const logger = createLogger({
  transports: [new transports.Console({ silent: true })],
});

const HOUR = 60 * 60 * 1000;
const FLIGHT_ID = 7;

function attempt(
  overrides: {
    id?: number;
    sentAgoMs?: number;
    status?: HotelBookingAttemptStatus;
    rooms?: Array<{ status: string; partnerOrderId?: string | null }>;
  } = {},
): any {
  const sentAt = new Date(Date.now() - (overrides.sentAgoMs ?? 0));
  return {
    id: overrides.id ?? 1,
    bookingId: 21,
    cancelledFlightId: FLIGHT_ID,
    status: overrides.status ?? HotelBookingAttemptStatus.MANUAL_CHECK,
    failureCode: HotelBookingFailureCode.OUTCOME_UNKNOWN,
    providerRequestSentAt: sentAt,
    createdAt: sentAt,
    updatedAt: sentAt,
    hotel: { name: "Airport Inn", providerHotelId: "h1" },
    rooms: (overrides.rooms ?? [{ status: "pending" }]).map((room, index) => ({
      roomNo: index + 1,
      partnerOrderId:
        room.partnerOrderId === undefined ? `order-${index + 1}` : room.partnerOrderId,
      status: room.status,
      rateKey: "rk",
      roomName: "Double",
      boardName: "RO",
      adults: 2,
      children: 0,
      price: 100,
      buyingPrice: 90,
      createdAt: sentAt,
    })),
  };
}

function setup(attempts: any[] = []) {
  const repository = {
    findManualCheckAttempts: jest.fn(async (..._args: any[]) => attempts),
    finishBookingAttempt: jest.fn(async (..._args: any[]) => ({
      updated: true,
      allocation: null,
    })),
    markPnrFailed: jest.fn(async (..._args: any[]) => true),
    updateOpenAttemptOrders: jest.fn(async (..._args: any[]) => true),
    findFlightWithRelations: jest.fn(async (..._args: any[]) => ({
      id: FLIGHT_ID,
      status: FlightStatus.ALLOCATED,
      platformFeePercentage: 10,
    })),
    claimFlightAllocationRun: jest.fn(async (..._args: any[]) => ({
      claimed: true,
    })) as jest.Mock<(...args: any[]) => Promise<any>>,
    completeFlightAllocationRun: jest.fn(async (..._args: any[]) => undefined),
    touchFlightAllocationRun: jest.fn(async (..._args: any[]) => undefined),
    findAttemptBySupplierReference: jest.fn(
      async (..._args: any[]) => attempts[0] ?? null,
    ),
    findAllocationsByFlightId: jest.fn(async (..._args: any[]) => []),
    isAttemptStale: jest.fn(async (..._args: any[]) => false),
    recordWebhookOrderStatus: jest.fn(async (..._args: any[]) => true),
    findOrderRoomStatuses: jest.fn(
      async (..._args: any[]) => ["pending"],
    ) as jest.Mock<(...args: any[]) => Promise<string[]>>,
  };
  const provider = {
    checkBookingStatus: jest.fn(async (..._args: any[]) => ({
      state: "processing",
      code: null,
    })) as jest.Mock<(...args: any[]) => Promise<any>>,
  };
  const service = new HotelAllocationService(
    repository as any,
    provider as any,
    {} as any,
    {} as any,
  ) as any;
  service.confirmAttemptFromWebhook = jest.fn(async () => "processed");
  return { service, repository, provider };
}

const hotelBooking = config.hotelBooking as any;
let savedMode: string;
let savedDelay: number;

beforeEach(() => {
  savedMode = hotelBooking.statusMode;
  savedDelay = hotelBooking.webhookFinalCheckDelayMs;
  hotelBooking.statusMode = "webhook";
  hotelBooking.webhookFinalCheckDelayMs = 12 * HOUR;
});

afterEach(() => {
  hotelBooking.statusMode = savedMode;
  hotelBooking.webhookFinalCheckDelayMs = savedDelay;
  jest.useRealTimers();
});

describe("HOTEL_BOOKING_STATUS_MODE=webhook", () => {
  it("does not call the status endpoint before the 12-hour check is due", async () => {
    const { service, provider, repository } = setup([
      attempt({ sentAgoMs: 11 * HOUR }),
    ]);

    const open = await service.reconcileManualChecks(
      FLIGHT_ID,
      "req",
      logger,
      true,
      Date.now(),
    );

    expect(open).toBe(1);
    expect(provider.checkBookingStatus).not.toHaveBeenCalled();
    expect(repository.finishBookingAttempt).not.toHaveBeenCalled();
  });

  it("schedules the one status check 12 hours after the booking was sent", async () => {
    jest.useFakeTimers();
    const { service } = setup([attempt({ sentAgoMs: 2 * HOUR })]);
    const sentAt = Date.now() - 2 * HOUR;

    await service.scheduleWebhookStatusCheck(FLIGHT_ID, "req", logger);

    expect(service.nextSupplierCheckAt.get(FLIGHT_ID)).toBe(sentAt + 12 * HOUR);
    jest.clearAllTimers();
  });

  it("confirms the booking when the 12-hour check says booked", async () => {
    const { service, provider } = setup([attempt({ sentAgoMs: 13 * HOUR })]);
    provider.checkBookingStatus.mockResolvedValue({ state: "booked", code: null });

    await service.reconcileManualChecks(FLIGHT_ID, "req", logger, true, Date.now());

    expect(provider.checkBookingStatus).toHaveBeenCalledTimes(1);
    expect(service.confirmAttemptFromWebhook).toHaveBeenCalledTimes(1);
  });

  it("fails the booking when the 12-hour check says failed", async () => {
    const { service, provider, repository } = setup([
      attempt({ sentAgoMs: 13 * HOUR }),
    ]);
    provider.checkBookingStatus.mockResolvedValue({ state: "failed", code: "soldout" });

    await service.reconcileManualChecks(FLIGHT_ID, "req", logger, true, Date.now());

    const [, , changes] = repository.finishBookingAttempt.mock.calls[0] as any[];
    expect(changes.failureCode).toBe(HotelBookingFailureCode.SUPPLIER_REJECTED);
    expect(repository.markPnrFailed).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["still processing", (p: any) => p.mockResolvedValue({ state: "processing", code: null })],
    ["status API error", (p: any) => p.mockRejectedValue(new Error("502 Bad Gateway"))],
  ])(
    "marks the booking failed with a reason when the final check gets no final status (%s)",
    async (_label, arrange) => {
      const { service, provider, repository } = setup([
        attempt({ sentAgoMs: 13 * HOUR }),
      ]);
      arrange(provider.checkBookingStatus);

      const open = await service.reconcileManualChecks(
        FLIGHT_ID,
        "req",
        logger,
        true,
        Date.now(),
      );

      expect(open).toBe(0);
      expect(provider.checkBookingStatus).toHaveBeenCalledTimes(1);
      const [, , changes] = repository.finishBookingAttempt.mock.calls[0] as any[];
      expect(changes.status).toBe(HotelBookingAttemptStatus.FAILED);
      expect(changes.failureCode).toBe(HotelBookingFailureCode.NO_FINAL_STATUS);
      expect(changes.failureReason).toContain(
        "no booking webhook or final status came back within 12 hours",
      );
      expect(repository.markPnrFailed).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps a partial booking (some rooms booked) open instead of failing it", async () => {
    const { service, repository } = setup([
      attempt({
        sentAgoMs: 13 * HOUR,
        rooms: [{ status: "booked" }, { status: "pending" }],
      }),
    ]);

    const open = await service.reconcileManualChecks(
      FLIGHT_ID,
      "req",
      logger,
      true,
      Date.now(),
    );

    expect(open).toBe(1);
    expect(repository.markPnrFailed).not.toHaveBeenCalled();
  });

  it("confirms at the 12-hour check, without a status call, a booking whose webhook result was already saved", async () => {
    const { service, provider } = setup([
      attempt({ sentAgoMs: 13 * HOUR, rooms: [{ status: "booked" }] }),
    ]);

    await service.reconcileManualChecks(FLIGHT_ID, "req", logger, true, Date.now());

    expect(provider.checkBookingStatus).not.toHaveBeenCalled();
    expect(service.confirmAttemptFromWebhook).toHaveBeenCalledTimes(1);
  });

  it("skips the final status call when a webhook already settled the booking", async () => {
    // Settled attempts are SUCCESS / FAILED, so no MANUAL_CHECK attempt is left.
    const { service, provider, repository } = setup([]);

    await expect(
      service.runPostRunCheck(FLIGHT_ID, "req", logger, true, Date.now()),
    ).resolves.toBe(0);

    expect(provider.checkBookingStatus).not.toHaveBeenCalled();
    expect(repository.claimFlightAllocationRun).not.toHaveBeenCalled();
  });

  it("reports 'busy' when another run holds the flight, so the check is retried", async () => {
    const { service, repository } = setup([attempt({ sentAgoMs: 13 * HOUR })]);
    repository.claimFlightAllocationRun.mockResolvedValue({
      claimed: false,
      reason: "running",
      status: FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS,
    });

    await expect(
      service.runPostRunCheck(FLIGHT_ID, "req", logger, true, Date.now()),
    ).resolves.toBe("busy");
  });

  it("does not hold back retries of other PNRs while a booking awaits its webhook", async () => {
    const { service } = setup([attempt({ sentAgoMs: 1 * HOUR })]);

    await expect(service.getSupplierCheckState(FLIGHT_ID)).resolves.toEqual({
      awaiting: false,
      nextCheckAt: null,
    });
  });

  it("does not call the status endpoint in the end-of-run recovery pass", async () => {
    const { service, provider } = setup([attempt({ sentAgoMs: 0 })]);

    await service.runRecoveryPass(
      { flight: { id: FLIGHT_ID }, requestId: "req", requestLogger: logger, runId: "r" },
      [],
    );

    expect(provider.checkBookingStatus).not.toHaveBeenCalled();
  });

  it("logs an error when 'completed' arrives for a booking failed for no final status", async () => {
    const failed = attempt({ status: HotelBookingAttemptStatus.FAILED });
    const { service } = setup([failed]);
    const errorLogger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };

    const outcome = await service.handleSupplierBookingStatus({
      provider: "ratehawk",
      reference: "order-1",
      reportedStatus: "completed",
      requestId: "req",
      requestLogger: errorLogger,
    });

    expect(outcome).toBe("ignored");
    expect(errorLogger.error).toHaveBeenCalledWith(
      "Booking status webhook contradicts a settled attempt; check with the supplier",
      expect.objectContaining({ knownStatus: "pending" }),
    );
  });
});

describe("webhook mode: live wait for the booking webhook", () => {
  const webhook = (reportedStatus: string) => ({
    provider: "ratehawk",
    reference: "order-1",
    reportedStatus,
    requestId: "req",
    requestLogger: logger,
  });

  it.each([
    ["completed", "booked"],
    ["failed", "failed"],
  ])(
    "saves a '%s' webhook for the booking's live wait, with no status call",
    async (reported, saved) => {
      const pending = attempt({
        status: HotelBookingAttemptStatus.PENDING,
        sentAgoMs: 20_000,
      });
      const { service, provider, repository } = setup([pending]);

      await expect(
        service.handleSupplierBookingStatus(webhook(reported)),
      ).resolves.toBe("processed");

      expect(repository.recordWebhookOrderStatus).toHaveBeenCalledWith(
        1,
        21,
        "order-1",
        saved,
      );
      expect(provider.checkBookingStatus).not.toHaveBeenCalled();
    },
  );

  it("asks for a retry when the webhook comes at the end of the live wait", async () => {
    const pending = attempt({
      status: HotelBookingAttemptStatus.PENDING,
      sentAgoMs: 175_000,
    });
    const { service, repository } = setup([pending]);

    await expect(
      service.handleSupplierBookingStatus(webhook("completed")),
    ).resolves.toBe("retry");
    expect(repository.recordWebhookOrderStatus).not.toHaveBeenCalled();
  });

  it("settles a MANUAL_CHECK booking from the webhook as reported, with no status call", async () => {
    const { service, provider, repository } = setup([
      attempt({ sentAgoMs: 1 * HOUR }),
    ]);

    await service.handleSupplierBookingStatus(webhook("failed"));

    expect(provider.checkBookingStatus).not.toHaveBeenCalled();
    const [, , changes] = repository.finishBookingAttempt.mock.calls[0] as any[];
    expect(changes.status).toBe(HotelBookingAttemptStatus.FAILED);
    expect(repository.markPnrFailed).toHaveBeenCalledTimes(1);
  });

  it("confirms a MANUAL_CHECK booking from a 'completed' webhook", async () => {
    const { service, provider } = setup([attempt({ sentAgoMs: 1 * HOUR })]);

    await service.handleSupplierBookingStatus(webhook("completed"));

    expect(provider.checkBookingStatus).not.toHaveBeenCalled();
    expect(service.confirmAttemptFromWebhook).toHaveBeenCalledTimes(1);
  });

  it.each([
    [["booked"], "booked"],
    [["booked", "failed"], "failed"],
  ])("the live wait returns once the webhook result is saved (%j)", async (statuses, expected) => {
    const { service, repository } = setup();
    repository.findOrderRoomStatuses
      .mockResolvedValueOnce(["pending"])
      .mockResolvedValue(statuses as string[]);
    jest.useFakeTimers();

    const result = service.awaitBookingWebhook(1, "order-1");
    await jest.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toBe(expected);
  });

  it("the live wait gives up (null) when no webhook comes within 180 seconds", async () => {
    const { service } = setup();
    jest.useFakeTimers();

    const result = service.awaitBookingWebhook(1, "order-1");
    await jest.advanceTimersByTimeAsync(182_000);

    await expect(result).resolves.toBeNull();
  });
});

describe("HOTEL_BOOKING_STATUS_MODE=status", () => {
  it("keeps the old post-run checks: retry waits and the recovery pass checks the status", async () => {
    hotelBooking.statusMode = "status";
    const { service, provider } = setup([attempt({ sentAgoMs: 0 })]);

    const state = await service.getSupplierCheckState(FLIGHT_ID);
    expect(state.awaiting).toBe(true);

    await service.runRecoveryPass(
      { flight: { id: FLIGHT_ID }, requestId: "req", requestLogger: logger, runId: "r" },
      [],
    );
    expect(provider.checkBookingStatus).toHaveBeenCalledTimes(1);
  });
});
