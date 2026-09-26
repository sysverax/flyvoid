import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as crypto from "node:crypto";
import { config } from "../../../config/config";
import { LoggerService } from "../../../common/logger/logger.service";
import { HotelAllocationStatus } from "../../entities/enums";
import { Logger } from "winston";
import path from "node:path";
import fs from "node:fs/promises";
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

@Injectable()
export class HotelbedsProvider implements HotelProvider {
  private readonly context = "HotelbedsProvider";
  // Hotelbeds uses HOTELBEDS_API_KEY + HOTELBEDS_SECRET.
  private readonly apiKey = config.hotelProvider.hotelbeds.apiKey;
  private readonly secret = config.hotelProvider.hotelbeds.secret;
  private readonly useSandbox = config.hotelProvider.useSandbox;

  // Availability fans out one request per unique occupancy; throttle + retry so
  // Hotelbeds rate limits (429) don't fail the whole batch.
  private readonly availabilityMaxConcurrency = 3;
  private readonly availabilityMaxAttempts = 3; // 1 initial try + 2 retries
  private readonly availabilityRetryBaseMs = 1000;
  private readonly availabilityRequestTimeoutMs = 15000;
  private static readonly RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

  // Dev-only: reads the raw Hotelbeds responses dumped to disk (see
  // hotelbeds-cache/<requestId>/<occupancyKey>.json) instead of calling the
  // rate-limited API.
  private readonly occupancyCacheDir = path.join(
    process.cwd(),
    "hotelbeds-cache",
  );

  /** Loads a cached raw Hotelbeds response for one occupancy from disk.
   * Searches every `hotelbeds-cache/<runId>/` folder (newest first) for
   * `<occupancyKey>.json` and returns its `hotels.hotels` array, or `[]`
   * if no cached file exists for that occupancy. */
  private async loadCachedOccupancyResponse(
    occupancy: RoomOccupancy,
    requestLogger: Logger,
  ): Promise<any[]> {
    const fileName = `${this.occupancyKey(occupancy)}.json`;

    let runDirNames: string[];
    try {
      runDirNames = await fs.readdir(this.occupancyCacheDir);
    } catch (error: any) {
      requestLogger.warn("Hotelbeds cache directory not found", {
        context: this.context,
        cacheDir: this.occupancyCacheDir,
        error: error?.message,
      });
      return [];
    }

    const runDirs = await Promise.all(
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
    );

    const sortedRunDirs = runDirs
      .filter((entry): entry is { dirPath: string; mtimeMs: number } => !!entry)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const { dirPath } of sortedRunDirs) {
      const filePath = path.join(dirPath, fileName);
      try {
        const raw = await fs.readFile(filePath, "utf-8");
        const responseData = JSON.parse(raw);
        return responseData?.hotels?.hotels || [];
      } catch {
        continue; // not in this run folder, try the next
      }
    }

    requestLogger.warn("No cached Hotelbeds response found for occupancy", {
      context: this.context,
      occupancyFile: fileName,
    });
    return [];
  }

  constructor(private readonly logger: LoggerService) {}

  private occupancyKey(occupancy: RoomOccupancy): string {
    const ages = (occupancy.childrenAges ?? []).join("-");
    return `${occupancy.adults}_${occupancy.children}_${ages}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Fresh signature per request — a retried batch can outlive the timestamp. */
  private buildSignature(): string {
    const timestamp = Math.floor(Date.now() / 1000);
    return crypto
      .createHash("sha256")
      .update(this.apiKey + this.secret + timestamp)
      .digest("hex");
  }

  private availabilityBackoffMs(attempt: number): number {
    return (
      this.availabilityRetryBaseMs * 2 ** (attempt - 1) +
      Math.floor(Math.random() * 250)
    );
  }

  /** Runs `worker` over `items`, at most `limit` at once; first rejection wins. */
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

  /** Availability for one occupancy; retries 429/5xx/network, throws the real
   * Hotelbeds status and body on final failure. */
  private async fetchOccupancyAvailability(
    endpoint: string,
    group: { occupancy: RoomOccupancy; payload: unknown },
    requestLogger: Logger,
  ): Promise<{ occupancy: RoomOccupancy; rawHotels: any[] }> {
    const { occupancy, payload } = group;
    const label = `${occupancy.adults}A ${occupancy.children}C`;
    let lastError: Error | null = null;
    let attemptsMade = 0;

    for (
      let attempt = 1;
      attempt <= this.availabilityMaxAttempts;
      attempt += 1
    ) {
      attemptsMade = attempt;
      let response: Awaited<ReturnType<typeof fetch>>;

      requestLogger.debug("Calling Hotelbeds availability API", {
        context: this.context,
        endpoint,
        method: "POST",
        occupancy: label,
        attempt,
        payload,
      });

      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Api-key": this.apiKey,
            "X-Signature": this.buildSignature(),
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.availabilityRequestTimeoutMs),
        });
      } catch (networkError: any) {
        // connection error or the timeout above — both transient, so retry
        requestLogger.error("Hotelbeds availability API call failed", {
          context: this.context,
          endpoint,
          occupancy: label,
          attempt,
          error: networkError?.message ?? String(networkError),
        });
        lastError = new Error(
          `Hotelbeds request error for ${label}: ${networkError?.message ?? networkError}`,
        );
        if (attempt < this.availabilityMaxAttempts) {
          await this.sleep(this.availabilityBackoffMs(attempt));
          continue;
        }
        break;
      }

      if (response.ok) {
        requestLogger.info(
          `Hotelbeds availability request succeeded for ${label}`,
          {
            context: this.context,
            endpoint,
            occupancy: label,
            attempt,
            status: response.status,
          },
        );
        const responseData = await response.json();
        return {
          occupancy,
          rawHotels: responseData?.hotels?.hotels || [],
        };
      }

      const errorText = await response.text();
      lastError = new Error(
        `Hotelbeds API returned status ${response.status} for ${label}: ${errorText}`,
      );

      const retryable = HotelbedsProvider.RETRYABLE_STATUS.has(response.status);
      const willRetry = retryable && attempt < this.availabilityMaxAttempts;

      // Full status + response body here is the only place this ever gets
      // logged — the final thrown error further up just wraps the message,
      // so without this an admin has no way to see what Hotelbeds actually
      // rejected the request for.
      requestLogger.error("Hotelbeds availability API returned an error response", {
        context: this.context,
        endpoint,
        occupancy: label,
        status: response.status,
        attempt,
        body: errorText,
        willRetry,
      });

      if (willRetry) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : this.availabilityBackoffMs(attempt);
        await this.sleep(waitMs);
        continue;
      }

      break; // non-retryable status (403/400/...) or attempts exhausted
    }

    throw new Error(
      `Hotelbeds availability for ${label} failed after ${attemptsMade} attempt(s): ${
        lastError?.message ?? "unknown error"
      }`,
    );
  }

  private parseOccupancyFromRateOrRoom(room: any, rate: any): RoomOccupancy {
    const adults = Number(rate?.adults ?? room?.adults ?? 0);
    const children = Number(rate?.children ?? room?.children ?? 0);
    const childrenAges = Array.isArray(rate?.childrenAges)
      ? rate.childrenAges
          .map((v: unknown) => Number(v))
          .filter((v: number) => !Number.isNaN(v))
      : [];

    return {
      adults,
      children,
      childrenAges,
    };
  }

  private normalizeAvailabilityHotels(rawHotels: any[]): AvailabilityHotel[] {
    return rawHotels
      .map((hotel: any) => {
        const hotelCode = String(hotel.code ?? "");
        const hotelName = String(hotel.name ?? "Unknown Hotel");
        const category = String(hotel.categoryName ?? "Unknown Category");
        const address = String(
          hotel.address ??
            `Near Airport (Zone: ${hotel.zoneName || "Transit"})`,
        );

        // Prefer categoryCode's leading digit (e.g. "5EST") over scanning categoryName, which can grab a stray digit like a bedroom count.
        let stars = 3;
        const codeMatch = String(hotel.categoryCode ?? "").match(/^(\d)/);
        const nameMatch = category.match(/(\d)(?:\.\d)?\s*-?\s*(?:STARS?|\*)/i);
        if (codeMatch) {
          stars = parseInt(codeMatch[1], 10);
        } else if (nameMatch) {
          stars = parseInt(nameMatch[1], 10);
        }

        const rates: AvailabilityRoomRate[] = (hotel.rooms ?? []).flatMap(
          (room: any) =>
            (room.rates ?? [])
              .filter((rate: any) => !!rate?.rateKey)
              .map((rate: any) => {
                const occupancy = this.parseOccupancyFromRateOrRoom(room, rate);
                return {
                  hotelCode,
                  hotelName,
                  category,
                  roomCode: room.code ? String(room.code) : null,
                  roomName: String(room.name ?? "Unknown Room"),
                  boardCode: rate.boardCode ? String(rate.boardCode) : null,
                  boardName: String(rate.boardName ?? "Room Only"),
                  rateKey: String(rate.rateKey),
                  rateType: rate.rateType ? String(rate.rateType) : null,
                  netPrice: Number(rate.net ?? 0),
                  currency: String(rate.currency ?? "EUR"),
                  allotment:
                    rate.allotment !== undefined && rate.allotment !== null
                      ? Number(rate.allotment)
                      : null,
                  adults: occupancy.adults,
                  children: occupancy.children,
                  childrenAges: occupancy.childrenAges,
                  cancellationPolicies: Array.isArray(rate.cancellationPolicies)
                    ? rate.cancellationPolicies.map((policy: any) => ({
                        amount: Number(policy.amount ?? 0),
                        from: String(policy.from ?? ""),
                      }))
                    : [],
                  rateComments: rate.rateComments
                    ? String(rate.rateComments)
                    : null,
                  paymentType: rate.paymentType
                    ? String(rate.paymentType)
                    : null,
                };
              }),
        );

        return {
          hotelCode,
          hotelName,
          category,
          address,
          stars,
          rates,
        };
      })
      .filter((hotel) => hotel.rates.length > 0);
  }

  async searchNearbyHotelsWithOccupancies(
    airport: {
      iataCode: string;
      latitude: number;
      longitude: number;
    },
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
    if (!this.apiKey || !this.secret) {
      requestLogger.warn("Hotelbeds credentials not configured.", {
        context: this.context,
      });

      throw new ServiceUnavailableException(
        "Hotelbeds API credentials not configured",
      );
    }

    const endpoint = this.useSandbox
      ? "https://api.test.hotelbeds.com/hotel-api/1.0/hotels"
      : "https://api.hotelbeds.com/hotel-api/1.0/hotels";

    if (!occupancies.length) {
      requestLogger.warn(
        "No occupancies provided for hotel availability search.",
        {
          context: this.context,
        },
      );
      throw new BadRequestException(
        "At least one occupancy is required for hotel availability search",
      );
    }

    const dedupedOccupancies = Array.from(
      new Map(
        occupancies.map((occupancy) => [
          this.occupancyKey(occupancy),
          occupancy,
        ]),
      ).values(),
    );

    const buildPayloads = (
      radius: number,
      occupanciesToQuery: RoomOccupancy[],
    ) =>
      occupanciesToQuery.map((occupancy) => {
        const childrenCount = Number(occupancy.children ?? 0);
        const normalizedAges = (occupancy.childrenAges ?? []).filter(
          (age) => Number.isFinite(age) && age > 0,
        );
        const agesToSend =
          childrenCount > 0
            ? Array.from(
                { length: childrenCount },
                (_, index) => normalizedAges[index] ?? 6,
              )
            : [];

        const paxes =
          agesToSend.length > 0
            ? agesToSend.map((age) => ({ type: "CH", age }))
            : undefined;

        return {
          occupancy,
          payload: {
            stay: {
              checkIn: checkInDate,
              checkOut: checkOutDate,
            },
            occupancies: [
              {
                rooms: 1,
                adults: Number(occupancy.adults),
                children: childrenCount,
                ...(paxes ? { paxes } : {}),
              },
            ],
            geolocation: {
              latitude: Number(airport.latitude),
              longitude: Number(airport.longitude),
              radius,
              unit: config.hotelSearch.unit,
            },
          },
        };
      });

    // Accumulates across widen rounds so a shape that already found hotels
    // at a smaller radius is never re-merged or re-queried.
    const mergedByHotelCode = new Map<string, any>();
    const mergeHotel = (hotel: any) => {
      const key = String(hotel?.code ?? "");
      if (!key) {
        return;
      }
      const existing = mergedByHotelCode.get(key);
      if (!existing) {
        mergedByHotelCode.set(key, {
          ...hotel,
          rooms: Array.isArray(hotel.rooms) ? [...hotel.rooms] : [],
        });
        return;
      }
      if (Array.isArray(hotel.rooms) && hotel.rooms.length > 0) {
        existing.rooms = [...(existing.rooms ?? []), ...hotel.rooms];
      }
    };

    // Queries only occupanciesToQuery (not every shape) and returns which of
    // those are still empty, so subsequent widen rounds only re-query the
    // shapes that actually need it instead of re-fetching everything.
    const fetchAndMerge = async (
      radius: number,
      occupanciesToQuery: RoomOccupancy[],
    ): Promise<RoomOccupancy[]> => {
      const responses = await this.mapWithConcurrency(
        buildPayloads(radius, occupanciesToQuery),
        this.availabilityMaxConcurrency,
        (group) =>
          this.fetchOccupancyAvailability(endpoint, group, requestLogger),
      );

      const stillMissing: RoomOccupancy[] = [];
      for (const { occupancy, rawHotels } of responses) {
        if (!Array.isArray(rawHotels) || rawHotels.length === 0) {
          stillMissing.push(occupancy);
          continue;
        }
        for (const hotel of rawHotels) {
          mergeHotel(hotel);
        }
      }
      return stillMissing;
    };

    requestLogger.info("Fetching hotel availability from Hotelbeds API", {
      context: this.context,
      airportCode: airport.iataCode,
      occupancyCount: dedupedOccupancies.length,
      useSandbox: this.useSandbox,
    });

    try {
      const { defaultRadius } = config.hotelSearch;
      const maxRadius = Math.max(defaultRadius, config.hotelSearch.maxRadius);

      // Widen while ANY shape has zero hits, not just when the total is
      // zero - otherwise a rare shape can starve while common ones already
      // found hotels. Each round only re-queries the shapes still missing.
      let stillMissing = dedupedOccupancies;
      for (
        let radius = defaultRadius;
        radius <= maxRadius && stillMissing.length > 0;
        radius += 10
      ) {
        const missingBefore = stillMissing.length;
        stillMissing = await fetchAndMerge(radius, stillMissing);
        if (stillMissing.length === 0) {
          break;
        }
        requestLogger.info(
          `${stillMissing.length} occupancy shape(s) still had no hotels within ${radius}${config.hotelSearch.unit} of ${airport.iataCode}, widening search for just those`,
          {
            context: this.context,
            stillMissingCount: stillMissing.length,
            queriedCount: missingBefore,
          },
        );
      }
      const mergedRawHotels = Array.from(mergedByHotelCode.values());

      requestLogger.info(
        `Successfully received ${mergedRawHotels.length} merged hotels from Hotelbeds API`,
        {
          context: this.context,
        },
      );

      if (mergedRawHotels.length === 0) {
        throw new NotFoundException(
          `No hotels found near airport ${airport.iataCode} for the requested occupancies`,
        );
      }
      requestLogger.info(`Merged raw hotels: ${mergedRawHotels.length}`, {
        context: this.context,
        mergedRawHotels,
      });

      return this.normalizeAvailabilityHotels(mergedRawHotels);
    } catch (error: any) {
      requestLogger.error(`Error querying Hotelbeds API: ${error.message}`, {
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

      // pass through the real Hotelbeds status/body from fetchOccupancyAvailability
      throw new ServiceUnavailableException(error.message);
    }
  }

  // Response from json file — reads cached Hotelbeds responses from disk
  // (hotelbeds-cache/<runId>/<occupancyKey>.json) instead of calling the API.
  async searchNearbyHotelsWithOccupanciesFromJson(
    airport: {
      iataCode: string;
      latitude: number;
      longitude: number;
    },
    checkInDate: string,
    checkOutDate: string,
    occupancies: RoomOccupancy[],
    requestId: string,
    requestLogger: Logger,
  ): Promise<AvailabilityHotel[]> {
    if (!occupancies.length) {
      requestLogger.warn(
        "No occupancies provided for hotel availability search.",
        {
          context: this.context,
        },
      );
      throw new BadRequestException(
        "At least one occupancy is required for hotel availability search",
      );
    }

    const dedupedOccupancies = Array.from(
      new Map(
        occupancies.map((occupancy) => [
          this.occupancyKey(occupancy),
          occupancy,
        ]),
      ).values(),
    );

    requestLogger.info(
      "Loading hotel availability from cached Hotelbeds responses",
      {
        context: this.context,
        airportCode: airport.iataCode,
        occupancyCount: dedupedOccupancies.length,
        cacheDir: this.occupancyCacheDir,
      },
    );

    const responses = await Promise.all(
      dedupedOccupancies.map(async (occupancy) => ({
        occupancy,
        rawHotels: await this.loadCachedOccupancyResponse(
          occupancy,
          requestLogger,
        ),
      })),
    );

    const mergedByHotelCode = new Map<string, any>();
    for (const { rawHotels } of responses) {
      for (const hotel of rawHotels) {
        const key = String(hotel?.code ?? "");
        if (!key) {
          continue;
        }

        const existing = mergedByHotelCode.get(key);
        if (!existing) {
          mergedByHotelCode.set(key, {
            ...hotel,
            rooms: Array.isArray(hotel.rooms) ? [...hotel.rooms] : [],
          });
          continue;
        }

        if (Array.isArray(hotel.rooms) && hotel.rooms.length > 0) {
          existing.rooms = [...(existing.rooms ?? []), ...hotel.rooms];
        }
      }
    }

    const mergedRawHotels = Array.from(mergedByHotelCode.values());

    requestLogger.info(
      `Loaded ${mergedRawHotels.length} merged hotels from cached Hotelbeds responses`,
      {
        context: this.context,
      },
    );

    if (mergedRawHotels.length === 0) {
      throw new NotFoundException(
        `No cached hotel data found near airport ${airport.iataCode} for the requested occupancies`,
      );
    }

    return this.normalizeAvailabilityHotels(mergedRawHotels);
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
        id: `hb-${hotel.hotelCode}`,
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

  // Facility groups that are administrative facts, not guest amenities.
  private static readonly NON_AMENITY_FACILITY_GROUPS = new Set([10, 20, 30]);

  // Best-effort hotel profile lookup via the Hotelbeds Content API; never blocks allocation on failure.
  async getHotelContentDetails(
    hotelCode: string,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelContentDetails | null> {
    if (!config.hotelSearch.isAllowFetchHotelDetails) {
      // Temporarily disabled (Content API call commented out below); returns empty placeholders.
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

    if (!this.apiKey || !this.secret) {
      return null;
    }

    const endpoint = this.useSandbox
      ? `https://api.test.hotelbeds.com/hotel-content-api/1.0/hotels/${hotelCode}/details`
      : `https://api.hotelbeds.com/hotel-content-api/1.0/hotels/${hotelCode}/details`;

    try {
      requestLogger.debug("Calling Hotelbeds content API", {
        context: this.context,
        endpoint,
        method: "GET",
        hotelCode,
      });

      const response = await fetch(`${endpoint}?language=ENG`, {
        method: "GET",
        headers: {
          "Api-key": this.apiKey,
          "X-Signature": this.buildSignature(),
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(this.availabilityRequestTimeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        requestLogger.error("Hotelbeds content API returned an error response", {
          context: this.context,
          endpoint,
          hotelCode,
          status: response.status,
          body: errorText,
        });
        return null;
      }

      const hotel = (await response.json())?.hotel;
      if (!hotel) {
        return null;
      }

      const address = [hotel.address?.content, hotel.city?.content]
        .filter(Boolean)
        .join(", ");
      const phones = Array.isArray(hotel.phones)
        ? hotel.phones
            .filter((p: any) => p?.phoneNumber)
            .map((p: any) => ({
              phoneNumber: String(p.phoneNumber),
              phoneType: String(p.phoneType ?? ""),
            }))
        : [];

      const firstImagePath = Array.isArray(hotel.images)
        ? hotel.images[0]?.path
        : null;
      const distanceFromAirportKm = Array.isArray(hotel.terminals)
        ? (hotel.terminals[0]?.distance ?? null)
        : null;
      const amenities = Array.isArray(hotel.facilities)
        ? Array.from(
            new Set<string>(
              hotel.facilities
                .filter(
                  (f: any) =>
                    f?.number === undefined &&
                    f?.description?.content &&
                    !HotelbedsProvider.NON_AMENITY_FACILITY_GROUPS.has(
                      f.facilityGroupCode,
                    ),
                )
                .map((f: any) => String(f.description.content)),
            ),
          ).slice(0, 15)
        : [];

      requestLogger.debug("Hotelbeds content API call succeeded", {
        context: this.context,
        endpoint,
        hotelCode,
        status: response.status,
      });

      return {
        address: address || null,
        contact: { phones, email: hotel.email ? String(hotel.email) : null },
        latitude: hotel.coordinates?.latitude ?? null,
        longitude: hotel.coordinates?.longitude ?? null,
        distanceFromAirportKm,
        imageUrl: firstImagePath
          ? `https://photos.hotelbeds.com/giata/bigger/${firstImagePath}`
          : null,
        website: hotel.web ? String(hotel.web) : null,
        amenities,
      };
    } catch (error: any) {
      requestLogger.error(
        `Error querying Hotelbeds Content API for hotel '${hotelCode}': ${error.message}`,
        { context: this.context, stack: error.stack },
      );
      return null;
    }
  }

  /** Maps a Hotelbeds CheckRate response to the supplier-neutral HotelRateCheck. */
  private toRateCheck(responseData: any): HotelRateCheck {
    const hotel = responseData?.hotel;
    if (!hotel) {
      throw new Error("Hotelbeds CheckRate returned no hotel");
    }
    const room = hotel.rooms?.[0];
    const rate = room?.rates?.[0];
    return {
      hotelCode: String(hotel.code ?? ""),
      hotelName: String(hotel.name ?? ""),
      category: String(hotel.categoryName ?? ""),
      address: null, // not in CheckRate; comes from the Content API
      checkInDate: String(hotel.checkIn ?? ""),
      checkOutDate: String(hotel.checkOut ?? ""),
      roomName: String(room?.name ?? ""),
      boardName: String(rate?.boardName ?? ""),
      adults: Number(rate?.adults ?? 0),
      children: Number(rate?.children ?? 0),
      netPrice: Number(rate?.net ?? hotel.totalNet ?? 0),
      currency: String(hotel.currency ?? "EUR"),
      cancellationPolicies: Array.isArray(rate?.cancellationPolicies)
        ? rate.cancellationPolicies.map((policy: any) => ({
            amount: Number(policy.amount ?? 0),
            from: String(policy.from ?? ""),
          }))
        : [],
      rateComments: rate?.rateComments ? String(rate.rateComments) : null,
      priceChanged: false,
    };
  }

  // HotelProvider.checkRate — re-validates a rate before booking.
  async checkRate(rateKey: string, requestId: string): Promise<HotelRateCheck> {
    if (!this.apiKey || !this.secret) {
      this.logger.warn(
        "Hotelbeds credentials not configured.",
        "HotelbedsProvider",
        requestId,
      );
      throw new ServiceUnavailableException(
        "Hotelbeds API credentials not configured",
      );
    }

    const endpoint = this.useSandbox
      ? "https://api.test.hotelbeds.com/hotel-api/1.0/checkrates"
      : "https://api.hotelbeds.com/hotel-api/1.0/checkrates";

    const timestamp = Math.floor(Date.now() / 1000);
    const dataToHash = this.apiKey + this.secret + timestamp;
    const signature = crypto
      .createHash("sha256")
      .update(dataToHash)
      .digest("hex");

    const payload = {
      rooms: [
        {
          rateKey,
        },
      ],
    };

    try {
      this.logger.info(
        "Validating rate with Hotelbeds CheckRate API",
        "HotelbedsProvider",
        requestId,
        { rateKey },
      );

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Api-key": this.apiKey,
          "X-Signature": signature,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Hotelbeds CheckRate API returned status ${response.status}: ${errorText}`,
        );
      }

      const responseData = await response.json();
      this.logger.info(
        "Successfully validated rate with Hotelbeds",
        "HotelbedsProvider",
        requestId,
      );
      return this.toRateCheck(responseData);
    } catch (error: any) {
      this.logger.error(
        `Error calling Hotelbeds CheckRate API: ${error.message}`,
        "HotelbedsProvider",
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(
        `Hotelbeds CheckRate API failed: ${error.message}`,
      );
    }
  }

  // HotelProvider.bookHotel — live reservation of a checked rate.
  async bookHotel(
    bookingData: {
      firstName: string;
      lastName: string;
      bookingId: number;
      pnr: string;
    },
    rateKey: string,
    paymentData: any,
    requestId: string,
  ): Promise<{
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
  }> {
    if (!this.apiKey || !this.secret) {
      this.logger.warn(
        "Hotelbeds credentials not configured.",
        "HotelbedsProvider",
        requestId,
      );
      throw new ServiceUnavailableException(
        "Hotelbeds API credentials not configured",
      );
    }

    const endpoint = this.useSandbox
      ? "https://api-secure.test.hotelbeds.com/hotel-api/1.0/bookings"
      : "https://api-secure.hotelbeds.com/hotel-api/1.0/bookings";

    const timestamp = Math.floor(Date.now() / 1000);
    const dataToHash = this.apiKey + this.secret + timestamp;
    const signature = crypto
      .createHash("sha256")
      .update(dataToHash)
      .digest("hex");

    const payload: any = {
      holder: {
        name: bookingData.firstName,
        surname: bookingData.lastName,
      },
      rooms: [
        {
          rateKey: rateKey,
          paxes: [
            {
              roomId: 1,
              type: "AD",
              name: bookingData.firstName,
              surname: bookingData.lastName,
            },
          ],
        },
      ],
      clientReference: bookingData.pnr,
    };

    if (paymentData) {
      payload.paymentData = paymentData;
    }

    try {
      this.logger.info(
        "Creating live reservation with Hotelbeds Bookings API",
        "HotelbedsProvider",
        requestId,
        { bookingId: bookingData.bookingId },
      );

      // A lost response or a 5xx after the request went out may still have
      // created the booking; look it up by clientReference (the PNR).
      const outcomeUnknown = (detail: string) =>
        new HotelBookingOutcomeUnknownError(
          `Hotelbeds booking outcome unknown for clientReference '${bookingData.pnr}': ${detail}`,
          bookingData.pnr,
        );

      let response: Awaited<ReturnType<typeof fetch>>;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Api-key": this.apiKey,
            "X-Signature": signature,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (networkError: any) {
        throw outcomeUnknown(networkError?.message ?? String(networkError));
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        if (response.status >= 500) {
          throw outcomeUnknown(`status ${response.status}: ${errorText}`);
        }
        throw new Error(
          `Hotelbeds Bookings API returned status ${response.status}: ${errorText}`,
        );
      }

      let responseData: any;
      try {
        responseData = await response.json();
      } catch (parseError: any) {
        throw outcomeUnknown(`unreadable response: ${parseError?.message}`);
      }
      this.logger.info(
        "Successfully created booking with Hotelbeds",
        "HotelbedsProvider",
        requestId,
      );
      return {
        bookingReference: responseData.booking.reference,
        status: HotelAllocationStatus.CONFIRMED,
        hotelName: responseData.booking.hotel.name,
        hotelAddress: responseData.booking.hotel.address,
        checkInDate: responseData.booking.stay.checkIn,
        checkOutDate: responseData.booking.stay.checkOut,
        totalRooms: responseData.booking.rooms.length,
        costPerRoom: responseData.booking.rooms[0].totalNet,
        price: responseData.booking.totalNet,
        buyingPrice: responseData.booking.buyingPrice,
      };
    } catch (error: any) {
      this.logger.error(
        `Error calling Hotelbeds Bookings API: ${error.message}`,
        "HotelbedsProvider",
        requestId,
        { stack: error.stack },
      );
      if (error instanceof HotelBookingOutcomeUnknownError) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `Hotelbeds Bookings API failed: ${error.message}`,
      );
    }
  }
}
