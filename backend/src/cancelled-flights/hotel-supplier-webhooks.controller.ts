import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Logger } from "winston";
import { config } from "../config/config";
import { HotelProviderCode } from "../common/constants/hotel-provider.constants";
import { RequestId } from "../common/decorators/request-id.decorator";
import { RequestLogger } from "../common/decorators/request-logger.decorator";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";
import { HotelAllocationService } from "./hotel-allocation.service";
import {
  isValidRatehawkSignature,
  parseRatehawkBookingWebhook,
} from "./hotel-providers/ratehawk/ratehawk-webhook";

/** Public: called by suppliers, authenticated by their signature instead of a user login. */
@ApiExcludeController()
@Controller("webhooks")
export class HotelSupplierWebhooksController {
  private readonly context = "HotelSupplierWebhooksController";

  constructor(
    private readonly hotelAllocationService: HotelAllocationService,
    private readonly cancelledFlightsRepository: CancelledFlightsRepository,
  ) {}

  // 200 stops RateHawk's retries; any other status makes it retry later.
  @Post("ratehawk/booking-status")
  @HttpCode(HttpStatus.OK)
  async ratehawkBookingStatus(
    @Body() body: unknown,
    @RequestId() requestId: string,
    @RequestLogger() requestLogger: Logger,
  ): Promise<{ status: string }> {
    const webhook = parseRatehawkBookingWebhook(body);
    if (!webhook) {
      requestLogger.warn("Rejected malformed RateHawk booking webhook", {
        context: this.context,
      });
      throw new BadRequestException("Malformed RateHawk webhook");
    }
    const meta = {
      context: this.context,
      partnerOrderId: webhook.partnerOrderId,
      status: webhook.status,
    };

    if (
      !isValidRatehawkSignature(webhook, config.hotelProvider.ratehawk.apiKey)
    ) {
      requestLogger.warn(
        "Rejected RateHawk booking webhook with an invalid signature",
        meta,
      );
      throw new UnauthorizedException("Invalid webhook signature");
    }
    const ageMs = Math.abs(Date.now() - webhook.timestamp * 1000);
    if (ageMs > config.hotelBooking.webhookMaxAgeMs) {
      requestLogger.warn("Rejected expired RateHawk booking webhook", {
        ...meta,
        timestamp: webhook.timestamp,
      });
      throw new UnauthorizedException("Webhook timestamp is too old");
    }
    if (
      await this.cancelledFlightsRepository.isWebhookTokenUsed(
        HotelProviderCode.RATEHAWK,
        webhook.token,
      )
    ) {
      requestLogger.info("Ignored repeated RateHawk booking webhook", meta);
      return { status: "ok" };
    }

    requestLogger.info("Received RateHawk booking webhook", meta);
    let outcome;
    try {
      outcome = await this.hotelAllocationService.handleSupplierBookingStatus({
        provider: HotelProviderCode.RATEHAWK,
        reference: webhook.partnerOrderId,
        reportedStatus: webhook.status,
        requestId,
        requestLogger,
      });
    } catch (error: any) {
      requestLogger.error("Could not process RateHawk booking webhook", {
        ...meta,
        error: error?.message,
        stack: error?.stack,
      });
      throw new ServiceUnavailableException(
        "Webhook could not be processed; retry later",
      );
    }
    if (outcome === "retry") {
      throw new ServiceUnavailableException(
        "Booking status not final yet; retry later",
      );
    }
    await this.cancelledFlightsRepository.saveWebhookToken(
      HotelProviderCode.RATEHAWK,
      webhook.token,
    );
    return { status: "ok" };
  }
}
