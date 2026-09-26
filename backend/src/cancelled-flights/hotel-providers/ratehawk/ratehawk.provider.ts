import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { Logger } from "winston";
import { config } from "../../../config/config";
import { LoggerService } from "../../../common/logger/logger.service";
import { HotelAllocationStatus } from "../../entities/enums";
import {
  AvailabilityHotel,
  AvailabilityRoomRate,
  HotelBookingOutcomeUnknownError,
  HotelCandidate,
  HotelContentDetails,
  HotelProvider,
  HotelRateCheck,
  RoomOccupancy,
} from "../hotel-provider.interface";

/** Everything needed to re-find a search rate at booking time (search_hash is not issued on our contract). */
interface RatehawkRateKey {
  hid: number;
  matchHash: string;
  checkin: string;
  checkout: string;
  adults: number;
  childrenAges: number[];
}

/**
 * Same shape as HotelbedsProvider.bookHotel's input, plus the contact ETG
 * requires on every booking (the airline's) and the optional end-user IP.
 */
interface RatehawkBookingRequest {
  firstName: string;
  lastName: string;
  bookingId: number;
  pnr: string;
  contactEmail?: string;
  contactPhone?: string;
  userIp?: string;
}

/** Same shape as HotelbedsProvider.bookHotel's result, plus ETG's order number. */
interface RatehawkBookingResult {
  bookingReference: string;
  status: HotelAllocationStatus;
  hotelName: string;
  hotelAddress: string;
  checkInDate: string;
  checkOutDate: string;
  totalRooms: number;
  costPerRoom: number;
  price: number;
  buyingPrice: number;
  supplierOrderId: string;
}

/** Logger shape shared by a request's winston logger and the LoggerService adapter. */
interface RhLogger {
  debug(message: string, meta?: Record<string, unknown>): unknown;
  info(message: string, meta?: Record<string, unknown>): unknown;
  warn(message: string, meta?: Record<string, unknown>): unknown;
  error(message: string, meta?: Record<string, unknown>): unknown;
}

interface RatehawkEnvelope<T> {
  status: string;
  error: string | null;
  data: T;
}

export class RatehawkApiError extends Error {
  constructor(
    readonly endpoint: string,
    readonly httpStatus: number,
    readonly code: string | null,
    readonly body: string,
  ) {
    super(
      `RateHawk ${endpoint} failed (HTTP ${httpStatus}${code ? `, ${code}` : ""}): ${body.slice(0, 500)}`,
    );
  }
}

/** Client-side mirror of ETG's per-key limits so bursts queue instead of failing with endpoint_exceeded_limit. */
class SlidingWindowLimiter {
  private stamps: number[] = [];
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  update(max: number, windowMs: number): void {
    this.max = max;
    this.windowMs = windowMs;
  }

  acquire(): Promise<void> {
    const turn = this.chain.then(async () => {
      for (;;) {
        const now = Date.now();
        this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
        if (this.stamps.length < this.max) {
          this.stamps.push(now);
          return;
        }
        await new Promise((r) =>
          setTimeout(r, this.windowMs - (now - this.stamps[0]) + 50),
        );
      }
    });
    this.chain = turn.catch(() => undefined);
    return turn;
  }
}

const RATE_KEY_PREFIX = "rh1.";
const LANGUAGE = "en";

const MEAL_NAMES: Record<string, string> = {
  nomeal: "Room Only",
  breakfast: "Breakfast",
  "breakfast-buffet": "Breakfast Buffet",
  "continental-breakfast": "Continental Breakfast",
  "american-breakfast": "American Breakfast",
  "english-breakfast": "English Breakfast",
  "half-board": "Half Board",
  "full-board": "Full Board",
  "all-inclusive": "All Inclusive",
  dinner: "Dinner",
  lunch: "Lunch",
};

@Injectable()
export class RatehawkProvider implements HotelProvider, OnModuleInit {
  private readonly context = "RatehawkProvider";
  // RateHawk uses HOTEL_USER_ID (API key ID) + HOTEL_API_KEY (access token).
  private readonly keyId = config.hotelProvider.userId;
  private readonly apiKey = config.hotelProvider.apiKey;
  private readonly useSandbox = config.hotelProvider.useSandbox;
  private readonly baseUrl = config.hotelProvider.useSandbox
    ? "https://api-sandbox.ratehawk.com/api/b2b/v3/"
    : "https://api.ratehawk.com/api/b2b/v3/";

  private readonly maxConcurrency = 3;
  private readonly maxAttempts = 3; // 1 initial try + 2 retries
  private readonly retryBaseMs = 1000;
  private readonly requestTimeoutMs = 30000;
  // booking/finish can run long on the supplier side; aborting early loses the call.
  private readonly bookingFinishTimeoutMs = 120000;
  private readonly bookingStatusPollMs = 2500;
  private readonly geoHotelsLimit = 100;
  private readonly bookingStatusTimeoutMs = 180000;
  private static readonly RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
  private static readonly RETRYABLE_ERRORS = new Set([
    "timeout",
    "unknown",
    "endpoint_exceeded_limit",
  ]);

  // Defaults from the sandbox /overview/ response; refreshed from /overview/ on init.
  private readonly limiters = new Map<string, SlidingWindowLimiter>(
    (
      [
        ["search/serp/geo/", 10, 60],
        ["search/serp/hotels/", 150, 60],
        ["search/hp/", 10, 60],
        ["hotel/info/", 30, 60],
        ["hotel/prebook/", 30, 60],
        ["hotel/order/booking/form/", 30, 60],
        ["hotel/order/booking/finish/", 30, 60],
        ["hotel/order/booking/finish/status/", 30, 60],
        ["hotel/order/cancel/", 30, 60],
        ["hotel/order/info/", 30, 60],
      ] as const
    ).map(([endpoint, requests, seconds]) => [
      endpoint,
      new SlidingWindowLimiter(requests, seconds * 1000),
    ]),
  );

  private readonly contentCache = new Map<number, any>();

  // Dev-only mirror of hotelbeds-cache: raw per-occupancy search responses,
  // read when config.hotelSearch.isAllowSearchAPI is false.
  private readonly occupancyCacheDir = path.join(
    process.cwd(),
    "ratehawk-cache",
  );

  constructor(private readonly logger: LoggerService) {}

  async onModuleInit(): Promise<void> {
    if (!this.hasCredentials()) {
      this.logger.warn("RateHawk credentials not configured.", this.context);
      return;
    }
    void this.refreshRateLimits();
  }

  // ---------------------------------------------------------------- HTTP

  private hasCredentials(): boolean {
    return !!this.keyId && !!this.apiKey;
  }

  private assertCredentials(requestLogger?: RhLogger): void {
    if (!this.hasCredentials()) {
      requestLogger?.warn("RateHawk credentials not configured.", {
        context: this.context,
      });
      throw new ServiceUnavailableException(
        "RateHawk API credentials not configured",
      );
    }
  }

  /** LoggerService as an RhLogger, for calls made outside a request's winston logger. */
  private logFor(requestId?: string): RhLogger {
    return {
      debug: (message, meta) =>
        this.logger.debug(message, this.context, requestId, meta),
      info: (message, meta) =>
        this.logger.info(message, this.context, requestId, meta),
      warn: (message, meta) =>
        this.logger.warn(message, this.context, requestId, meta),
      error: (message, meta) =>
        this.logger.error(message, this.context, requestId, meta),
    };
  }

  /** Network failure, 5xx, or ETG's timeout/unknown codes: outcome unknown, safe to re-check. */
  private isTransient(error: unknown): boolean {
    return (
      error instanceof RatehawkApiError &&
      (error.httpStatus === 0 ||
        error.httpStatus >= 500 ||
        RatehawkProvider.RETRYABLE_ERRORS.has(error.code ?? ""))
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private backoffMs(attempt: number): number {
    return (
      this.retryBaseMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250)
    );
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.apiKey}`).toString("base64")}`;
  }

  /**
   * One ETG call returning the raw `{status, error, data}` envelope. Retries
   * network errors, 429/5xx and the transient `timeout`/`unknown`/
   * `endpoint_exceeded_limit` codes only when `retry` is set — booking calls
   * are not idempotent and handle those codes themselves.
   */
  private async request<T>(
    endpoint: string,
    body: unknown,
    requestLogger: RhLogger | undefined,
    {
      retry = true,
      method = "POST" as "POST" | "GET",
      timeoutMs = this.requestTimeoutMs,
    } = {},
  ): Promise<RatehawkEnvelope<T>> {
    const log = requestLogger ?? this.logFor();
    const url = `${this.baseUrl}${endpoint}`;
    const attempts = retry ? this.maxAttempts : 1;
    const limiter = this.limiters.get(endpoint);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await limiter?.acquire();
      log.debug(`Calling RateHawk ${endpoint}`, {
        context: this.context,
        method,
        attempt,
        payload: body,
      });

      let response: Awaited<ReturnType<typeof fetch>>;
      try {
        response = await fetch(url, {
          method,
          headers: {
            Authorization: this.authHeader(),
            Accept: "application/json",
            ...(method === "POST"
              ? { "Content-Type": "application/json" }
              : {}),
          },
          ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (networkError: any) {
        lastError = new RatehawkApiError(
          endpoint,
          0,
          "network",
          networkError?.message ?? String(networkError),
        );
        log.error(`RateHawk ${endpoint} call failed`, {
          context: this.context,
          attempt,
          error: lastError.message,
        });
        if (attempt < attempts) {
          await this.sleep(this.backoffMs(attempt));
          continue;
        }
        break;
      }

      const text = await response.text();
      let envelope: RatehawkEnvelope<T> | null = null;
      try {
        envelope = JSON.parse(text);
      } catch {
        envelope = null;
      }

      if (response.ok && envelope) {
        return envelope;
      }

      const code = envelope?.error ?? null;
      lastError = new RatehawkApiError(endpoint, response.status, code, text);
      const willRetry =
        attempt < attempts &&
        (RatehawkProvider.RETRYABLE_STATUS.has(response.status) ||
          (!!code && RatehawkProvider.RETRYABLE_ERRORS.has(code)));

      // Only place the full ETG status + body is logged.
      log.error(`RateHawk ${endpoint} returned an error response`, {
        context: this.context,
        status: response.status,
        error: code,
        attempt,
        body: text,
        willRetry,
      });

      if (!willRetry) break;
      await this.sleep(this.backoffMs(attempt));
    }

    throw lastError ?? new RatehawkApiError(endpoint, 0, null, "unknown error");
  }

  /** Like `request`, but anything other than `status: "ok"` is an error. */
  private async call<T>(
    endpoint: string,
    body: unknown,
    requestLogger: RhLogger | undefined,
    options?: { retry?: boolean; method?: "POST" | "GET"; timeoutMs?: number },
  ): Promise<T> {
    const envelope = await this.request<T>(
      endpoint,
      body,
      requestLogger,
      options,
    );
    if (envelope.status !== "ok") {
      if (
        options?.retry !== false &&
        envelope.error &&
        RatehawkProvider.RETRYABLE_ERRORS.has(envelope.error)
      ) {
        // transient code in a 200 body: one more go through the retrying path
        const again = await this.request<T>(
          endpoint,
          body,
          requestLogger,
          options,
        );
        if (again.status === "ok") return again.data;
        throw new RatehawkApiError(
          endpoint,
          200,
          again.error,
          JSON.stringify(again),
        );
      }
      throw new RatehawkApiError(
        endpoint,
        200,
        envelope.error,
        JSON.stringify(envelope),
      );
    }
    return envelope.data;
  }

  /** Pulls this key's real limits from /overview/ so the limiters match the contract. */
  private async refreshRateLimits(): Promise<void> {
    try {
      const endpoints = await this.call<
        Array<{
          endpoint: string;
          is_limited: boolean;
          requests_number: number;
          seconds_number: number;
        }>
      >("overview/", undefined, undefined, { method: "GET" });
      for (const entry of endpoints ?? []) {
        const key = `${entry.endpoint.replace(/^api\/b2b\/v3\//, "").replace(/\/?$/, "/")}`;
        const limiter = this.limiters.get(key);
        if (limiter && entry.requests_number > 0 && entry.seconds_number > 0) {
          limiter.update(entry.requests_number, entry.seconds_number * 1000);
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `Could not refresh RateHawk rate limits: ${error?.message}`,
        this.context,
      );
    }
  }

  // ------------------------------------------------------------ helpers

  private occupancyKey(occupancy: RoomOccupancy): string {
    const ages = (occupancy.childrenAges ?? []).join("-");
    return `${occupancy.adults}_${occupancy.children}_${ages}`;
  }

  /** ETG takes one age per child (0-17); pad missing ages like the Hotelbeds adapter does. */
  private childrenAgesFor(occupancy: RoomOccupancy): number[] {
    const count = Number(occupancy.children ?? 0);
    const ages = (occupancy.childrenAges ?? []).filter(
      (age) => Number.isFinite(age) && age >= 0 && age <= 17,
    );
    return Array.from({ length: count }, (_, i) => ages[i] ?? 6);
  }

  private guestsFor(occupancy: RoomOccupancy) {
    return [
      {
        adults: Number(occupancy.adults),
        children: this.childrenAgesFor(occupancy),
      },
    ];
  }

  private radiusInMeters(radius: number): number {
    const unit = String(config.hotelSearch.unit).toLowerCase();
    const meters =
      unit === "mi" ? radius * 1609.34 : unit === "m" ? radius : radius * 1000;
    return Math.min(70000, Math.max(1, Math.round(meters)));
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    let aborted = false;
    const runnerCount = Math.max(1, Math.min(limit, items.length));
    const runners = Array.from({ length: runnerCount }, async () => {
      while (!aborted && next < items.length) {
        const index = next++;
        try {
          results[index] = await worker(items[index], index);
        } catch (error) {
          aborted = true;
          throw error;
        }
      }
    });
    await Promise.all(runners);
    return results;
  }

  encodeRateKey(key: RatehawkRateKey): string {
    return (
      RATE_KEY_PREFIX + Buffer.from(JSON.stringify(key)).toString("base64url")
    );
  }

  decodeRateKey(rateKey: string): RatehawkRateKey {
    if (!rateKey?.startsWith(RATE_KEY_PREFIX)) {
      throw new BadRequestException("Not a RateHawk rateKey");
    }
    try {
      return JSON.parse(
        Buffer.from(
          rateKey.slice(RATE_KEY_PREFIX.length),
          "base64url",
        ).toString("utf-8"),
      );
    } catch {
      throw new BadRequestException("Malformed RateHawk rateKey");
    }
  }

  /** Airline-paid stays book against our B2B deposit; card/pay-at-hotel only as a fallback. */
  private pickPaymentType(paymentTypes: any[] | undefined): any | null {
    if (!Array.isArray(paymentTypes) || paymentTypes.length === 0) return null;
    return paymentTypes.find((p) => p?.type === "deposit") ?? paymentTypes[0];
  }

  /**
   * ETG prices each payment type twice (commission_info): `show` is what we
   * calculate and display with, `charge` is what ETG takes from our deposit.
   * Net = without ETG's commission. Falls back to `amount` when absent.
   */
  private netAmounts(payment: any): { shown: number; charged: number } {
    const fallback = Number(payment?.amount ?? 0);
    const pick = (value: unknown) =>
      value === undefined || value === null || value === "" ||
      !Number.isFinite(Number(value))
        ? fallback
        : Number(value);
    return {
      shown: pick(payment?.commission_info?.show?.amount_net),
      charged: pick(payment?.commission_info?.charge?.amount_net),
    };
  }

  private categoryFor(stars: number): string {
    return stars > 0 ? `${stars} STARS` : "Unrated";
  }

  /**
   * Search results carry no hotel name, only the slug `id`
   * ("maison_privee_frond_villa_d"), so use a title-cased version of it.
   * checkRate/bookHotel return the exact name from hotel/info.
   */
  private nameFromSlug(id: unknown, hid: number): string {
    const words = String(id ?? "")
      .split("_")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
    return words.length ? words.join(" ") : `Hotel ${hid}`;
  }

  private mealName(meal: string | undefined): string {
    if (!meal) return "Room Only";
    return (
      MEAL_NAMES[meal] ??
      meal
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    );
  }

  /** Taxes ETG says are payable at the hotel must be shown to the guest. */
  private taxComments(payment: any): string | null {
    const taxes = Array.isArray(payment?.tax_data?.taxes)
      ? payment.tax_data.taxes
      : [];
    const atHotel = taxes
      .filter((tax: any) => tax && tax.included_by_supplier === false)
      .map((tax: any) =>
        `${tax.name ?? "tax"}: ${tax.amount} ${tax.currency_code ?? ""}`.trim(),
      );
    return atHotel.length ? `Payable at hotel - ${atHotel.join("; ")}` : null;
  }

  private async fetchHotelContent(
    hid: number,
    requestLogger?: RhLogger,
  ): Promise<any | null> {
    const cached = this.contentCache.get(hid);
    if (cached) return cached;
    const data = await this.call<any>(
      "hotel/info/",
      { hid, language: LANGUAGE },
      requestLogger,
    );
    if (data) this.contentCache.set(hid, data);
    return data ?? null;
  }

  /** Raw ETG hotels whose rates are tagged with the occupancy they were searched for. */
  private tagRates(hotels: any[], occupancy: RoomOccupancy): any[] {
    return (hotels ?? []).map((hotel) => ({
      ...hotel,
      rates: (hotel.rates ?? []).map((rate: any) => ({
        ...rate,
        __occupancy: occupancy,
      })),
    }));
  }

  private normalizeAvailabilityHotels(
    rawHotels: any[],
    checkin: string,
    checkout: string,
    starsByHid: Map<number, number>,
  ): AvailabilityHotel[] {
    return rawHotels
      .map((hotel: any) => {
        const hid = Number(hotel.hid);
        const stars = starsByHid.get(hid) ?? 0;
        const hotelCode = String(hid);
        const hotelName = this.nameFromSlug(hotel.id, hid);
        const category = this.categoryFor(stars);

        const rates: AvailabilityRoomRate[] = (hotel.rates ?? [])
          .filter((rate: any) => !!rate?.match_hash)
          .map((rate: any) => {
            const occupancy: RoomOccupancy = rate.__occupancy;
            const childrenAges = this.childrenAgesFor(occupancy);
            const payment = this.pickPaymentType(
              rate.payment_options?.payment_types,
            );
            if (!payment) return null;
            const policies = payment.cancellation_penalties?.policies ?? [];
            return {
              hotelCode,
              hotelName,
              category,
              roomCode: rate.room_data_trans?.main_room_type
                ? String(rate.room_data_trans.main_room_type)
                : null,
              roomName: String(rate.room_name ?? "Unknown Room"),
              boardCode: rate.meal ? String(rate.meal) : null,
              boardName: this.mealName(rate.meal),
              rateKey: this.encodeRateKey({
                hid,
                matchHash: String(rate.match_hash),
                checkin,
                checkout,
                adults: Number(occupancy.adults),
                childrenAges,
              }),
              // ETG rates always need a hotelpage + prebook before booking.
              rateType: "RECHECK",
              // Calculations use the show net; the charge net is our cost (buyingPrice).
              netPrice: this.netAmounts(payment).shown,
              buyingPrice: this.netAmounts(payment).charged,
              currency: String(
                payment.show_currency_code ?? payment.currency_code ?? "USD",
              ),
              allotment:
                rate.allotment !== undefined && rate.allotment !== null
                  ? Number(rate.allotment)
                  : null,
              adults: Number(occupancy.adults),
              children: childrenAges.length,
              childrenAges,
              cancellationPolicies: policies
                .filter(
                  (policy: any) =>
                    Number(policy.amount_show ?? policy.amount_charge ?? 0) > 0,
                )
                .map((policy: any) => ({
                  amount: Number(
                    policy.amount_show ?? policy.amount_charge ?? 0,
                  ),
                  from: String(policy.start_at ?? new Date().toISOString()),
                })),
              rateComments: this.taxComments(payment),
              paymentType: payment.type ? String(payment.type) : null,
            } satisfies AvailabilityRoomRate;
          })
          .filter(
            (rate: AvailabilityRoomRate | null): rate is AvailabilityRoomRate =>
              !!rate,
          );

        return {
          hotelCode,
          hotelName,
          category,
          // Address is only needed for selected hotels (getHotelContentDetails).
          address: "Near Airport",
          stars,
          rates,
        };
      })
      .filter((hotel) => hotel.rates.length > 0);
  }

  // ------------------------------------------------------------- search

  private async searchGeo(
    airport: { latitude: number; longitude: number },
    radius: number,
    checkin: string,
    checkout: string,
    occupancy: RoomOccupancy,
    requestLogger: Logger,
  ): Promise<any[]> {
    const data = await this.call<{ hotels?: any[] }>(
      "search/serp/geo/",
      {
        checkin,
        checkout,
        language: LANGUAGE,
        guests: this.guestsFor(occupancy),
        latitude: Number(airport.latitude),
        longitude: Number(airport.longitude),
        radius: this.radiusInMeters(radius),
        hotels_limit: this.geoHotelsLimit,
      },
      requestLogger,
    );
    return data?.hotels ?? [];
  }

  private async searchByHids(
    hids: number[],
    checkin: string,
    checkout: string,
    occupancy: RoomOccupancy,
    requestLogger: Logger,
    filter?: { star_rating: number[] },
  ): Promise<any[]> {
    const chunks: number[][] = [];
    for (let i = 0; i < hids.length; i += 100)
      chunks.push(hids.slice(i, i + 100));
    const results = await this.mapWithConcurrency(
      chunks,
      this.maxConcurrency,
      (chunk) =>
        this.call<{ hotels?: any[] }>(
          "search/serp/hotels/",
          {
            checkin,
            checkout,
            language: LANGUAGE,
            guests: this.guestsFor(occupancy),
            hids: chunk,
            ...(filter ? { filter } : {}),
          },
          requestLogger,
        ),
    );
    return results.flatMap((data) => data?.hotels ?? []);
  }

  /**
   * Search results have no star rating, but serp/hotels filters by it: one
   * call per star value (150/min limit) tells us which hids have it. Hotels
   * matching none of 1-5 are unrated (0).
   */
  private async resolveStars(
    hids: number[],
    checkin: string,
    checkout: string,
    occupancy: RoomOccupancy,
    starsByHid: Map<number, number>,
    requestLogger: Logger,
  ): Promise<void> {
    const unknown = hids.filter((hid) => !starsByHid.has(hid));
    if (!unknown.length) return;
    const starValues = [1, 2, 3, 4, 5];
    const matches = await this.mapWithConcurrency(
      starValues,
      this.maxConcurrency,
      (star) =>
        this.searchByHids(
          unknown,
          checkin,
          checkout,
          occupancy,
          requestLogger,
          {
            star_rating: [star],
          },
        ),
    );
    for (const hid of unknown) starsByHid.set(hid, 0);
    matches.forEach((hotels, i) => {
      for (const hotel of hotels)
        starsByHid.set(Number(hotel.hid), starValues[i]);
    });
  }

  async searchNearbyHotelsWithOccupancies(
    airport: { iataCode: string; latitude: number; longitude: number },
    checkInDate: string,
    checkOutDate: string,
    occupancies: RoomOccupancy[],
    requestId: string,
    requestLogger: Logger,
  ): Promise<AvailabilityHotel[]> {
    if (!config.hotelSearch.isAllowSearchAPI) {
      return await this.searchNearbyHotelsWithOccupanciesFromJson(
        airport,
        checkInDate,
        checkOutDate,
        occupancies,
        requestId,
        requestLogger,
      );
    }
    this.assertCredentials(requestLogger);

    if (!occupancies.length) {
      throw new BadRequestException(
        "At least one occupancy is required for hotel availability search",
      );
    }

    const dedupedOccupancies = Array.from(
      new Map(occupancies.map((o) => [this.occupancyKey(o), o])).values(),
    );

    const mergedByHid = new Map<number, any>();
    const starsByHid = new Map<number, number>();
    const merge = (occupancy: RoomOccupancy, hotels: any[]) => {
      for (const hotel of this.tagRates(hotels, occupancy)) {
        const hid = Number(hotel?.hid);
        if (!hid) continue;
        const existing = mergedByHid.get(hid);
        if (!existing) mergedByHid.set(hid, hotel);
        else
          existing.rates = [...(existing.rates ?? []), ...(hotel.rates ?? [])];
      }
    };

    requestLogger.info("Fetching hotel availability from RateHawk API", {
      context: this.context,
      airportCode: airport.iataCode,
      occupancyCount: dedupedOccupancies.length,
      useSandbox: this.useSandbox,
    });

    try {
      const { defaultRadius } = config.hotelSearch;
      const maxRadius = Math.max(defaultRadius, config.hotelSearch.maxRadius);

      // serp/geo is limited to 10/min, so each round makes ONE geo call (for
      // the first still-missing shape) to discover hotels, then prices the
      // other missing shapes over those hids via serp/hotels (150/min).
      let stillMissing = dedupedOccupancies;
      for (
        let radius = defaultRadius;
        radius <= maxRadius && stillMissing.length > 0;
        radius += 10
      ) {
        const [probe, ...others] = stillMissing;
        const geoHotels = await this.searchGeo(
          airport,
          radius,
          checkInDate,
          checkOutDate,
          probe,
          requestLogger,
        );
        const hids = geoHotels
          .map((hotel) => Number(hotel.hid))
          .filter(Boolean);
        const nextMissing: RoomOccupancy[] = [];

        if (geoHotels.length) merge(probe, geoHotels);
        else nextMissing.push(probe);

        if (hids.length) {
          await this.resolveStars(
            hids,
            checkInDate,
            checkOutDate,
            probe,
            starsByHid,
            requestLogger,
          );
        }

        if (hids.length && others.length) {
          const priced = await this.mapWithConcurrency(
            others,
            this.maxConcurrency,
            (occupancy) =>
              this.searchByHids(
                hids,
                checkInDate,
                checkOutDate,
                occupancy,
                requestLogger,
              ),
          );
          priced.forEach((hotels, i) => {
            if (hotels.length) merge(others[i], hotels);
            else nextMissing.push(others[i]);
          });
        } else {
          nextMissing.push(...others);
        }

        stillMissing = nextMissing;
        if (stillMissing.length > 0) {
          requestLogger.info(
            `${stillMissing.length} occupancy shape(s) still had no hotels within ${radius}${config.hotelSearch.unit} of ${airport.iataCode}, widening search for just those`,
            { context: this.context, stillMissingCount: stillMissing.length },
          );
        }
      }

      const mergedRawHotels = Array.from(mergedByHid.values());
      requestLogger.info(
        `Successfully received ${mergedRawHotels.length} merged hotels from RateHawk API`,
        { context: this.context },
      );
      if (mergedRawHotels.length === 0) {
        throw new NotFoundException(
          `No hotels found near airport ${airport.iataCode} for the requested occupancies`,
        );
      }

      return this.normalizeAvailabilityHotels(
        mergedRawHotels,
        checkInDate,
        checkOutDate,
        starsByHid,
      );
    } catch (error: any) {
      requestLogger.error(`Error querying RateHawk API: ${error.message}`, {
        context: this.context,
        stack: error.stack,
      });
      if (
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(error.message);
    }
  }

  /** Reads `ratehawk-cache/<runId>/<occupancyKey>.json` (newest run first). */
  private async loadCachedOccupancyResponse(
    occupancy: RoomOccupancy,
    requestLogger: Logger,
  ): Promise<any[]> {
    const fileName = `${this.occupancyKey(occupancy)}.json`;
    let runDirNames: string[];
    try {
      runDirNames = await fs.readdir(this.occupancyCacheDir);
    } catch {
      requestLogger.warn("RateHawk cache directory not found", {
        context: this.context,
        cacheDir: this.occupancyCacheDir,
      });
      return [];
    }
    const runDirs = (
      await Promise.all(
        runDirNames.map(async (name) => {
          const dirPath = path.join(this.occupancyCacheDir, name);
          try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory()
              ? { dirPath, mtimeMs: stats.mtimeMs }
              : null;
          } catch {
            return null;
          }
        }),
      )
    )
      .filter((entry): entry is { dirPath: string; mtimeMs: number } => !!entry)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const { dirPath } of runDirs) {
      try {
        const raw = JSON.parse(
          await fs.readFile(path.join(dirPath, fileName), "utf-8"),
        );
        return raw?.hotels ?? [];
      } catch {
        continue;
      }
    }
    requestLogger.warn("No cached RateHawk response found for occupancy", {
      context: this.context,
      occupancyFile: fileName,
    });
    return [];
  }

  async searchNearbyHotelsWithOccupanciesFromJson(
    airport: { iataCode: string; latitude: number; longitude: number },
    checkInDate: string,
    checkOutDate: string,
    occupancies: RoomOccupancy[],
    requestId: string,
    requestLogger: Logger,
  ): Promise<AvailabilityHotel[]> {
    if (!occupancies.length) {
      throw new BadRequestException(
        "At least one occupancy is required for hotel availability search",
      );
    }
    const dedupedOccupancies = Array.from(
      new Map(occupancies.map((o) => [this.occupancyKey(o), o])).values(),
    );
    requestLogger.info(
      "Loading hotel availability from cached RateHawk responses",
      {
        context: this.context,
        airportCode: airport.iataCode,
        occupancyCount: dedupedOccupancies.length,
        cacheDir: this.occupancyCacheDir,
      },
    );

    const mergedByHid = new Map<number, any>();
    for (const occupancy of dedupedOccupancies) {
      const hotels = await this.loadCachedOccupancyResponse(
        occupancy,
        requestLogger,
      );
      for (const hotel of this.tagRates(hotels, occupancy)) {
        const hid = Number(hotel?.hid);
        if (!hid) continue;
        const existing = mergedByHid.get(hid);
        if (!existing) mergedByHid.set(hid, hotel);
        else
          existing.rates = [...(existing.rates ?? []), ...(hotel.rates ?? [])];
      }
    }

    const mergedRawHotels = Array.from(mergedByHid.values());
    if (mergedRawHotels.length === 0) {
      throw new NotFoundException(
        `No cached hotel data found near airport ${airport.iataCode} for the requested occupancies`,
      );
    }
    // Saved responses carry no star rating; they read as unrated.
    return this.normalizeAvailabilityHotels(
      mergedRawHotels,
      checkInDate,
      checkOutDate,
      new Map(),
    );
  }

  async searchNearbyHotels(
    airport: { iataCode: string; latitude: number; longitude: number },
    checkInDate: string,
    checkOutDate: string,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelCandidate[]> {
    const hotels = await this.searchNearbyHotelsWithOccupancies(
      airport,
      checkInDate,
      checkOutDate,
      [{ adults: 1, children: 0 }],
      requestId,
      requestLogger,
    );

    return hotels.slice(0, 10).map((hotel) => {
      const minPrice = hotel.rates.reduce(
        (acc, rate) => (rate.netPrice < acc ? rate.netPrice : acc),
        Number.POSITIVE_INFINITY,
      );
      const amenities = ["WiFi"];
      if (hotel.stars >= 4) {
        amenities.push("Business Center", "Elevator", "Wheelchair Accessible");
      }
      if (hotel.stars >= 5) {
        amenities.push("Spa", "Swimming Pool", "24-hour Room Service");
      } else {
        amenities.push("Free Shuttle");
      }

      return {
        id: `rh-${hotel.hotelCode}`,
        name: hotel.hotelName,
        address: hotel.address,
        stars: hotel.stars,
        amenities,
        pricePerNight: Number.isFinite(minPrice) ? minPrice : 120,
        description: `Enjoy a comfortable stay at ${hotel.hotelName}, a quality ${hotel.stars}-star hotel near the airport area.`,
        rateKey: hotel.rates[0]?.rateKey ?? null,
      };
    });
  }

  // ------------------------------------------------------------ content

  // Best-effort hotel profile lookup via /hotel/info/; never blocks allocation on failure.
  async getHotelContentDetails(
    hotelCode: string,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelContentDetails | null> {
    if (!config.hotelSearch.isAllowFetchHotelDetails) {
      return {
        address: "",
        contact: { phones: [], email: "" },
        latitude: null,
        longitude: null,
        distanceFromAirportKm: null,
        imageUrl: "",
        website: "",
        amenities: [],
      };
    }
    if (!this.hasCredentials()) {
      return null;
    }

    const hid = Number(hotelCode);
    if (!Number.isFinite(hid) || hid <= 0) {
      return null;
    }

    try {
      const hotel = await this.fetchHotelContent(hid, requestLogger);
      if (!hotel) return null;

      const address = [hotel.address, hotel.region?.name]
        .filter(Boolean)
        .join(", ");
      const imageTemplate: string | undefined =
        hotel.images_ext?.[0]?.url ?? hotel.images?.[0];
      const amenities: string[] = Array.isArray(hotel.amenity_groups)
        ? Array.from(
            new Set<string>(
              hotel.amenity_groups.flatMap((group: any) =>
                Array.isArray(group?.amenities)
                  ? group.amenities.map(String)
                  : [],
              ),
            ),
          ).slice(0, 15)
        : [];

      return {
        address: address || null,
        contact: {
          phones: hotel.phone
            ? [{ phoneNumber: String(hotel.phone), phoneType: "PHONEHOTEL" }]
            : [],
          email: hotel.email ? String(hotel.email) : null,
        },
        latitude: hotel.latitude ?? null,
        longitude: hotel.longitude ?? null,
        // ETG gives no airport distance; the caller has the airport, we don't.
        distanceFromAirportKm: null,
        imageUrl: imageTemplate
          ? imageTemplate.replace("{size}", "1024x768")
          : null,
        website: null,
        amenities,
      };
    } catch (error: any) {
      requestLogger.error(
        `Error querying RateHawk hotel/info for hotel '${hotelCode}': ${error.message}`,
        { context: this.context, stack: error.stack },
      );
      return null;
    }
  }

  // ------------------------------------------------------ prebook / book

  /** Re-prices a search rate: hotelpage (by match_hash) -> prebook. */
  private async prebookRate(rateKey: string, log: RhLogger) {
    const key = this.decodeRateKey(rateKey);

    const hotelpage = await this.call<{ hotels?: any[] }>(
      "search/hp/",
      {
        checkin: key.checkin,
        checkout: key.checkout,
        language: LANGUAGE,
        guests: [{ adults: key.adults, children: key.childrenAges }],
        hid: key.hid,
        match_hash: key.matchHash,
      },
      log,
    );
    const hpRate = hotelpage?.hotels?.[0]?.rates?.find(
      (rate: any) => rate.match_hash === key.matchHash,
    );
    if (!hpRate?.book_hash) {
      throw new ConflictException(
        "The selected RateHawk rate is no longer available",
      );
    }

    const prebook = await this.call<{
      hotels?: any[];
      changes?: { price_changed?: boolean };
    }>("hotel/prebook/", { hash: hpRate.book_hash }, log);
    const rate = prebook?.hotels?.[0]?.rates?.[0];
    if (!rate?.book_hash) {
      throw new ConflictException("RateHawk prebook returned no bookable rate");
    }

    return {
      key,
      rate,
      bookHash: String(rate.book_hash),
      priceChanged: !!prebook.changes?.price_changed,
      payment: this.pickPaymentType(rate.payment_options?.payment_types),
    };
  }

  // HotelProvider.checkRate — hotelpage + prebook, then the hotel's real name/address.
  async checkRate(rateKey: string, requestId: string): Promise<HotelRateCheck> {
    const log = this.logFor(requestId);
    this.assertCredentials(log);

    try {
      this.logger.info(
        "Validating rate with RateHawk hotelpage + prebook",
        this.context,
        requestId,
      );
      const { key, rate, priceChanged, payment } = await this.prebookRate(
        rateKey,
        log,
      );
      const content = await this.fetchHotelContent(key.hid, log).catch(
        () => null,
      );

      this.logger.info(
        "Successfully validated rate with RateHawk",
        this.context,
        requestId,
      );

      return {
        hotelCode: String(key.hid),
        hotelName: String(content?.name ?? ""),
        category: this.categoryFor(Number(content?.star_rating ?? 0)),
        address: content?.address ? String(content.address) : null,
        checkInDate: key.checkin,
        checkOutDate: key.checkout,
        roomName: String(rate.room_name ?? ""),
        boardName: this.mealName(rate.meal),
        adults: key.adults,
        children: key.childrenAges.length,
        netPrice: this.netAmounts(payment).shown,
        buyingPrice: this.netAmounts(payment).charged,
        currency: String(
          payment?.show_currency_code ?? payment?.currency_code ?? "USD",
        ),
        cancellationPolicies: (payment?.cancellation_penalties?.policies ?? [])
          .filter((p: any) => Number(p.amount_show ?? p.amount_charge ?? 0) > 0)
          .map((p: any) => ({
            amount: Number(p.amount_show ?? p.amount_charge),
            from: String(p.start_at ?? new Date().toISOString()),
          })),
        rateComments: this.taxComments(payment),
        priceChanged,
      };
    } catch (error: any) {
      this.logger.error(
        `Error calling RateHawk CheckRate: ${error.message}`,
        this.context,
        requestId,
        { stack: error.stack },
      );
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `RateHawk CheckRate failed: ${error.message}`,
      );
    }
  }

  /** ETG allows only letters, spaces and -,.' in guest names (max 50). */
  private sanitizeName(value: string | undefined, fallback: string): string {
    const cleaned = String(value ?? "")
      .replace(/[^\p{L}\s\-,.'’]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);
    return cleaned || fallback;
  }

  /**
   * prebook -> booking/form -> booking/finish -> poll booking/finish/status.
   * `bookingReference` is our partner_order_id (what cancel takes); ETG's own
   * order number is returned as `supplierOrderId`. Paid from the B2B deposit,
   * so `paymentData` is not used.
   */
  async bookHotel(
    bookingData: RatehawkBookingRequest,
    rateKey: string,
    paymentData: any,
    requestId: string,
  ): Promise<RatehawkBookingResult> {
    const log = this.logFor(requestId);
    this.assertCredentials(log);
    if (!bookingData.contactEmail || !bookingData.contactPhone) {
      // ETG requires a contact on every booking (booking/finish `user`).
      throw new BadRequestException(
        "RateHawk bookings require contactEmail and contactPhone (the airline contact)",
      );
    }

    // Once finish has been sent, ETG may complete the order even if we never
    // see the result; only a final ETG error proves nothing was booked.
    let partnerOrderId = "";
    let finishAttempted = false;

    try {
      const checked = await this.prebookRate(rateKey, log);
      const { key } = checked;

      this.logger.info(
        "Creating live reservation with RateHawk",
        this.context,
        requestId,
        {
          bookingId: bookingData.bookingId,
          priceChanged: checked.priceChanged,
        },
      );

      // ETG: on timeout/unknown/5xx retry the form with a NEW partner_order_id.
      let form: any = null;
      for (
        let attempt = 1;
        attempt <= this.maxAttempts && !form;
        attempt += 1
      ) {
        partnerOrderId = crypto.randomUUID();
        try {
          form = await this.call<any>(
            "hotel/order/booking/form/",
            {
              partner_order_id: partnerOrderId,
              book_hash: checked.bookHash,
              language: LANGUAGE,
              // ETG only uses the end-user IP for card payments; we pay by deposit.
              user_ip: bookingData.userIp || "127.0.0.1",
            },
            log,
            { retry: false },
          );
        } catch (error: any) {
          if (!this.isTransient(error) || attempt === this.maxAttempts) {
            throw error;
          }
          await this.sleep(this.backoffMs(attempt));
        }
      }

      const payment = this.pickPaymentType(form?.payment_types);
      if (!payment) {
        throw new Error("RateHawk booking form returned no payment types");
      }
      if (payment.type !== "deposit" || payment.is_need_credit_card_data) {
        throw new Error(
          `RateHawk rate requires payment type '${payment.type}' with card data, which is not supported`,
        );
      }

      // ETG wants one guest entry per person; only the lead passenger is named.
      const firstName = this.sanitizeName(bookingData.firstName, "Guest");
      const lastName = this.sanitizeName(bookingData.lastName, "Guest");
      const guests = [
        { first_name: firstName, last_name: lastName },
        ...Array.from({ length: Math.max(0, key.adults - 1) }, () => ({
          first_name: "Guest",
          last_name: lastName,
        })),
        ...key.childrenAges.map((age) => ({
          first_name: "Guest",
          last_name: lastName,
          is_child: true,
          age,
        })),
      ];

      const sendFinish = () =>
        this.call(
          "hotel/order/booking/finish/",
          {
            user: {
              email: bookingData.contactEmail,
              phone: bookingData.contactPhone,
            },
            partner: {
              partner_order_id: partnerOrderId,
              comment: `PNR ${bookingData.pnr} / booking ${bookingData.bookingId}`,
            },
            language: LANGUAGE,
            rooms: [{ guests }],
            payment_type: {
              type: payment.type,
              amount: String(payment.amount),
              currency_code: String(payment.currency_code),
            },
          },
          log,
          { retry: false, timeoutMs: this.bookingFinishTimeoutMs },
        );

      // ETG: timeout/unknown/5xx from finish means "go poll the status", not failure.
      let finishWasTransient = false;
      finishAttempted = true;
      try {
        await sendFinish();
      } catch (error: any) {
        if (!this.isTransient(error)) throw error;
        finishWasTransient = true;
      }

      try {
        await this.waitForBookingCompletion(partnerOrderId, requestId, log);
      } catch (error: any) {
        // The dropped finish never reached ETG: send it once more for the same order.
        if (
          !finishWasTransient ||
          !(error instanceof RatehawkApiError) ||
          error.code !== "booking_finish_did_not_succeed"
        ) {
          throw error;
        }
        log.warn("RateHawk finish did not register; resending once", {
          partnerOrderId,
        });
        try {
          await sendFinish();
        } catch (retryError: any) {
          if (!this.isTransient(retryError)) throw retryError;
        }
        await this.waitForBookingCompletion(partnerOrderId, requestId, log);
      }

      const content = await this.fetchHotelContent(key.hid, log).catch(
        () => null,
      );
      // finish is paid with the form's `amount`; we record the show net as the
      // price and the charge net as our cost. booking/form carries no
      // commission_info, so read them from the prebook rate.
      const { shown, charged } = this.netAmounts(checked.payment ?? payment);

      this.logger.info(
        "Successfully created booking with RateHawk",
        this.context,
        requestId,
        { partnerOrderId, orderId: form?.order_id },
      );

      return {
        bookingReference: partnerOrderId,
        supplierOrderId: String(form?.order_id ?? ""),
        status: HotelAllocationStatus.CONFIRMED,
        hotelName: content?.name ?? "",
        hotelAddress: content?.address ?? "",
        checkInDate: key.checkin,
        checkOutDate: key.checkout,
        totalRooms: 1,
        costPerRoom: shown,
        price: shown,
        buyingPrice: charged,
      };
    } catch (error: any) {
      this.logger.error(
        `Error calling RateHawk Bookings API: ${error.message}`,
        this.context,
        requestId,
        { stack: error.stack, partnerOrderId },
      );
      const provenNotBooked =
        (error instanceof RatehawkApiError && !this.isTransient(error)) ||
        /3-D Secure/.test(String(error?.message));
      if (finishAttempted && !provenNotBooked) {
        throw new HotelBookingOutcomeUnknownError(
          `RateHawk booking ${partnerOrderId} outcome unknown: ${error.message}`,
          partnerOrderId,
        );
      }
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `RateHawk Bookings API failed: ${error.message}`,
      );
    }
  }

  /** Polls booking/finish/status until `ok`, a final error, or the booking timeout. */
  private async waitForBookingCompletion(
    partnerOrderId: string,
    requestId: string,
    log: RhLogger,
  ): Promise<void> {
    const deadline = Date.now() + this.bookingStatusTimeoutMs;
    for (;;) {
      let envelope: RatehawkEnvelope<any> | null = null;
      try {
        envelope = await this.request<any>(
          "hotel/order/booking/finish/status/",
          { partner_order_id: partnerOrderId },
          log,
          { retry: false },
        );
      } catch (error: any) {
        if (!this.isTransient(error)) throw error;
      }

      if (envelope?.status === "ok") return;
      const code = envelope?.error ?? null;
      const stillProcessing =
        !envelope ||
        envelope.status === "processing" ||
        (!!code && RatehawkProvider.RETRYABLE_ERRORS.has(code));
      if (!stillProcessing) {
        throw new RatehawkApiError(
          "hotel/order/booking/finish/status/",
          200,
          code,
          JSON.stringify(envelope),
        );
      }
      if (envelope?.data?.data_3ds) {
        throw new Error(
          "RateHawk booking requires 3-D Secure, which is not supported",
        );
      }
      if (Date.now() > deadline) {
        this.logger.warn(
          "RateHawk booking still processing after timeout; check the order before retrying",
          this.context,
          requestId,
          { partnerOrderId },
        );
        throw new Error(
          `RateHawk booking ${partnerOrderId} still processing after timeout`,
        );
      }
      await this.sleep(this.bookingStatusPollMs);
    }
  }

  // RateHawk-only: cancel by our partner_order_id (the bookingReference from bookHotel).
  async cancelBooking(
    partnerOrderId: string,
    requestId: string,
  ): Promise<{
    amountPayable: number;
    amountRefunded: number;
    currency: string;
  }> {
    const log = this.logFor(requestId);
    this.assertCredentials(log);
    try {
      // A just-completed order can take a few seconds to become visible to cancel.
      let data: any;
      for (let attempt = 1; ; attempt += 1) {
        try {
          data = await this.call<any>(
            "hotel/order/cancel/",
            { partner_order_id: partnerOrderId },
            log,
            { retry: false },
          );
          break;
        } catch (error: any) {
          const notYetVisible =
            error instanceof RatehawkApiError &&
            error.code === "order_not_found";
          if (!notYetVisible || attempt >= this.maxAttempts) throw error;
          await this.sleep(3000 * attempt);
        }
      }
      this.logger.info("Cancelled RateHawk booking", this.context, requestId, {
        partnerOrderId,
      });
      return {
        amountPayable: Number(data?.amount_payable?.amount ?? 0),
        amountRefunded: Number(data?.amount_refunded?.amount ?? 0),
        currency: String(
          data?.amount_refunded?.currency_code ??
            data?.amount_payable?.currency_code ??
            "",
        ),
      };
    } catch (error: any) {
      this.logger.error(
        `Error cancelling RateHawk booking: ${error.message}`,
        this.context,
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(
        `RateHawk cancellation failed: ${error.message}`,
      );
    }
  }
}
