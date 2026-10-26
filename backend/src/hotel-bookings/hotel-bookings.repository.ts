import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Brackets,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from "typeorm";
import { Logger } from "winston";
import { HotelBookingEntity } from "../cancelled-flights/entities/hotel-booking.entity";
import { BookingEntity } from "../cancelled-flights/entities/booking.entity";
import {
  FlightStatus,
  HotelAllocationStatus,
} from "../cancelled-flights/entities/enums";
import { ProviderEntity } from "../cancelled-flights/entities/provider.entity";
import { toUtcTimestampParam } from "../common/utils/date-range.util";
import {
  HotelBookingRecord,
  LIVE_HOTEL_BOOKING_CONDITION,
  toAllocationRecord,
} from "../cancelled-flights/hotel-allocation.record";

/** Flight statuses at which hotel allocation has finished. */
const ALLOCATED_FLIGHT_STATUSES = [
  FlightStatus.ALLOCATED,
  FlightStatus.PAID,
  FlightStatus.PUBLISHED,
];

export interface HotelBookingFilters {
  page: number;
  limit: number;
  destinationAirportId?: number;
  cancelledFlightId?: number;
  search?: string;
  airlineId?: number;
  /** Platform users only. */
  providerId?: number;
  /** Platform users only: the PNR's allocation status. */
  status?: HotelAllocationStatus;
  /** Platform search matches only the booking id and hotel name. */
  searchScope?: "airline" | "platform";
  /** Inclusive lower bound on created_at (a UTC instant). */
  startDate?: Date;
  /** Exclusive upper bound on created_at (a UTC instant). */
  endDate?: Date;
}

/** A listed hotel booking with its provider and hotel id (platform view). */
export type HotelBookingListRow = HotelBookingRecord & {
  provider: ProviderEntity | null;
  hotelId: number | null;
};

/** Platform summary filters (the admin list filters, without status). */
export interface AdminHotelBookingsSummaryFilters {
  airlineId?: number;
  providerId?: number;
  search?: string;
  /** Inclusive lower bound on created_at (a UTC instant). */
  startDate?: Date;
  /** Exclusive upper bound on created_at (a UTC instant). */
  endDate?: Date;
}

export interface HotelBookingsSummaryFilters {
  destinationAirportId?: number;
  cancelledFlightId?: number;
  search?: string;
  /** Inclusive lower bound on created_at (a UTC instant). */
  startDate?: Date;
  /** Exclusive upper bound on created_at (a UTC instant). */
  endDate?: Date;
}

@Injectable()
export class HotelBookingsRepository {
  private readonly context = "HotelBookingsRepository";

  constructor(
    @InjectRepository(HotelBookingEntity)
    private readonly hotelBookingRepo: Repository<HotelBookingEntity>,
  ) {}

  async findHotelBookingsWithPaginationAndFilters(
    filters: HotelBookingFilters,
    requestLogger: Logger,
  ): Promise<{ hotelBookings: HotelBookingListRow[]; totalCount: number }> {
    requestLogger.debug("Querying hotel bookings with filters", {
      context: this.context,
      filters,
    });

    const skip = (filters.page - 1) * filters.limit;

    const qb = this.hotelBookingRepo
      .createQueryBuilder("hotelBooking")
      .innerJoinAndSelect("hotelBooking.booking", "booking")
      .leftJoinAndSelect("hotelBooking.provider", "provider")
      .leftJoinAndSelect("hotelBooking.hotel", "hotel")
      .leftJoinAndSelect("hotelBooking.rooms", "room")
      .leftJoinAndSelect("hotelBooking.candidate", "candidate")
      .leftJoinAndSelect("hotelBooking.cancelledFlight", "cancelledFlight")
      .leftJoinAndSelect("cancelledFlight.arrivalAirport", "arrivalAirport")
      .leftJoinAndSelect("cancelledFlight.airline", "airline")
      .orderBy("hotelBooking.createdAt", "DESC")
      // Tie-breaker for rows sharing the same createdAt - without it, ties
      // have no guaranteed order and rows can shift between pages.
      .addOrderBy("hotelBooking.id", "DESC")
      .skip(skip)
      .take(filters.limit)
      .where(LIVE_HOTEL_BOOKING_CONDITION);

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

    if (typeof filters.providerId === "number") {
      qb.andWhere("hotelBooking.providerId = :providerId", {
        providerId: filters.providerId,
      });
    }

    if (filters.status) {
      qb.andWhere("booking.allocationStatus = :status", {
        status: filters.status,
      });
    }

    // Half-open range on a UTC timestamp column: start inclusive, end exclusive.
    if (filters.startDate) {
      qb.andWhere("hotelBooking.createdAt >= :startDate", {
        startDate: toUtcTimestampParam(filters.startDate),
      });
    }

    if (filters.endDate) {
      qb.andWhere("hotelBooking.createdAt < :endDate", {
        endDate: toUtcTimestampParam(filters.endDate),
      });
    }

    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      const platform = filters.searchScope === "platform";
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where("CAST(hotelBooking.id AS TEXT) ILIKE :search", { search })
            .orWhere("hotel.name ILIKE :search", { search });
          if (!platform) {
            sub
              .orWhere(
                "CAST(cancelledFlight.flight_number AS TEXT) ILIKE :search",
                { search },
              )
              .orWhere("booking.email ILIKE :search", { search });
          }
        }),
      );
    }

    const [rows, totalCount] = await qb.getManyAndCount();
    const hotelBookings = rows.map((row) => ({
      ...(toAllocationRecord(row.booking, row) as HotelBookingRecord),
      provider: row.provider ?? null,
      hotelId: row.hotel?.id ?? null,
    }));

    requestLogger.debug("Hotel booking query complete", {
      context: this.context,
      totalCount,
    });

    return { hotelBookings, totalCount };
  }

  async getHotelBookingsSummary(
    airlineId: number,
    filters: HotelBookingsSummaryFilters,
    requestLogger: Logger,
  ): Promise<{
    totalBookings: number;
    totalPassengers: number;
    totalRooms: number;
    totalCost: number;
    totalPlatformFee: number;
    totalPnrs: number;
    totalAllocatedPnrs: number;
  }> {
    requestLogger.debug("Querying hotel bookings summary", {
      context: this.context,
      airlineId,
      filters,
    });

    // Hotel totals come from the same live hotel bookings (and filters) as
    // the bookings list, so the summary cards always match the table.
    // Postgres numeric uniquely allows storing NaN (distinct from NULL), and
    // SUM() propagates it through the whole aggregate - COALESCE alone
    // doesn't catch it, so the CASE guards treat a poisoned row as 0.
    // A PNR has at most one non-failed hotel booking (uq_hotel_bookings_one_active),
    // so summing passengers per hotel booking counts each PNR once.
    const hotelTotalsQuery = this.applyLiveHotelBookingFilters(
      this.hotelBookingRepo.createQueryBuilder("hotelBooking"),
      airlineId,
      filters,
    )
      .select("COUNT(hotelBooking.id)", "totalBookings")
      .addSelect(
        "COALESCE(SUM(booking.adults + booking.children), 0)",
        "totalPassengers",
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN hotelBooking.totalPrice = 'NaN' THEN 0 ELSE hotelBooking.totalPrice END), 0)",
        "totalCost",
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN hotelBooking.platformFee = 'NaN' THEN 0 ELSE hotelBooking.platformFee END), 0)",
        "totalPlatformFee",
      )
      .getRawOne<{
        totalBookings: string;
        totalPassengers: string;
        totalCost: string;
        totalPlatformFee: string;
      }>();

    // Rooms are counted in their own query - joining them into the totals
    // query above would repeat each hotel booking's price once per room.
    // Failed rooms are excluded, as in the bookings list.
    const roomsQuery = this.applyLiveHotelBookingFilters(
      this.hotelBookingRepo.createQueryBuilder("hotelBooking"),
      airlineId,
      filters,
    )
      .innerJoin("hotelBooking.rooms", "room", "room.status <> 'failed'")
      .select("COUNT(room.id)", "totalRooms")
      .getRawOne<{ totalRooms: string }>();

    // PNR counts are not narrowed by search or the created date range - those only
    // apply to hotel bookings, and would otherwise drop PNRs with no hotel.
    const pnrQb = this.hotelBookingRepo.manager
      .createQueryBuilder(BookingEntity, "booking")
      .innerJoin("booking.cancelledFlight", "cancelledFlight")
      .where("cancelledFlight.airlineId = :airlineId", { airlineId });

    if (typeof filters.destinationAirportId === "number") {
      pnrQb.andWhere("cancelledFlight.arrivalAirportId = :destinationAirportId", {
        destinationAirportId: filters.destinationAirportId,
      });
    }

    if (typeof filters.cancelledFlightId === "number") {
      pnrQb.andWhere("cancelledFlight.id = :cancelledFlightId", {
        cancelledFlightId: filters.cancelledFlightId,
      });
    }

    const pnrQuery = pnrQb
      .select("COUNT(booking.id)", "totalPnrs")
      .addSelect(
        "COALESCE(SUM(CASE WHEN cancelledFlight.status IN (:...allocatedStatuses) THEN 1 ELSE 0 END), 0)",
        "totalAllocatedPnrs",
      )
      .setParameter("allocatedStatuses", ALLOCATED_FLIGHT_STATUSES)
      .getRawOne<{ totalPnrs: string; totalAllocatedPnrs: string }>();

    const [hotelTotals, rooms, pnrs] = await Promise.all([
      hotelTotalsQuery,
      roomsQuery,
      pnrQuery,
    ]);

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
      totalBookings: toFiniteNumber(hotelTotals?.totalBookings),
      totalPassengers: toFiniteNumber(hotelTotals?.totalPassengers),
      totalRooms: toFiniteNumber(rooms?.totalRooms),
      totalCost: toFiniteNumber(hotelTotals?.totalCost),
      totalPlatformFee: toFiniteNumber(hotelTotals?.totalPlatformFee),
      totalPnrs: toFiniteNumber(pnrs?.totalPnrs),
      totalAllocatedPnrs: toFiniteNumber(pnrs?.totalAllocatedPnrs),
    };
  }

  /**
   * Narrows a query on `hotelBooking` to the airline's live hotel bookings
   * with the bookings list's filters (destination, flight, created date
   * range, search). Joins `booking`, `cancelledFlight` and `hotel`.
   */
  /**
   * Platform summary: totals of CONFIRMED hotel bookings only (booked with the
   * supplier and charged) matching the admin list filters. The status filter
   * is not applied: in-progress and manual-check bookings are not real money yet.
   */
  async getAdminHotelBookingsSummary(
    filters: AdminHotelBookingsSummaryFilters,
    requestLogger: Logger,
  ): Promise<{
    totalBookings: number;
    totalPassengers: number;
    totalRooms: number;
    totalCost: number;
    totalPlatformFee: number;
    totalSupplierMargin: number;
    totalPaidToHotels: number;
  }> {
    requestLogger.debug("Querying admin hotel bookings summary", {
      context: this.context,
      filters,
    });

    // NaN-safe money column (see getHotelBookingsSummary).
    const money = (column: string) =>
      `CASE WHEN ${column} = 'NaN' THEN 0 ELSE ${column} END`;

    const totalsQuery = this.applyAdminSummaryFilters(
      this.hotelBookingRepo.createQueryBuilder("hotelBooking"),
      filters,
    )
      .select("COUNT(hotelBooking.id)", "totalBookings")
      .addSelect(
        "COALESCE(SUM(booking.adults + booking.children), 0)",
        "totalPassengers",
      )
      .addSelect(`COALESCE(SUM(${money("hotelBooking.totalPrice")}), 0)`, "totalCost")
      .addSelect(
        `COALESCE(SUM(${money("hotelBooking.platformFee")}), 0)`,
        "totalPlatformFee",
      )
      .addSelect(
        `COALESCE(SUM(${money("hotelBooking.actualPrice")} - ${money("hotelBooking.buyingPrice")}), 0)`,
        "totalSupplierMargin",
      )
      .addSelect(
        `COALESCE(SUM(${money("hotelBooking.buyingPrice")}), 0)`,
        "totalPaidToHotels",
      )
      .getRawOne<Record<string, string>>();

    // Rooms in their own query, so prices are not repeated once per room.
    const roomsQuery = this.applyAdminSummaryFilters(
      this.hotelBookingRepo.createQueryBuilder("hotelBooking"),
      filters,
    )
      .innerJoin("hotelBooking.rooms", "room", "room.status <> 'failed'")
      .select("COUNT(room.id)", "totalRooms")
      .getRawOne<{ totalRooms: string }>();

    const [totals, rooms] = await Promise.all([totalsQuery, roomsQuery]);
    const round = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
    return {
      totalBookings: Number(totals?.totalBookings ?? 0),
      totalPassengers: Number(totals?.totalPassengers ?? 0),
      totalRooms: Number(rooms?.totalRooms ?? 0),
      totalCost: round(totals?.totalCost),
      totalPlatformFee: round(totals?.totalPlatformFee),
      totalSupplierMargin: round(totals?.totalSupplierMargin),
      totalPaidToHotels: round(totals?.totalPaidToHotels),
    };
  }

  private applyAdminSummaryFilters<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    filters: AdminHotelBookingsSummaryFilters,
  ): SelectQueryBuilder<T> {
    qb.innerJoin("hotelBooking.booking", "booking")
      .innerJoin("hotelBooking.cancelledFlight", "cancelledFlight")
      .leftJoin("hotelBooking.hotel", "hotel")
      .where(LIVE_HOTEL_BOOKING_CONDITION)
      .andWhere("booking.allocationStatus = :confirmed", {
        confirmed: HotelAllocationStatus.CONFIRMED,
      });

    if (typeof filters.airlineId === "number") {
      qb.andWhere("cancelledFlight.airlineId = :airlineId", {
        airlineId: filters.airlineId,
      });
    }

    if (typeof filters.providerId === "number") {
      qb.andWhere("hotelBooking.providerId = :providerId", {
        providerId: filters.providerId,
      });
    }

    // Half-open range on a UTC timestamp column: start inclusive, end exclusive.
    if (filters.startDate) {
      qb.andWhere("hotelBooking.createdAt >= :startDate", {
        startDate: toUtcTimestampParam(filters.startDate),
      });
    }

    if (filters.endDate) {
      qb.andWhere("hotelBooking.createdAt < :endDate", {
        endDate: toUtcTimestampParam(filters.endDate),
      });
    }

    // Same search as the admin list: hotel booking id or hotel name.
    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where("CAST(hotelBooking.id AS TEXT) ILIKE :search", { search })
            .orWhere("hotel.name ILIKE :search", { search });
        }),
      );
    }

    return qb;
  }

  private applyLiveHotelBookingFilters<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    airlineId: number,
    filters: HotelBookingsSummaryFilters,
  ): SelectQueryBuilder<T> {
    qb.innerJoin("hotelBooking.booking", "booking")
      .innerJoin("hotelBooking.cancelledFlight", "cancelledFlight")
      .leftJoin("hotelBooking.hotel", "hotel")
      .where(LIVE_HOTEL_BOOKING_CONDITION)
      .andWhere("cancelledFlight.airlineId = :airlineId", { airlineId });

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

    // Half-open range on a UTC timestamp column: start inclusive, end exclusive.
    if (filters.startDate) {
      qb.andWhere("hotelBooking.createdAt >= :startDate", {
        startDate: toUtcTimestampParam(filters.startDate),
      });
    }

    if (filters.endDate) {
      qb.andWhere("hotelBooking.createdAt < :endDate", {
        endDate: toUtcTimestampParam(filters.endDate),
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
              { search },
            )
            .orWhere("hotel.name ILIKE :search", { search })
            .orWhere("booking.email ILIKE :search", { search });
        }),
      );
    }

    return qb;
  }

  async findHotelBookingById(
    id: number,
    requestLogger: Logger,
  ): Promise<HotelBookingRecord | null> {
    requestLogger.debug("Finding hotel booking by id", {
      context: this.context,
      id,
    });

    const hotelBooking = await this.hotelBookingRepo.findOne({
      where: { id },
      relations: {
        booking: true,
        hotel: true,
        rooms: true,
        candidate: true,
        cancelledFlight: {
          airline: true,
          departureAirport: true,
          arrivalAirport: true,
        },
      },
    });
    return hotelBooking
      ? (toAllocationRecord(
          hotelBooking.booking,
          hotelBooking,
        ) as HotelBookingRecord)
      : null;
  }
}
