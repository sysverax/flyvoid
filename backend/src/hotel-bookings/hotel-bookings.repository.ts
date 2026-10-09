import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { Logger } from "winston";
import { HotelAllocationEntity } from "../cancelled-flights/entities/hotel-allocation.entity";
import { CancelledFlightEntity } from "../cancelled-flights/entities/cancelled-flight.entity";
import { HotelAllocationStatus } from "../cancelled-flights/entities/enums";

const NOT_BOOKED_STATUSES = [
  HotelAllocationStatus.DRAFT,
  HotelAllocationStatus.FAILED,
];

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
      // Tie-breaker for rows sharing the same createdAt - without it, ties
      // have no guaranteed order and rows can shift between pages.
      .addOrderBy("hotelBooking.id", "DESC")
      .skip(skip)
      .take(filters.limit)
      .where("hotelBooking.status NOT IN (:...notBooked)", {
        notBooked: NOT_BOOKED_STATUSES,
      });

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
            .orWhere(
              "CAST(cancelledFlight.flight_number AS TEXT) ILIKE :search",
              {
                search,
              },
            )
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
    filters: {
      destinationAirportId?: number;
      cancelledFlightId?: number;
      search?: string;
      startDate?: string;
      endDate?: string;
    },
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
    const summaryQb = this.cancelledFlightRepo
      .createQueryBuilder("cancelledFlight")
      .where("cancelledFlight.airlineId = :airlineId", { airlineId });

    if (typeof filters.destinationAirportId === "number") {
      summaryQb.andWhere(
        "cancelledFlight.arrivalAirportId = :destinationAirportId",
        { destinationAirportId: filters.destinationAirportId },
      );
    }

    if (typeof filters.cancelledFlightId === "number") {
      summaryQb.andWhere("cancelledFlight.id = :cancelledFlightId", {
        cancelledFlightId: filters.cancelledFlightId,
      });
    }

    if (filters.startDate || filters.endDate || filters.search?.trim()) {
      const hotelBookingSubquery = summaryQb
        .subQuery()
        .select("1")
        .from(HotelAllocationEntity, "hotelBooking")
        .leftJoin("hotelBooking.booking", "booking")
        .where("hotelBooking.cancelledFlightId = cancelledFlight.id")
        .andWhere(
          `hotelBooking.status NOT IN (${NOT_BOOKED_STATUSES.map((status) => `'${status}'`).join(", ")})`,
        );

      if (filters.startDate) {
        hotelBookingSubquery.andWhere("hotelBooking.checkInDate >= :startDate");
      }

      if (filters.endDate) {
        hotelBookingSubquery.andWhere("hotelBooking.checkInDate <= :endDate");
      }

      if (filters.search?.trim()) {
        const search = `%${filters.search.trim()}%`;
        hotelBookingSubquery.andWhere(
          new Brackets((sub) => {
            sub
              .where("CAST(hotelBooking.id AS TEXT) ILIKE :search")
              .orWhere(
                "CAST(cancelledFlight.flight_number AS TEXT) ILIKE :search",
              )
              .orWhere("hotelBooking.hotel_name ILIKE :search")
              .orWhere("booking.email ILIKE :search");
          }),
        );
      }

      summaryQb.andWhere(`EXISTS ${hotelBookingSubquery.getQuery()}`);
    }

    const raw = await summaryQb
      .select("COUNT(cancelledFlight.id)", "totalCancelFlights")
      .addSelect(
        "COALESCE(SUM(cancelledFlight.totalBooking), 0)",
        "totalBookings",
      )
      .addSelect(
        "COALESCE(SUM(cancelledFlight.totalAdults + cancelledFlight.totalChildren), 0)",
        "totalPassengers",
      )
      .addSelect(
        "COALESCE(SUM(cancelledFlight.totalHotelRooms), 0)",
        "totalRooms",
      )
      // Postgres numeric uniquely allows storing NaN (distinct from NULL),
      // and SUM() propagates it through the whole aggregate - COALESCE
      // alone doesn't catch it, since it only substitutes for NULL. The
      // CASE guards below treat a poisoned row as a 0 contribution instead
      // of silently NaN-ing (and, once serialized to JSON, null-ing) this
      // entire summary.
      .addSelect(
        "COALESCE(SUM(CASE WHEN cancelledFlight.totalPrice = 'NaN' THEN 0 ELSE cancelledFlight.totalPrice END), 0)",
        "totalCost",
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN cancelledFlight.totalPlatformFee = 'NaN' THEN 0 ELSE cancelledFlight.totalPlatformFee END), 0)",
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

    // Second line of defense on top of the SQL-level NaN guards above - a
    // non-finite value here would otherwise serialize to JSON as `null`
    // (JSON.stringify(NaN) === "null"), which is how this bug originally
    // surfaced to API consumers.
    const toFiniteNumber = (value: unknown): number => {
      const num = Number(value ?? 0);
      return Number.isFinite(num) ? num : 0;
    };

    return {
      totalCancelFlights: toFiniteNumber(raw?.totalCancelFlights),
      totalBookings: toFiniteNumber(raw?.totalBookings),
      totalPassengers: toFiniteNumber(raw?.totalPassengers),
      totalRooms: toFiniteNumber(raw?.totalRooms),
      totalCost: toFiniteNumber(raw?.totalCost),
      totalPlatformFee: toFiniteNumber(raw?.totalPlatformFee),
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
        "cancelledFlight.airline",
        "cancelledFlight.departureAirport",
        "cancelledFlight.arrivalAirport",
      ],
    });
  }
}
