import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { config } from "../config/config";
import { LoggerService } from "../common/logger/logger.service";
import { HotelAllocationStatus } from "./entities/enums";
import { Logger } from "winston";

export interface HotelCandidate {
  id: string;
  name: string;
  address: string;
  stars: number;
  amenities: string[];
  pricePerNight: number;
  description: string;
  rateKey?: string | null;
}

export interface RoomOccupancy {
  adults: number;
  children: number;
  childrenAges?: number[];
}

export interface AvailabilityRoomRate {
  hotelCode: string;
  hotelName: string;
  category: string;
  roomCode: string | null;
  roomName: string;
  boardCode: string | null;
  boardName: string;
  rateKey: string;
  rateType: string | null;
  netPrice: number;
  currency: string;
  allotment: number | null;
  adults: number;
  children: number;
  childrenAges: number[];
  cancellationPolicies: Array<{ amount: number; from: string }>;
  rateComments: string | null;
  paymentType: string | null;
}

export interface AvailabilityHotel {
  hotelCode: string;
  hotelName: string;
  category: string;
  address: string;
  stars: number;
  rates: AvailabilityRoomRate[];
}

@Injectable()
export class HotelPartnerService {
  private readonly apiKey = config.hotelbeds.apiKey;
  private readonly secret = config.hotelbeds.secret;
  private readonly useSandbox = config.hotelbeds.useSandbox;

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
        context: "HotelPartnerService",
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
      context: "HotelPartnerService",
      occupancyFile: fileName,
    });
    return [];
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

      const retryable = HotelPartnerService.RETRYABLE_STATUS.has(
        response.status,
      );
      if (retryable && attempt < this.availabilityMaxAttempts) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : this.availabilityBackoffMs(attempt);
        requestLogger.warn(
          "Hotelbeds availability request failed, retrying occupancy",
          {
            context: "HotelPartnerService",
            occupancy: label,
            status: response.status,
            attempt,
            nextAttemptInMs: waitMs,
          },
        );
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

        let stars = 3;
        const starMatch = category.match(/(\d)/);
        if (starMatch) {
          stars = parseInt(starMatch[1], 10);
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

  // async searchNearbyHotelsWithOccupancies(
  //   airport: { iataCode: string; latitude: number; longitude: number },
  //   checkInDate: string,
  //   checkOutDate: string,
  //   occupancies: RoomOccupancy[],
  //   requestId: string,
  // ): Promise<AvailabilityHotel[]> {
  //   if (!this.apiKey || !this.secret) {
  //     this.logger.warn(
  //       "Hotelbeds credentials not configured.",
  //       "HotelPartnerService",
  //       requestId,
  //     );
  //     throw new ServiceUnavailableException(
  //       "Hotelbeds API credentials not configured",
  //     );
  //   }

  //   const endpoint = this.useSandbox
  //     ? "https://api.test.hotelbeds.com/hotel-api/1.0/hotels"
  //     : "https://api.hotelbeds.com/hotel-api/1.0/hotels";

  //   const timestamp = Math.floor(Date.now() / 1000);
  //   const dataToHash = this.apiKey + this.secret + timestamp;
  //   const signature = crypto
  //     .createHash("sha256")
  //     .update(dataToHash)
  //     .digest("hex");

  //   const dedupedOccupancies = Array.from(
  //     new Map(
  //       occupancies.map((occupancy) => [
  //         this.occupancyKey(occupancy),
  //         occupancy,
  //       ]),
  //     ).values(),
  //   );

  //   const payload = {
  //     stay: {
  //       checkIn: checkInDate,
  //       checkOut: checkOutDate,
  //     },
  //     occupancies: dedupedOccupancies.map((occupancy) => ({
  //       rooms: 1,
  //       adults: occupancy.adults,
  //       children: occupancy.children,
  //       ...(occupancy.children > 0 && occupancy.childrenAges?.length
  //         ? {
  //             paxes: occupancy.childrenAges.map((age) => ({ type: "CH", age })),
  //           }
  //         : {}),
  //     })),
  //     geolocation: {
  //       latitude: Number(airport.latitude),
  //       longitude: Number(airport.longitude),
  //       radius: 20,
  //       unit: "km",
  //     },
  //   };

  //   console.log("Payload for Hotelbeds API:", JSON.stringify(payload, null, 2));

  //   try {
  //     this.logger.info(
  //       "Fetching hotel availability from Hotelbeds API",
  //       "HotelPartnerService",
  //       requestId,
  //       {
  //         airportCode: airport.iataCode,
  //         occupancyCount: dedupedOccupancies.length,
  //         useSandbox: this.useSandbox,
  //       },
  //     );

  //     const response = await fetch(endpoint, {
  //       method: "POST",
  //       headers: {
  //         "Api-key": this.apiKey,
  //         "X-Signature": signature,
  //         Accept: "application/json",
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify(payload),
  //     });

  //     if (!response.ok) {
  //       const errorText = await response.text();
  //       throw new Error(
  //         `Hotelbeds API returned status ${response.status}: ${errorText}`,
  //       );
  //     }

  //     const responseData = await response.json();
  //     const rawHotels = responseData?.hotels?.hotels || [];

  //     this.logger.info(
  //       `Successfully received ${rawHotels.length} hotels from Hotelbeds API`,
  //       "HotelPartnerService",
  //       requestId,
  //     );

  //     if (rawHotels.length === 0) {
  //       this.logger.warn(
  //         "Hotelbeds returned 0 hotels.",
  //         "HotelPartnerService",
  //         requestId,
  //       );
  //       throw new NotFoundException(
  //         `No hotels found near airport ${airport.iataCode}`,
  //       );
  //     }

  //     return this.normalizeAvailabilityHotels(rawHotels);
  //   } catch (error: any) {
  //     this.logger.error(
  //       `Error querying Hotelbeds API: ${error.message}`,
  //       "HotelPartnerService",
  //       requestId,
  //       { stack: error.stack },
  //     );
  //     if (
  //       error instanceof NotFoundException ||
  //       error instanceof ServiceUnavailableException
  //     ) {
  //       throw error;
  //     }
  //     throw new ServiceUnavailableException(
  //       `Hotelbeds API query failed: ${error.message}`,
  //     );
  //   }
  // }

  // Actual hotebeds API call with concurrency and retry logic for each occupancy
  // async searchNearbyHotelsWithOccupancies(
  //   airport: {
  //     iataCode: string;
  //     latitude: number;
  //     longitude: number;
  //   },
  //   checkInDate: string,
  //   checkOutDate: string,
  //   occupancies: RoomOccupancy[],
  //   requestId: string,
  //   requestLogger: Logger,
  // ): Promise<AvailabilityHotel[]> {
  //   if (!this.apiKey || !this.secret) {
  //     requestLogger.warn("Hotelbeds credentials not configured.", {
  //       context: "HotelPartnerService",
  //     });

  //     throw new ServiceUnavailableException(
  //       "Hotelbeds API credentials not configured",
  //     );
  //   }

  //   const endpoint = this.useSandbox
  //     ? "https://api.test.hotelbeds.com/hotel-api/1.0/hotels"
  //     : "https://api.hotelbeds.com/hotel-api/1.0/hotels";

  //   if (!occupancies.length) {
  //     requestLogger.warn(
  //       "No occupancies provided for hotel availability search.",
  //       {
  //         context: "HotelPartnerService",
  //       },
  //     );
  //     throw new BadRequestException(
  //       "At least one occupancy is required for hotel availability search",
  //     );
  //   }

  //   const dedupedOccupancies = Array.from(
  //     new Map(
  //       occupancies.map((occupancy) => [
  //         this.occupancyKey(occupancy),
  //         occupancy,
  //       ]),
  //     ).values(),
  //   );

  //   const payloads = dedupedOccupancies.map((occupancy) => {
  //     const childrenCount = Number(occupancy.children ?? 0);
  //     const normalizedAges = (occupancy.childrenAges ?? []).filter(
  //       (age) => Number.isFinite(age) && age > 0,
  //     );
  //     const agesToSend =
  //       childrenCount > 0
  //         ? Array.from(
  //             { length: childrenCount },
  //             (_, index) => normalizedAges[index] ?? 6,
  //           )
  //         : [];

  //     const paxes =
  //       agesToSend.length > 0
  //         ? agesToSend.map((age) => ({ type: "CH", age }))
  //         : undefined;

  //     return {
  //       occupancy,
  //       payload: {
  //         stay: {
  //           checkIn: checkInDate,
  //           checkOut: checkOutDate,
  //         },
  //         occupancies: [
  //           {
  //             rooms: 1,
  //             adults: Number(occupancy.adults),
  //             children: childrenCount,
  //             ...(paxes ? { paxes } : {}),
  //           },
  //         ],
  //         geolocation: {
  //           latitude: Number(airport.latitude),
  //           longitude: Number(airport.longitude),
  //           radius: 20,
  //           unit: "km",
  //         },
  //       },
  //     };
  //   });

  //   requestLogger.info("Fetching hotel availability from Hotelbeds API", {
  //     context: "HotelPartnerService",
  //     airportCode: airport.iataCode,
  //     occupancyCount: dedupedOccupancies.length,
  //     useSandbox: this.useSandbox,
  //   });

  //   try {
  //     const responses = await this.mapWithConcurrency(
  //       payloads,
  //       this.availabilityMaxConcurrency,
  //       (group) =>
  //         this.fetchOccupancyAvailability(endpoint, group, requestLogger),
  //     );

  //     const mergedByHotelCode = new Map<string, any>();
  //     for (const { rawHotels } of responses) {
  //       for (const hotel of rawHotels) {
  //         const key = String(hotel?.code ?? "");
  //         if (!key) {
  //           continue;
  //         }

  //         const existing = mergedByHotelCode.get(key);
  //         if (!existing) {
  //           mergedByHotelCode.set(key, {
  //             ...hotel,
  //             rooms: Array.isArray(hotel.rooms) ? [...hotel.rooms] : [],
  //           });
  //           continue;
  //         }

  //         if (Array.isArray(hotel.rooms) && hotel.rooms.length > 0) {
  //           existing.rooms = [...(existing.rooms ?? []), ...hotel.rooms];
  //         }
  //       }
  //     }

  //     const mergedRawHotels = Array.from(mergedByHotelCode.values());

  //     requestLogger.info(
  //       `Successfully received ${mergedRawHotels.length} merged hotels from Hotelbeds API`,
  //       {
  //         context: "HotelPartnerService",
  //       },
  //     );

  //     if (mergedRawHotels.length === 0) {
  //       throw new NotFoundException(
  //         `No hotels found near airport ${airport.iataCode} for the requested occupancies`,
  //       );
  //     }
  //     requestLogger.info(`Merged raw hotels: ${mergedRawHotels.length}`, {
  //       context: "HotelPartnerService",
  //       mergedRawHotels,
  //     });

  //     return this.normalizeAvailabilityHotels(mergedRawHotels);
  //   } catch (error: any) {
  //     this.logger.error(
  //       `Error querying Hotelbeds API: ${error.message}`,
  //       "HotelPartnerService",
  //       requestId,
  //       { stack: error.stack },
  //     );

  //     if (
  //       error instanceof NotFoundException ||
  //       error instanceof ServiceUnavailableException ||
  //       error instanceof BadRequestException
  //     ) {
  //       throw error;
  //     }

  //     // pass through the real Hotelbeds status/body from fetchOccupancyAvailability
  //     throw new ServiceUnavailableException(error.message);
  //   }
  // }

  // Response from json file — reads cached Hotelbeds responses from disk
  // (hotelbeds-cache/<runId>/<occupancyKey>.json) instead of calling the API.
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
    if (!occupancies.length) {
      requestLogger.warn(
        "No occupancies provided for hotel availability search.",
        {
          context: "HotelPartnerService",
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
        context: "HotelPartnerService",
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
        context: "HotelPartnerService",
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
  ): Promise<HotelCandidate[]> {
    const hotels = await this.searchNearbyHotelsWithOccupancies(
      airport,
      checkInDate,
      checkOutDate,
      [{ adults: 1, children: 0 }],
      requestId,
      this.logger as unknown as Logger,
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

  async checkRate(rateKey: string, requestId: string): Promise<any> {
    if (!this.apiKey || !this.secret) {
      this.logger.warn(
        "Hotelbeds credentials not configured.",
        "HotelPartnerService",
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
        "HotelPartnerService",
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
        "HotelPartnerService",
        requestId,
      );
      return responseData;
    } catch (error: any) {
      this.logger.error(
        `Error calling Hotelbeds CheckRate API: ${error.message}`,
        "HotelPartnerService",
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(
        `Hotelbeds CheckRate API failed: ${error.message}`,
      );
    }
  }

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
        "HotelPartnerService",
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
        "HotelPartnerService",
        requestId,
        { bookingId: bookingData.bookingId },
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
          `Hotelbeds Bookings API returned status ${response.status}: ${errorText}`,
        );
      }

      const responseData = await response.json();
      this.logger.info(
        "Successfully created booking with Hotelbeds",
        "HotelPartnerService",
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
        "HotelPartnerService",
        requestId,
        { stack: error.stack },
      );
      throw new ServiceUnavailableException(
        `Hotelbeds Bookings API failed: ${error.message}`,
      );
    }
  }
}
