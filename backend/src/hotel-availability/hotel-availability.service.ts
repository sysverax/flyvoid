import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Logger } from "winston";
import { config } from "../config/config";
import { AirportEntity } from "../airline/entities/airport.entity";
import { ProviderEntity } from "../cancelled-flights/entities/provider.entity";
import { HotelContentService } from "../cancelled-flights/hotel-content.service";
import {
  AvailabilityHotel,
  RoomOccupancy,
} from "../cancelled-flights/hotel-providers/hotel-provider.interface";
import { HotelProviderRegistry } from "../cancelled-flights/hotel-providers/hotel-provider.registry";
import { daysBetween, todayIn } from "../cancelled-flights/stay-dates";
import {
  HOTEL_AVAILABILITY_MAX_NIGHTS,
  HotelAvailabilityQueryDto,
} from "./dto/hotel-availability-query.dto";
import { HotelAvailabilityResponseDto } from "./dto/hotel-availability-response.dto";
import {
  compareHotelItems,
  radiusInUnit,
  radiusToKm,
  toHotelItem,
} from "./hotel-availability.mapper";

/**
 * Live supplier availability near an airport, for the admin Hotels page.
 * Read only: nothing is booked, held or stored except hotel static content.
 */
@Injectable()
export class HotelAvailabilityService {
  private readonly context = "HotelAvailabilityService";

  constructor(
    @InjectRepository(ProviderEntity)
    private readonly providerRepository: Repository<ProviderEntity>,
    @InjectRepository(AirportEntity)
    private readonly airportRepository: Repository<AirportEntity>,
    private readonly providerRegistry: HotelProviderRegistry,
    private readonly hotelContentService: HotelContentService,
  ) {}

  async searchAvailability(
    query: HotelAvailabilityQueryDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelAvailabilityResponseDto> {
    const startedAt = Date.now();

    const provider = await this.providerRepository.findOne({
      where: { id: query.providerId },
    });
    if (!provider) {
      throw new NotFoundException(`Hotel provider '${query.providerId}' not found`);
    }
    if (!provider.isActive) {
      throw new BadRequestException(`Hotel provider '${provider.name}' is inactive`);
    }
    const adapter = this.providerRegistry.get(provider.code);
    if (!adapter) {
      throw new BadRequestException(
        `Hotel provider '${provider.name}' has no supplier integration`,
      );
    }
    if (!this.providerRegistry.isConfigured(provider.code)) {
      throw new ServiceUnavailableException(
        `Hotel provider '${provider.name}' credentials are not configured`,
      );
    }

    const airport = await this.airportRepository.findOne({
      where: { id: query.airportId },
    });
    if (!airport) {
      throw new NotFoundException(`Airport '${query.airportId}' not found`);
    }
    if (airport.latitude == null || airport.longitude == null) {
      throw new BadRequestException(
        `Airport ${airport.iataCode} has no coordinates to search around`,
      );
    }

    const { checkInDate, checkOutDate } = query;
    const today = todayIn(airport.timezone);
    if (checkInDate < today) {
      throw new BadRequestException(
        `Check-in date must be today or later (today at ${airport.iataCode} is ${today})`,
      );
    }
    if (checkOutDate <= checkInDate) {
      throw new BadRequestException("Check-out date must be after the check-in date");
    }
    const nights = daysBetween(checkInDate, checkOutDate);
    if (nights > HOTEL_AVAILABILITY_MAX_NIGHTS) {
      throw new BadRequestException(
        `The stay cannot be longer than ${HOTEL_AVAILABILITY_MAX_NIGHTS} nights (${nights} requested)`,
      );
    }

    const rooms: RoomOccupancy[] = query.rooms.map((room) => ({
      adults: room.adults,
      children: room.childrenAges.length,
      childrenAges: room.childrenAges,
    }));
    if (rooms.length > 1 && !adapter.searchMultiRoomOrders) {
      throw new BadRequestException(
        `Hotel provider '${provider.name}' supports one room per search`,
      );
    }

    const unit = config.hotelSearch.unit;
    const radiusKm = query.radius ?? radiusToKm(config.hotelSearch.defaultRadius, unit);
    const residency = query.residency ?? airport.countryCode.toUpperCase();
    const searchAirport = {
      iataCode: airport.iataCode,
      latitude: Number(airport.latitude),
      longitude: Number(airport.longitude),
    };
    const options = {
      residency,
      radius: radiusInUnit(radiusKm, unit),
      includePayAtHotel: true,
    };
    const searchLog = {
      context: this.context,
      provider: provider.code,
      airport: airport.iataCode,
      checkInDate,
      checkOutDate,
      rooms: rooms
        .map((room) => `${room.adults}+${room.childrenAges?.join("/") || 0}`)
        .join(","),
      radiusKm,
      residency,
    };
    requestLogger.info("Searching hotel availability", searchLog);

    let found: AvailabilityHotel[] = [];
    try {
      found =
        rooms.length > 1
          ? await adapter.searchMultiRoomOrders!(
              searchAirport,
              checkInDate,
              checkOutDate,
              [rooms],
              requestId,
              requestLogger,
              options,
            )
          : await adapter.searchNearbyHotelsWithOccupancies(
              searchAirport,
              checkInDate,
              checkOutDate,
              rooms,
              requestId,
              requestLogger,
              options,
            );
    } catch (error) {
      // Suppliers report "nothing in range" as NotFound; that is an empty result here.
      if (!(error instanceof NotFoundException)) throw error;
    }

    const stored = found.length
      ? await this.hotelContentService.ensureHotelContent(
          found.map((hotel) => hotel.hotelCode),
          requestId,
          requestLogger,
          { code: provider.code, adapter },
        )
      : new Map();

    const hotels = found
      // Skip hotels the supplier's content API reports closed or removed.
      .filter((hotel) => stored.get(hotel.hotelCode)?.isActive !== false)
      .map((hotel) =>
        toHotelItem(hotel, stored.get(hotel.hotelCode), airport, nights, provider.code),
      )
      .filter((hotel): hotel is NonNullable<typeof hotel> => !!hotel)
      .sort(compareHotelItems);

    requestLogger.info("Hotel availability found", {
      ...searchLog,
      supplierHotels: found.length,
      hotels: hotels.length,
      durationMs: Date.now() - startedAt,
    });

    return {
      provider: { id: provider.id, code: provider.code, name: provider.name },
      airport: { id: airport.id, code: airport.iataCode, name: airport.name },
      checkInDate,
      checkOutDate,
      nights,
      rooms: query.rooms.map((room) => ({
        adults: room.adults,
        childrenAges: room.childrenAges,
      })),
      radius: radiusKm,
      radiusUnit: "km",
      residency,
      searchedAt: new Date().toISOString(),
      hotels,
    };
  }
}
