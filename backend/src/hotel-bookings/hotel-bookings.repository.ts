import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { Logger } from "winston";
import { HotelAllocationEntity } from "../cancelled-flights/entities/hotel-allocation.entity";

export interface HotelBookingFilters {
  page: number;
  limit: number;
  destinationAirportId?: number;
  cancelledFlightId?: number;
  search?: string;
  airlineId?: number;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class HotelBookingsRepository {
  private readonly context = "HotelBookingsRepository";

  constructor(
    @InjectRepository(HotelAllocationEntity)
    private readonly allocationRepo: Repository<HotelAllocationEntity>,
  ) {}

  async findHotelBookingsWithPaginationAndFilters(
    filters: HotelBookingFilters,
    requestLogger: Logger,
  ): Promise<{ hotelBookings: HotelAllocationEntity[]; totalCount: number }> {
    requestLogger.debug("Querying hotel bookings with filters", {
      context: this.context,
      filters,
    });

    const skip = (filters.page - 1) * filters.limit;

    const qb = this.allocationRepo
      .createQueryBuilder("hotelBooking")
      .leftJoinAndSelect("hotelBooking.booking", "booking")
      .leftJoinAndSelect("hotelBooking.cancelledFlight", "cancelledFlight")
      .leftJoinAndSelect("cancelledFlight.arrivalAirport", "arrivalAirport")
      .leftJoinAndSelect("cancelledFlight.airline", "airline")
      .orderBy("hotelBooking.createdAt", "DESC")
      .skip(skip)
      .take(filters.limit);

    if (typeof filters.destinationAirportId === "number") {
      qb.andWhere("cancelledFlight.arrivalAirportId = :destinationAirportId", {
        destinationAirportId: filters.destinationAirportId,
      });
    }

    if (typeof filters.cancelledFlightId === "number") {
      qb.andWhere("hotelBooking.cancelledFlightId = :cancelledFlightId", {
        cancelledFlightId: filters.cancelledFlightId,
      });
    }

    if (typeof filters.airlineId === "number") {
      qb.andWhere("cancelledFlight.airlineId = :airlineId", {
        airlineId: filters.airlineId,
      });
    }

    if (filters.startDate) {
      qb.andWhere("hotelBooking.checkInDate >= :startDate", {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      qb.andWhere("hotelBooking.checkInDate <= :endDate", {
        endDate: filters.endDate,
      });
    }

    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where("CAST(hotelBooking.id AS TEXT) ILIKE :search", { search })
            .orWhere("CAST(cancelledFlight.flight_number AS TEXT) ILIKE :search", {
              search,
            })
            .orWhere("hotelBooking.hotel_name ILIKE :search", { search })
            .orWhere("booking.email ILIKE :search", { search });
        }),
      );
    }

    const [hotelBookings, totalCount] = await qb.getManyAndCount();

    requestLogger.debug("Hotel booking query complete", {
      context: this.context,
      totalCount,
    });

    return { hotelBookings, totalCount };
  }

  async findHotelBookingById(
    id: number,
    requestLogger: Logger,
  ): Promise<HotelAllocationEntity | null> {
    requestLogger.debug("Finding hotel booking by id", {
      context: this.context,
      id,
    });

    return this.allocationRepo.findOne({
      where: { id },
      relations: [
        "booking",
        "cancelledFlight",
        "cancelledFlight.departureAirport",
        "cancelledFlight.arrivalAirport",
      ],
    });
  }
}
