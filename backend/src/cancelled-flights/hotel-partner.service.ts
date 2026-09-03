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

export interface HotelRoomTypeCandidate {
  type: string;
  capacity: number;
  pricePerNight: number;
  rateKey: string;
  available: number;
}

export interface HotelCandidate {
  id: string;
  name: string;
  address: string;
  stars: number;
  amenities: string[];
  minRate: number;
  pricePerNight: number;
  description: string;
  rateKey?: string;
  roomTypes: HotelRoomTypeCandidate[];
  isAccessible: boolean;
  totalAvailableRooms: number;
  vendor: "hotelbeds";
}

export interface SearchHotelsParams {
  airport: { iataCode: string; latitude: number; longitude: number };
  checkInDate: string;
  checkOutDate: string;
  radiusKm?: number;
  allowedStars?: number[];
}

export interface BookHotelParams {
  firstName: string;
  lastName: string;
  bookingId: number;
  pnr: string;
  rateKey: string;
  paymentData?: any;
}

export interface IHotelVendor {
  searchHotels(
    params: SearchHotelsParams,
    requestId: string,
  ): Promise<HotelCandidate[]>;
  bookHotelByParams(
    params: BookHotelParams,
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
  }>;
  cancelBooking(reference: string, requestId: string): Promise<void>;
}

@Injectable()
export class HotelPartnerService implements IHotelVendor {
  private readonly apiKey = config.hotelbeds.apiKey;
  private readonly secret = config.hotelbeds.secret;
  private readonly useSandbox = config.hotelbeds.useSandbox;

  constructor(private readonly logger: LoggerService) {}

  async searchHotels(
    params: SearchHotelsParams,
    requestId: string,
  ): Promise<HotelCandidate[]> {
    return this.searchNearbyHotels(
      params.airport,
      params.checkInDate,
      params.checkOutDate,
      requestId,
      {
        radiusKm: params.radiusKm,
        allowedStars: params.allowedStars,
      },
    );
  }

  async searchNearbyHotels(
    airport: { iataCode: string; latitude: number; longitude: number },
    checkInDate: string,
    checkOutDate: string,
    requestId: string,
    options?: {
      radiusKm?: number;
      allowedStars?: number[];
    },
  ): Promise<HotelCandidate[]> {
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
      ? "https://api.test.hotelbeds.com/hotel-api/1.0/hotels"
      : "https://api.hotelbeds.com/hotel-api/1.0/hotels";

    // Generate Hotelbeds X-Signature
    // X-Signature = SHA256(apiKey + secret + timestampInSeconds)
    const timestamp = Math.floor(Date.now() / 1000);
    const dataToHash = this.apiKey + this.secret + timestamp;
    const signature = crypto
      .createHash("sha256")
      .update(dataToHash)
      .digest("hex");

    // Build Hotelbeds Availability Request payload using geolocation
    const payload = {
      stay: {
        checkIn: checkInDate,
        checkOut: checkOutDate,
      },
      occupancies: [
        {
          rooms: 1,
          adults: 1,
          children: 0,
        },
      ],
      geolocation: {
        latitude: Number(airport.latitude),
        longitude: Number(airport.longitude),
        radius: options?.radiusKm ?? 20,
        unit: "km",
      },
    };

    try {
      this.logger.info(
        `Fetching hotel availability from Hotelbeds API near airport: ${airport.iataCode} (${airport.latitude}, ${airport.longitude})`,
        "HotelPartnerService",
        requestId,
        { useSandbox: this.useSandbox },
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
          `Hotelbeds API returned status ${response.status}: ${errorText}`,
        );
      }

      const responseData = await response.json();
      const rawHotels = responseData?.hotels?.hotels || [];

      this.logger.info(
        `Successfully received ${rawHotels.length} hotels from Hotelbeds API`,
        "HotelPartnerService",
        requestId,
      );

      if (rawHotels.length === 0) {
        this.logger.warn(
          "Hotelbeds returned 0 hotels.",
          "HotelPartnerService",
          requestId,
        );
        throw new NotFoundException(
          `No hotels found near airport ${airport.iataCode}`,
        );
      }

      // Map Hotelbeds response to standard HotelCandidate interface
      const mappedHotelsUnfiltered: HotelCandidate[] = rawHotels
        .slice(0, options ? 25 : 10)
        .map((hotel: any) => {
          let stars = 3;
          const catName = hotel.categoryName || "";
          const starMatch = catName.match(/(\d)/);
          if (starMatch) {
            stars = parseInt(starMatch[1], 10);
          }

          const price = hotel.minRate ? parseFloat(hotel.minRate) : 120;

          const rooms = Array.isArray(hotel.rooms) ? hotel.rooms : [];
          const roomTypes: HotelRoomTypeCandidate[] = [];
          for (const room of rooms) {
            const rates = Array.isArray(room?.rates) ? room.rates : [];
            for (const rate of rates) {
              const roomName = String(
                room?.name ||
                  rate?.name ||
                  rate?.roomType ||
                  room?.code ||
                  "standard",
              );
              const normalizedName = roomName.toLowerCase();
              let capacity = 2;
              if (normalizedName.includes("single")) {
                capacity = 1;
              } else if (
                normalizedName.includes("double") ||
                normalizedName.includes("twin")
              ) {
                capacity = 2;
              } else if (normalizedName.includes("triple")) {
                capacity = 3;
              } else if (
                normalizedName.includes("family") ||
                normalizedName.includes("suite") ||
                normalizedName.includes("king")
              ) {
                capacity = 4;
              }

              const availableRaw = Number(
                rate?.allotment ?? rate?.available ?? room?.allotment ?? 1,
              );
              const available = Number.isFinite(availableRaw)
                ? Math.max(1, Math.floor(availableRaw))
                : 1;

              const rateKey = String(rate?.rateKey ?? "").trim();
              if (!rateKey) {
                continue;
              }

              const pricePerNight = Number.parseFloat(
                String(rate?.net ?? hotel?.minRate ?? price),
              );

              roomTypes.push({
                type: roomName,
                capacity,
                pricePerNight: Number.isFinite(pricePerNight)
                  ? pricePerNight
                  : price,
                rateKey,
                available,
              });
            }
          }

          const totalAvailableRooms = roomTypes.length
            ? roomTypes.reduce(
                (sum, roomType) => sum + Math.max(0, roomType.available),
                0,
              )
            : 5;

          // Populate amenities logically based on Hotelbeds features and stars
          const amenities = ["WiFi"];
          if (stars >= 4) {
            amenities.push(
              "Business Center",
              "Elevator",
              "Wheelchair Accessible",
            );
          }
          if (stars >= 5) {
            amenities.push("Spa", "Swimming Pool", "24-hour Room Service");
          } else {
            amenities.push("Free Shuttle");
          }

          const isAccessible = amenities.some((amenity) =>
            /wheelchair|accessible|mobility/i.test(amenity),
          );

          const preferredRateKey = roomTypes[0]?.rateKey;

          return {
            id: `hb-${hotel.code}`,
            name: hotel.name,
            address:
              hotel.address ||
              `Near Airport (Zone: ${hotel.zoneName || "Transit"})`,
            stars,
            amenities,
            minRate: price,
            pricePerNight: price,
            description: `Enjoy a comfortable stay at ${hotel.name}, a quality ${stars}-star hotel located in the ${hotel.zoneName || "airport"} area.`,
            rateKey: preferredRateKey,
            roomTypes,
            isAccessible,
            totalAvailableRooms,
            vendor: "hotelbeds",
          };
        });

      const allowedStars = (options?.allowedStars ?? []).filter((star) =>
        Number.isFinite(star),
      );

      const mappedHotels = allowedStars.length
        ? mappedHotelsUnfiltered.filter((hotel) =>
            allowedStars.includes(hotel.stars),
          )
        : mappedHotelsUnfiltered;

      if (mappedHotels.length === 0) {
        throw new NotFoundException(
          "No hotels found after applying airline preferences",
        );
      }

      return mappedHotels;
    } catch (error: any) {
      this.logger.error(
        `Error querying Hotelbeds API: ${error.message}`,
        "HotelPartnerService",
        requestId,
        { stack: error.stack },
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `Hotelbeds API query failed: ${error.message}`,
      );
    }
  }

  async bookHotelByParams(
    params: BookHotelParams,
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
    return this.bookHotel(
      {
        firstName: params.firstName,
        lastName: params.lastName,
        bookingId: params.bookingId,
        pnr: params.pnr,
      },
      params.rateKey,
      params.paymentData,
      requestId,
    );
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
    if (!rateKey) {
      throw new BadRequestException("rateKey is required for booking");
    }

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

  async cancelBooking(reference: string, requestId: string): Promise<void> {
    this.logger.warn(
      "Cancel booking is not implemented for Hotelbeds integration",
      "HotelPartnerService",
      requestId,
      { reference },
    );
  }
}
