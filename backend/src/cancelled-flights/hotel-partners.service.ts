import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as crypto from "node:crypto";
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

  constructor(private readonly logger: LoggerService) {}

  private occupancyKey(occupancy: RoomOccupancy): string {
    const ages = (occupancy.childrenAges ?? []).join("-");
    return `${occupancy.adults}_${occupancy.children}_${ages}`;
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
    if (!this.apiKey || !this.secret) {
      requestLogger.warn("Hotelbeds credentials not configured.", {
        context: "HotelPartnerService",
      });

      throw new ServiceUnavailableException(
        "Hotelbeds API credentials not configured",
      );
    }

    const endpoint = this.useSandbox
      ? "https://api.test.hotelbeds.com/hotel-api/1.0/hotels"
      : "https://api.hotelbeds.com/hotel-api/1.0/hotels";

    const timestamp = Math.floor(Date.now() / 1000);
    const dataToHash = this.apiKey + this.secret + timestamp;

    const signature = crypto
      .createHash("sha256")
      .update(dataToHash)
      .digest("hex");

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

    const payloads = dedupedOccupancies.map((occupancy) => {
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
            radius: 20,
            unit: "km",
          },
        },
      };
    });

    requestLogger.info("Fetching hotel availability from Hotelbeds API", {
      context: "HotelPartnerService",
      airportCode: airport.iataCode,
      occupancyCount: dedupedOccupancies.length,
      useSandbox: this.useSandbox,
    });

    try {
      const responses = await Promise.all(
        payloads.map(async ({ occupancy, payload }) => {
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
              `Hotelbeds API returned status ${response.status} for ${occupancy.adults}A ${occupancy.children}C: ${errorText}`,
            );
          }

          const responseData = await response.json();
          return {
            occupancy,
            rawHotels: responseData?.hotels?.hotels || [],
          };
        }),
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
        `Successfully received ${mergedRawHotels.length} merged hotels from Hotelbeds API`,
        {
          context: "HotelPartnerService",
        },
      );

      if (mergedRawHotels.length === 0) {
        throw new NotFoundException(
          `No hotels found near airport ${airport.iataCode} for the requested occupancies`,
        );
      }
      requestLogger.info(`Merged raw hotels: ${mergedRawHotels.length}`, {
        context: "HotelPartnerService",
        mergedRawHotels,
      });

      return this.normalizeAvailabilityHotels(mergedRawHotels);
    } catch (error: any) {
      this.logger.error(
        `Error querying Hotelbeds API: ${error.message}`,
        "HotelPartnerService",
        requestId,
        { stack: error.stack },
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException(
        `Hotelbeds API query failed: ${error.message}`,
      );
    }
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
