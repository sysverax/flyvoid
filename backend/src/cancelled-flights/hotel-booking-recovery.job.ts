import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { config } from "../config/config";
import { winstonInstance } from "../logger/logger.config";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";
import { HotelAllocationService } from "./hotel-allocation.service";

/**
 * Scheduled recovery of MANUAL_CHECK hotel bookings. Only picks flights and
 * hands each to HotelAllocationService.startRecoveryRun, which takes the same
 * flight lease as a user allocation run; all booking logic lives there.
 */
@Injectable()
export class HotelBookingRecoveryJob
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly context = "HotelBookingRecoveryJob";
  private static readonly START_DELAY_MS = 30 * 1000;
  private startTimer: NodeJS.Timeout | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly cancelledFlightsRepository: CancelledFlightsRepository,
    private readonly hotelAllocationService: HotelAllocationService,
  ) {}

  onApplicationBootstrap(): void {
    const { enabled, intervalMs } = config.hotelBooking.recovery;
    if (!enabled) return;
    // First tick soon after start, so work left by a stopped backend resumes.
    this.startTimer = setTimeout(() => {
      void this.tick();
      this.timer = setInterval(() => void this.tick(), intervalMs);
      this.timer.unref();
    }, HotelBookingRecoveryJob.START_DELAY_MS);
    this.startTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.startTimer) clearTimeout(this.startTimer);
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const requestId = randomUUID();
    const log = winstonInstance.child({ requestId });
    try {
      const { maxStatusChecks, backoffMs, maxAgeMs } =
        config.hotelBooking.recovery;
      const flightIds =
        await this.cancelledFlightsRepository.findFlightsDueForRecovery(
          config.hotelProvider.name,
          maxStatusChecks,
          backoffMs,
          maxAgeMs,
          config.hotelBooking.allocationRunLeaseMs,
        );
      if (flightIds.length === 0) return;
      log.info("MANUAL_CHECK recovery tick", {
        context: this.context,
        flights: flightIds.length,
      });
      for (const flightId of flightIds) {
        try {
          await this.hotelAllocationService.startRecoveryRun(
            flightId,
            requestId,
            log,
          );
        } catch (error: any) {
          log.error("MANUAL_CHECK recovery failed for flight", {
            context: this.context,
            flightId,
            error: error?.message,
            stack: error?.stack,
          });
        }
      }
    } catch (error: any) {
      log.error("MANUAL_CHECK recovery tick failed", {
        context: this.context,
        error: error?.message,
      });
    } finally {
      this.running = false;
    }
  }
}
