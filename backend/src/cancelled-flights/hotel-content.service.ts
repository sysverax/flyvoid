import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { Logger } from "winston";
import { randomUUID } from "crypto";
import { config } from "../config/config";
import { LoggerService } from "../common/logger/logger.service";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";
import { HotelEntity } from "./entities/hotel.entity";
import { starsLabel } from "./hotel-allocation.record";
import {
  AvailabilityHotel,
  HOTEL_PROVIDER,
  HotelContentDetails,
  HotelProvider,
} from "./hotel-providers/hotel-provider.interface";

/** A supplier other than the env-selected one (e.g. the admin availability page). */
export interface HotelContentSource {
  /** providers.code, e.g. "ratehawk". */
  code: string;
  adapter: HotelProvider;
}

/**
 * Keeps static hotel data in our hotels table: fetched from the supplier's
 * content API when a hotel is missing or older than the refresh window, and
 * refreshed on a schedule. Search and booking read it from the table.
 */
@Injectable()
export class HotelContentService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly context = "HotelContentService";
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshing = false;

  constructor(
    private readonly cancelledFlightsRepository: CancelledFlightsRepository,
    @Inject(HOTEL_PROVIDER) private readonly hotelProvider: HotelProvider,
    private readonly logger: LoggerService,
  ) {}

  private get provider(): string {
    return config.hotelProvider.name;
  }

  /** Whether this supplier's static data is kept in our hotels table. */
  private get usesStoredContent(): boolean {
    return this.storesContent(this.hotelProvider);
  }

  private storesContent(adapter: HotelProvider): boolean {
    return (
      !!adapter.fetchHotelsStaticContent &&
      config.hotelSearch.isAllowFetchHotelDetails
    );
  }

  onApplicationBootstrap(): void {
    if (!this.usesStoredContent) return;
    // First run a few minutes after start, then once per refresh interval.
    const start = setTimeout(
      () => {
        void this.refreshStaleHotels();
        this.refreshTimer = setInterval(
          () => void this.refreshStaleHotels(),
          config.hotelContent.refreshIntervalMs,
        );
        this.refreshTimer.unref();
      },
      5 * 60 * 1000,
    );
    start.unref();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  /** Stored hotels for these codes, fetching any that are missing or stale first. */
  async ensureHotelContent(
    hotelCodes: string[],
    requestId: string,
    requestLogger: Logger,
    source?: HotelContentSource,
  ): Promise<Map<string, HotelEntity>> {
    const provider = source?.code ?? this.provider;
    const adapter = source?.adapter ?? this.hotelProvider;
    const codes = [...new Set(hotelCodes.filter(Boolean))];
    let hotels = await this.cancelledFlightsRepository.findHotelsByCodes(
      provider,
      codes,
    );
    if (this.storesContent(adapter)) {
      const staleBefore = Date.now() - config.hotelContent.staleAfterMs;
      const byCode = new Map(
        hotels.map((hotel) => [hotel.providerHotelId, hotel]),
      );
      const toFetch = codes.filter((code) => {
        const updatedAt = byCode.get(code)?.contentUpdatedAt;
        return !updatedAt || new Date(updatedAt).getTime() < staleBefore;
      });
      if (toFetch.length > 0) {
        try {
          const contents = await adapter.fetchHotelsStaticContent!(
            toFetch,
            requestId,
          );
          await this.cancelledFlightsRepository.saveHotelContent(
            provider,
            contents,
          );
          hotels = await this.cancelledFlightsRepository.findHotelsByCodes(
            provider,
            codes,
          );
          requestLogger.info("Fetched static hotel content", {
            context: this.context,
            requested: toFetch.length,
            received: contents.length,
          });
        } catch (error: any) {
          requestLogger.warn(
            "Could not fetch static hotel content; using stored data",
            {
              context: this.context,
              hotels: toFetch.length,
              error: error?.message,
            },
          );
        }
      }
    }
    return new Map(hotels.map((hotel) => [hotel.providerHotelId, hotel]));
  }

  /** Fills search results with stored names and star ratings (search returns neither). */
  async enrichSearchResults(
    hotels: AvailabilityHotel[],
    requestId: string,
    requestLogger: Logger,
  ): Promise<AvailabilityHotel[]> {
    if (!this.usesStoredContent || hotels.length === 0) return hotels;
    const stored = await this.ensureHotelContent(
      hotels.map((hotel) => hotel.hotelCode),
      requestId,
      requestLogger,
    );
    const active = hotels.filter(
      (hotel) => stored.get(hotel.hotelCode)?.isActive !== false,
    );
    if (active.length < hotels.length) {
      requestLogger.info(
        "Skipped hotels the supplier reports closed or removed",
        {
          context: this.context,
          skipped: hotels.length - active.length,
        },
      );
    }
    return active.map((hotel) => {
      const content = stored.get(hotel.hotelCode);
      if (!content) return hotel;
      const hotelName = content.name || hotel.hotelName;
      const stars = content.starRating ?? 0;
      const category = starsLabel(stars);
      return {
        ...hotel,
        hotelName,
        stars,
        category,
        address: content.address ?? hotel.address,
        rates: hotel.rates.map((rate) => ({ ...rate, hotelName, category })),
      };
    });
  }

  /** A booked hotel's profile from the hotels table (the supplier's own lookup when it has no content API). */
  async getHotelDetails(
    hotelCode: string,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelContentDetails | null> {
    if (!this.usesStoredContent) {
      return this.hotelProvider
        .getHotelContentDetails(hotelCode, requestId, requestLogger)
        .catch(() => null);
    }
    const hotel = (
      await this.ensureHotelContent([hotelCode], requestId, requestLogger)
    ).get(hotelCode);
    if (!hotel?.contentUpdatedAt) return null;
    return {
      name: hotel.name || null,
      starRating: hotel.starRating ?? null,
      policies: hotel.policies ?? null,
      address: hotel.address ?? null,
      contact: hotel.contact ?? { phones: [], email: null },
      latitude: hotel.latitude != null ? Number(hotel.latitude) : null,
      longitude: hotel.longitude != null ? Number(hotel.longitude) : null,
      distanceFromAirportKm: null,
      imageUrl: hotel.imageUrl ?? null,
      website: hotel.website ?? null,
      amenities: hotel.amenities ?? [],
    };
  }

  /** Scheduled: refreshes stored hotels whose content is older than the refresh window. */
  async refreshStaleHotels(): Promise<void> {
    if (this.refreshing || !this.usesStoredContent) return;
    this.refreshing = true;
    const requestId = `hotel-content-refresh-${randomUUID()}`;
    try {
      const codes = await this.cancelledFlightsRepository.findStaleHotelCodes(
        this.provider,
        config.hotelContent.staleAfterMs,
        config.hotelContent.refreshBatchLimit,
      );
      if (codes.length === 0) return;
      const contents = await this.hotelProvider.fetchHotelsStaticContent!(
        codes,
        requestId,
      );
      await this.cancelledFlightsRepository.saveHotelContent(
        this.provider,
        contents,
      );
      this.logger.info(
        "Refreshed stale static hotel content",
        this.context,
        requestId,
        {
          stale: codes.length,
          refreshed: contents.length,
        },
      );
    } catch (error: any) {
      this.logger.error(
        `Static hotel content refresh failed: ${error?.message}`,
        this.context,
        requestId,
      );
    } finally {
      this.refreshing = false;
    }
  }
}
