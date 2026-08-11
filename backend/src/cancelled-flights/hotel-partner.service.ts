import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import * as crypto from "node:crypto";
import { config } from "../config/config";
import { LoggerService } from "../common/logger/logger.service";

export interface HotelCandidate {
  id: string;
  name: string;
  address: string;
  stars: number;
  amenities: string[];
  pricePerNight: number;
  description: string;
}

@Injectable()
export class HotelPartnerService {
  private readonly apiKey = config.hotelbeds.apiKey;
  private readonly secret = config.hotelbeds.secret;
  private readonly useSandbox = config.hotelbeds.useSandbox;

  constructor(private readonly logger: LoggerService) {}

  async searchNearbyHotels(
    airport: { iataCode: string; latitude: number; longitude: number },
    checkInDate: string,
    checkOutDate: string,
    requestId: string,
  ): Promise<HotelCandidate[]> {
    if (!this.apiKey || !this.secret) {
      this.logger.warn(
        "Hotelbeds credentials not configured.",
        "HotelPartnerService",
        requestId,
      );
      throw new ServiceUnavailableException("Hotelbeds API credentials not configured");
    }

    const endpoint = this.useSandbox
      ? "https://api.test.hotelbeds.com/hotel-api/1.0/hotels"
      : "https://api.hotelbeds.com/hotel-api/1.0/hotels";

    // Generate Hotelbeds X-Signature
    // X-Signature = SHA256(apiKey + secret + timestampInSeconds)
    const timestamp = Math.floor(Date.now() / 1000);
    const dataToHash = this.apiKey + this.secret + timestamp;
    const signature = crypto.createHash("sha256").update(dataToHash).digest("hex");

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
        radius: 20,
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
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hotelbeds API returned status ${response.status}: ${errorText}`);
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
        throw new NotFoundException(`No hotels found near airport ${airport.iataCode}`);
      }

      // Map Hotelbeds response to standard HotelCandidate interface
      const mappedHotels: HotelCandidate[] = rawHotels.slice(0, 10).map((hotel: any) => {
        let stars = 3;
        const catName = hotel.categoryName || "";
        const starMatch = catName.match(/(\d)/);
        if (starMatch) {
          stars = parseInt(starMatch[1], 10);
        }

        const price = hotel.minRate ? parseFloat(hotel.minRate) : 120;

        // Populate amenities logically based on Hotelbeds features and stars
        const amenities = ["WiFi"];
        if (stars >= 4) {
          amenities.push("Business Center", "Elevator", "Wheelchair Accessible");
        }
        if (stars >= 5) {
          amenities.push("Spa", "Swimming Pool", "24-hour Room Service");
        } else {
          amenities.push("Free Shuttle");
        }

        return {
          id: `hb-${hotel.code}`,
          name: hotel.name,
          address: hotel.address || `Near Airport (Zone: ${hotel.zoneName || "Transit"})`,
          stars,
          amenities,
          pricePerNight: price,
          description: `Enjoy a comfortable stay at ${hotel.name}, a quality ${stars}-star hotel located in the ${hotel.zoneName || "airport"} area.`,
        };
      });

      return mappedHotels;
    } catch (error: any) {
      this.logger.error(
        `Error querying Hotelbeds API: ${error.message}`,
        "HotelPartnerService",
        requestId,
        { stack: error.stack },
      );
      if (error instanceof NotFoundException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(`Hotelbeds API query failed: ${error.message}`);
    }
  }
}
