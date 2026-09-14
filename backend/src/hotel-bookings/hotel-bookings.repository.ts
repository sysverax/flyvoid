import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { Logger } from "winston";
import { HotelAllocationEntity } from "../cancelled-flights/entities/hotel-allocation.entity";
import { CancelledFlightEntity } from "../cancelled-flights/entities/cancelled-flight.entity";

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
    @InjectRepository(CancelledFlightEntity)
    private readonly cancelledFlightRepo: Repository<CancelledFlightEntity>,
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

  async getHotelBookingsSummary(
    airlineId: number,
    requestLogger: Logger,
  ): Promise<{
    totalCancelFlights: number;
    totalBookings: number;
    totalPassengers: number;
    totalRooms: number;
    totalCost: number;
    totalPlatformFee: number;
  }> {
    requestLogger.debug("Querying hotel bookings summary", {
      context: this.context,
      airlineId,
    });

    // CancelledFlightEntity already carries per-flight running totals
    // (totalBooking/totalAdults/totalChildren/totalHotelRooms/totalPrice/
    // totalPlatformFee), kept up to date as passengers are confirmed and
    // hotels are allocated — so this is a single aggregate over that table,
    // no joins to bookings/hotel_allocations needed.
    const raw = await this.cancelledFlightRepo
      .createQueryBuilder("cancelledFlight")
      .where("cancelledFlight.airlineId = :airlineId", { airlineId })
      .select("COUNT(cancelledFlight.id)", "totalCancelFlights")
      .addSelect("COALESCE(SUM(cancelledFlight.totalBooking), 0)", "totalBookings")
      .addSelect(
        "COALESCE(SUM(cancelledFlight.totalAdults + cancelledFlight.totalChildren), 0)",
        "totalPassengers",
      )
      .addSelect("COALESCE(SUM(cancelledFlight.totalHotelRooms), 0)", "totalRooms")
      .addSelect("COALESCE(SUM(cancelledFlight.totalPrice), 0)", "totalCost")
      .addSelect(
        "COALESCE(SUM(cancelledFlight.totalPlatformFee), 0)",
        "totalPlatformFee",
      )
      .getRawOne<{
        totalCancelFlights: string;
        totalBookings: string;
        totalPassengers: string;
        totalRooms: string;
        totalCost: string;
        totalPlatformFee: string;
      }>();

    requestLogger.debug("Hotel bookings summary query complete", {
      context: this.context,
      airlineId,
    });

    return {
      totalCancelFlights: Number(raw?.totalCancelFlights ?? 0),
      totalBookings: Number(raw?.totalBookings ?? 0),
      totalPassengers: Number(raw?.totalPassengers ?? 0),
      totalRooms: Number(raw?.totalRooms ?? 0),
      totalCost: Number(raw?.totalCost ?? 0),
      totalPlatformFee: Number(raw?.totalPlatformFee ?? 0),
    };
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
