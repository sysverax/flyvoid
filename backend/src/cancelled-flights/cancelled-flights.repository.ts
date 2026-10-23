import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  EntityManager,
  In,
  IsNull,
  Not,
  Repository,
  SelectQueryBuilder,
} from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { config } from "../config/config";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { BookingEntity } from "./entities/booking.entity";
import {
  FlightStatus,
  HotelAllocationStatus,
  HotelBookingAttemptStatus,
  HotelBookingFailureCode,
} from "./entities/enums";
import { HotelBookingEntity } from "./entities/hotel-booking.entity";
import { HotelBookingRoomEntity } from "./entities/hotel-booking-room.entity";
import { HotelEntity } from "./entities/hotel.entity";
import { ProviderEntity } from "./entities/provider.entity";
import { SupplierWebhookTokenEntity } from "./entities/supplier-webhook-token.entity";
import {
  CandidateRoomPlan,
  HotelAllocationOptionEntity,
} from "./entities/hotel-allocation-option.entity";
import { resolveEffectiveAttempt } from "./hotel-allocation.planner";
import {
  AllocationSuccess,
  HotelAllocationRecord,
  HotelBookingRecord,
  LIVE_HOTEL_BOOKING_CONDITION,
  ProviderOrder,
  bookingReferenceOf,
  starsLabel,
  toAllocationRecord,
} from "./hotel-allocation.record";
import { Logger } from "winston";
import type { PnrBookingStatus } from "./dto/hotel-allocations.dto";
import type { HotelStaticContent } from "./hotel-providers/hotel-provider.interface";

/** A planned candidate hotel with its hotel details resolved. */
export type HotelCandidate = HotelAllocationOptionEntity & {
  hotelCode: string;
  hotelName: string;
  category: string;
  stars: number;
};

export interface PlannedCandidateInput {
  hotelCode: string;
  hotelName: string;
  category: string;
  stars: number;
  tier: "pool" | "overflow";
  estimatedPrice: number;
  currency: string | null;
  rooms: CandidateRoomPlan[];
}

/** Star rating from a category label such as "4 STARS"; null when it has none. */
const starsFromCategory = (category?: string | null): number | null => {
  const stars = Number(/\d+/.exec(category ?? "")?.[0]);
  return Number.isFinite(stars) && stars > 0 ? stars : null;
};

/** Statuses whose PNR shows the hotel of its live (non-failed) booking. */
const SHOWS_BOOKING = new Set<HotelAllocationStatus>([
  HotelAllocationStatus.CONFIRMED,
  HotelAllocationStatus.COMPLETED,
  HotelAllocationStatus.CANCELLED,
  HotelAllocationStatus.IN_PROGRESS,
  HotelAllocationStatus.MANUAL_CHECK,
]);

export function isRebookableAllocation(
  row?: Pick<HotelAllocationRecord, "status" | "bookingReference"> | null,
): boolean {
  if (!row) {
    return true;
  }
  if (
    row.status === HotelAllocationStatus.CONFIRMED &&
    row.bookingReference?.startsWith("temp-")
  ) {
    return true;
  }
  return [
    HotelAllocationStatus.DRAFT,
    HotelAllocationStatus.FAILED,
    HotelAllocationStatus.CANCELLED,
  ].includes(row.status);
}

interface AllocationState {
  allocationStatus: HotelAllocationStatus;
  allocationReason: string | null;
  confirmedHotelBookingId: number | null;
}

/** The PNR allocation state its booking attempts imply, or null when unchanged. */
function effectiveAllocationState(
  current: HotelAllocationStatus,
  attempts: Array<
    Pick<
      HotelBookingEntity,
      "id" | "status" | "attemptOrder" | "hotel" | "failureReason"
    >
  >,
  successReason?: string | null,
): AllocationState | null {
  const effective = resolveEffectiveAttempt(attempts);
  if (effective?.status === HotelBookingAttemptStatus.SUCCESS) {
    return successReason !== undefined
      ? {
          allocationStatus: HotelAllocationStatus.CONFIRMED,
          allocationReason: successReason,
          confirmedHotelBookingId: effective.id,
        }
      : null;
  }
  if (effective?.status === HotelBookingAttemptStatus.MANUAL_CHECK) {
    return {
      allocationStatus: HotelAllocationStatus.MANUAL_CHECK,
      allocationReason:
        effective.failureReason ?? "Booking requires manual check",
      confirmedHotelBookingId: null,
    };
  }
  if (effective?.status === HotelBookingAttemptStatus.PENDING) {
    return {
      allocationStatus: HotelAllocationStatus.IN_PROGRESS,
      allocationReason: effective.hotel?.name
        ? `Booking in progress at ${effective.hotel.name}`
        : "Booking in progress",
      confirmedHotelBookingId: null,
    };
  }
  if (
    current === HotelAllocationStatus.IN_PROGRESS ||
    current === HotelAllocationStatus.MANUAL_CHECK
  ) {
    const latest = [...attempts].sort(
      (a, b) => b.attemptOrder - a.attemptOrder,
    )[0];
    return {
      allocationStatus: HotelAllocationStatus.DRAFT,
      allocationReason: latest?.failureReason ?? null,
      confirmedHotelBookingId: null,
    };
  }
  return null;
}

export interface FlightHotelTotals {
  totalActualPrice: number;
  totalBuyingPrice: number;
  totalSellingPrice: number;
  totalDiscounts: number;
  totalHotelTaxes: number;
  totalPlatformFee: number;
  totalPrice: number;
  totalEarnings: number;
  totalHotelRooms: number;
  confirmedCount: number;
}

export function sumHotelTotals(
  rows: Array<
    Pick<
      HotelAllocationRecord,
      | "actualPrice"
      | "buyingPrice"
      | "sellingPrice"
      | "discount"
      | "tax"
      | "platformFee"
      | "totalPrice"
      | "earnings"
      | "totalRooms"
    >
  >,
): FlightHotelTotals {
  const sum = (pick: (row: (typeof rows)[number]) => unknown): number => {
    const total = rows.reduce((acc, row) => {
      const value = Number(pick(row) ?? 0);
      return acc + (Number.isFinite(value) ? value : 0);
    }, 0);
    return Math.round((total + Number.EPSILON) * 100) / 100;
  };
  return {
    totalActualPrice: sum((row) => row.actualPrice),
    totalBuyingPrice: sum((row) => row.buyingPrice),
    totalSellingPrice: sum((row) => row.sellingPrice),
    totalDiscounts: sum((row) => row.discount),
    totalHotelTaxes: sum((row) => row.tax),
    totalPlatformFee: sum((row) => row.platformFee),
    totalPrice: sum((row) => row.totalPrice),
    totalEarnings: sum((row) => row.earnings),
    totalHotelRooms: sum((row) => row.totalRooms),
    confirmedCount: rows.length,
  };
}

@Injectable()
export class CancelledFlightsRepository {
  private readonly context = "CancelledFlightsRepository";

  constructor(
    @InjectRepository(CancelledFlightEntity)
    private readonly flightRepo: Repository<CancelledFlightEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepo: Repository<BookingEntity>,
  ) {}

  // ── CancelledFlight ──────────────────────────────────────────────────────

  async createFlight(
    payload: Partial<CancelledFlightEntity>,
    requestLogger: Logger,
  ): Promise<CancelledFlightEntity> {
    requestLogger.info("Creating cancelled flight", {
      context: this.context,
      flightNumber: payload.flightNumber,
    });
    const entity = this.flightRepo.create(payload);
    return this.flightRepo.save(entity);
  }

  async findFlightById(
    id: number,
    requestLogger: Logger,
  ): Promise<CancelledFlightEntity | null> {
    requestLogger.info("Finding cancelled flight by id", {
      context: this.context,
      id,
    });
    return this.flightRepo.findOne({ where: { id } });
  }

  async findFlightWithRelations(
    id: number,
    requestLogger: Logger,
  ): Promise<CancelledFlightEntity | null> {
    requestLogger.info("Finding cancelled flight with relations", {
      context: this.context,
      id,
    });
    return this.flightRepo.findOne({
      where: { id },
      relations: ["airline", "departureAirport", "arrivalAirport"],
    });
  }

  async updateFlightEntity(
    entity: CancelledFlightEntity,
    requestLogger: Logger,
  ): Promise<CancelledFlightEntity> {
    requestLogger.info("Updating cancelled flight", {
      context: this.context,
      id: entity.id,
    });
    return this.flightRepo.save(entity);
  }

  async findFlightsWithPaginationAndFilters(
    {
      page,
      limit,
      status,
      search,
      airlineId,
      startDate,
      endDate,
    }: {
      page: number;
      limit: number;
      status?: FlightStatus;
      search?: string;
      airlineId?: number;
      startDate?: string;
      endDate?: string;
    },
    requestLogger: Logger,
  ): Promise<{ flights: CancelledFlightEntity[]; totalCount: number }> {
    requestLogger.info(
      "Finding cancelled flights with pagination and filters",
      {
        context: this.context,
        page,
        limit,
        status,
        search,
        airlineId,
        startDate,
        endDate,
      },
    );

    const skip = (page - 1) * limit;

    const qb = this.flightRepo
      .createQueryBuilder("flight")
      .leftJoinAndSelect("flight.departureAirport", "departureAirport")
      .leftJoinAndSelect("flight.arrivalAirport", "arrivalAirport")
      // Only id and name are needed for the platform response; avoid loading
      // the whole airline row.
      .leftJoin("flight.airline", "airline")
      .addSelect(["airline.id", "airline.name"])
      .orderBy("flight.createdAt", "DESC")
      // Tie-breaker for rows sharing the same createdAt - without it, ties
      // have no guaranteed order and rows can shift between pages.
      .addOrderBy("flight.id", "DESC")
      .skip(skip)
      .take(limit);

    if (typeof airlineId === "number") {
      qb.andWhere("flight.airlineId = :airlineId", { airlineId });
    }

    this.applyListStatusFilter(qb, status);

    if (search?.trim()) {
      qb.andWhere("CAST(flight.flight_number AS TEXT) ILIKE :search", {
        search: `%${search.trim()}%`,
      });
    }

    if (startDate) {
      qb.andWhere("flight.cancellationDate >= :startDate", { startDate });
    }

    if (endDate) {
      qb.andWhere("flight.cancellationDate <= :endDate", { endDate });
    }

    const [flights, totalCount] = await qb.getManyAndCount();
    return { flights, totalCount };
  }

  /**
   * List status filter. A flight awaiting allocation that already has hotel
   * booking attempts is listed as HOTEL_ALLOCATION_IN_PROGRESS, not as
   * PASSENGERS_BOOKING_CONFIRMED (see findFlightIdsWithHotelBookings).
   */
  private applyListStatusFilter(
    qb: SelectQueryBuilder<CancelledFlightEntity>,
    status?: FlightStatus,
  ): void {
    if (!status) return;
    const started =
      "EXISTS (SELECT 1 FROM hotel_bookings hb WHERE hb.cancelled_flight_id = flight.id)";
    const params = {
      listStatus: status,
      awaitingStatus: FlightStatus.PASSENGERS_BOOKING_CONFIRMED,
    };
    if (status === FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS) {
      qb.andWhere(
        `(flight.status = :listStatus OR (flight.status = :awaitingStatus AND ${started}))`,
        params,
      );
    } else if (status === FlightStatus.PASSENGERS_BOOKING_CONFIRMED) {
      qb.andWhere(`flight.status = :listStatus AND NOT ${started}`, params);
    } else {
      qb.andWhere("flight.status = :listStatus", params);
    }
  }

  /** Flights (of these ids) that have at least one hotel booking attempt. */
  async findFlightIdsWithHotelBookings(
    cancelledFlightIds: number[],
  ): Promise<Set<number>> {
    if (cancelledFlightIds.length === 0) return new Set();
    const rows: Array<{ id: number }> = await this.manager.query(
      `SELECT DISTINCT cancelled_flight_id AS "id"
         FROM hotel_bookings
        WHERE cancelled_flight_id = ANY($1)`,
      [cancelledFlightIds],
    );
    return new Set(rows.map((row) => Number(row.id)));
  }

  async getCancelledFlightsSummary(
    {
      status,
      search,
      airlineId,
      startDate,
      endDate,
    }: {
      status?: FlightStatus;
      search?: string;
      airlineId?: number;
      startDate?: string;
      endDate?: string;
    },
    requestLogger: Logger,
  ): Promise<{
    totalCancelFlights: number;
    totalAdults: number;
    totalChildren: number;
    totalBookings: number;
    totalHotelBookings: number;
    totalRooms: number;
    totalHotelCost: number;
    totalHotelTax: number;
    totalDiscount: number;
    totalCost: number;
    totalPlatformFee: number;
  }> {
    requestLogger.debug("Querying cancelled flights summary", {
      context: this.context,
      status,
      search,
      airlineId,
      startDate,
      endDate,
    });

    const qb = this.flightRepo.createQueryBuilder("flight");

    if (typeof airlineId === "number") {
      qb.andWhere("flight.airlineId = :airlineId", { airlineId });
    }

    this.applyListStatusFilter(qb, status);

    if (search?.trim()) {
      qb.andWhere("CAST(flight.flight_number AS TEXT) ILIKE :search", {
        search: `%${search.trim()}%`,
      });
    }

    if (startDate) {
      qb.andWhere("flight.cancellationDate >= :startDate", { startDate });
    }

    if (endDate) {
      qb.andWhere("flight.cancellationDate <= :endDate", { endDate });
    }

    // Postgres numeric uniquely allows storing NaN (distinct from NULL), and
    // SUM() propagates it through the whole aggregate - COALESCE alone
    // doesn't catch it, since it only substitutes for NULL. The CASE guards
    // below treat a poisoned row as a 0 contribution instead of silently
    // NaN-ing (and, once serialized to JSON, null-ing) this entire summary.
    const sumMoney = (column: string) =>
      `COALESCE(SUM(CASE WHEN ${column} = 'NaN' THEN 0 ELSE ${column} END), 0)`;

    // Live hotel bookings per flight - the same rows as the hotel bookings
    // list. totalBookings, by contrast, counts every PNR on the flight.
    const hotelBookingsPerFlight = qb
      .subQuery()
      .select("COUNT(hotelBooking.id)")
      .from(HotelBookingEntity, "hotelBooking")
      .innerJoin("hotelBooking.booking", "booking")
      .where("hotelBooking.cancelledFlightId = flight.id")
      .andWhere(LIVE_HOTEL_BOOKING_CONDITION)
      .getQuery();

    const raw = await qb
      .select("COUNT(flight.id)", "totalCancelFlights")
      .addSelect("COALESCE(SUM(flight.totalAdults), 0)", "totalAdults")
      .addSelect("COALESCE(SUM(flight.totalChildren), 0)", "totalChildren")
      .addSelect("COALESCE(SUM(flight.totalBooking), 0)", "totalBookings")
      .addSelect(
        `COALESCE(SUM(${hotelBookingsPerFlight}), 0)`,
        "totalHotelBookings",
      )
      .addSelect("COALESCE(SUM(flight.totalHotelRooms), 0)", "totalRooms")
      .addSelect(sumMoney("flight.totalSellingPrice"), "totalHotelCost")
      .addSelect(sumMoney("flight.totalHotelTaxes"), "totalHotelTax")
      .addSelect(sumMoney("flight.totalDiscounts"), "totalDiscount")
      .addSelect(sumMoney("flight.totalPrice"), "totalCost")
      .addSelect(sumMoney("flight.totalPlatformFee"), "totalPlatformFee")
      .getRawOne<{
        totalCancelFlights: string;
        totalAdults: string;
        totalChildren: string;
        totalBookings: string;
        totalHotelBookings: string;
        totalRooms: string;
        totalHotelCost: string;
        totalHotelTax: string;
        totalDiscount: string;
        totalCost: string;
        totalPlatformFee: string;
      }>();

    requestLogger.debug("Cancelled flights summary query complete", {
      context: this.context,
    });

    // Second line of defense on top of the SQL-level NaN guards above - a
    // non-finite value here would otherwise serialize to JSON as `null`.
    const toFiniteNumber = (value: unknown): number => {
      const num = Number(value ?? 0);
      return Number.isFinite(num) ? num : 0;
    };

    return {
      totalCancelFlights: toFiniteNumber(raw?.totalCancelFlights),
      totalAdults: toFiniteNumber(raw?.totalAdults),
      totalChildren: toFiniteNumber(raw?.totalChildren),
      totalBookings: toFiniteNumber(raw?.totalBookings),
      totalHotelBookings: toFiniteNumber(raw?.totalHotelBookings),
      totalRooms: toFiniteNumber(raw?.totalRooms),
      totalHotelCost: toFiniteNumber(raw?.totalHotelCost),
      totalHotelTax: toFiniteNumber(raw?.totalHotelTax),
      totalDiscount: toFiniteNumber(raw?.totalDiscount),
      totalCost: toFiniteNumber(raw?.totalCost),
      totalPlatformFee: toFiniteNumber(raw?.totalPlatformFee),
    };
  }

  async updateFlightStatus({
    cancelledFlightEntity,
    status,
    passengerBookingStats,
    hotelBookingStats,
    requestLogger,
  }: {
    cancelledFlightEntity: CancelledFlightEntity;
    status: FlightStatus;
    passengerBookingStats: {
      totalBookings: number | null;
      totalAdults: number | null;
      totalChildren: number | null;
    } | null;
    hotelBookingStats: {
      totalHotelRooms: number | null;
      totalPrice: number | null;
      totalBuyingPrice: number | null;
      totalSellingPrice: number | null;
      totalDiscounts: number | null;
      totalHotelTaxes: number | null;
      totalPlatformFee: number | null;
      totalEarnings: number | null;
    } | null;
    requestLogger: Logger;
  }): Promise<CancelledFlightEntity> {
    requestLogger.info("Updating cancelled flight status", {
      context: this.context,
      flightId: cancelledFlightEntity.id,
      status,
    });

    cancelledFlightEntity.status = status;
    if (passengerBookingStats && passengerBookingStats.totalBookings !== null) {
      cancelledFlightEntity.totalBooking = passengerBookingStats.totalBookings;
    }
    if (passengerBookingStats && passengerBookingStats.totalAdults !== null) {
      cancelledFlightEntity.totalAdults = passengerBookingStats.totalAdults;
    }
    if (passengerBookingStats && passengerBookingStats.totalChildren !== null) {
      cancelledFlightEntity.totalChildren = passengerBookingStats.totalChildren;
    }
    if (hotelBookingStats && hotelBookingStats.totalHotelRooms !== null) {
      cancelledFlightEntity.totalHotelRooms = hotelBookingStats.totalHotelRooms;
    }
    if (hotelBookingStats && hotelBookingStats.totalPrice !== null) {
      cancelledFlightEntity.totalPrice = hotelBookingStats.totalPrice;
    }
    if (hotelBookingStats && hotelBookingStats.totalBuyingPrice !== null) {
      cancelledFlightEntity.totalBuyingPrice =
        hotelBookingStats.totalBuyingPrice;
    }
    if (hotelBookingStats && hotelBookingStats.totalSellingPrice !== null) {
      cancelledFlightEntity.totalSellingPrice =
        hotelBookingStats.totalSellingPrice;
    }
    if (hotelBookingStats && hotelBookingStats.totalDiscounts !== null) {
      cancelledFlightEntity.totalDiscounts = hotelBookingStats.totalDiscounts;
    }
    if (hotelBookingStats && hotelBookingStats.totalHotelTaxes !== null) {
      cancelledFlightEntity.totalHotelTaxes = hotelBookingStats.totalHotelTaxes;
    }
    if (hotelBookingStats && hotelBookingStats.totalPlatformFee !== null) {
      cancelledFlightEntity.totalPlatformFee =
        hotelBookingStats.totalPlatformFee;
    }
    if (hotelBookingStats && hotelBookingStats.totalEarnings !== null) {
      cancelledFlightEntity.totalEarnings = hotelBookingStats.totalEarnings;
    }
    return this.flightRepo.save(cancelledFlightEntity);
  }

  // ── Booking ──────────────────────────────────────────────────────────────

  async createBooking(
    payload: Partial<BookingEntity>,
    requestLogger: Logger,
  ): Promise<BookingEntity> {
    requestLogger.info("Creating booking", {
      context: this.context,
      cancelledFlightId: payload.cancelledFlightId,
      pnr: payload.pnr,
    });
    const entity = this.bookingRepo.create(payload);
    return this.bookingRepo.save(entity);
  }

  async findBookingById(
    id: number,
    requestLogger: Logger,
  ): Promise<BookingEntity | null> {
    requestLogger.info("Finding booking by id", {
      context: this.context,
      id,
    });
    return this.bookingRepo.findOne({ where: { id } });
  }

  async findBookingsByFlightId(
    cancelledFlightId: number,
    requestLogger: Logger,
  ): Promise<BookingEntity[]> {
    requestLogger.info("Finding bookings by flight id", {
      context: this.context,
      cancelledFlightId,
    });
    return this.bookingRepo.find({
      where: { cancelledFlightId },
      order: { createdAt: "ASC" },
    });
  }

  async findBookingByPnrAndFlight(
    pnr: string,
    cancelledFlightId: number,
    requestLogger: Logger,
  ): Promise<BookingEntity | null> {
    requestLogger.info("Finding booking by PNR and flight", {
      context: this.context,
      pnr,
      cancelledFlightId,
    });
    return this.bookingRepo.findOne({ where: { pnr, cancelledFlightId } });
  }

  async findBookingsByFlightIdAndPnrs(
    cancelledFlightId: number,
    pnrs: string[],
    requestLogger: Logger,
  ): Promise<BookingEntity[]> {
    requestLogger.info("Finding bookings by flight id and PNRs", {
      context: this.context,
      cancelledFlightId,
      pnrs,
    });
    return this.bookingRepo.find({
      where: { cancelledFlightId, pnr: In(pnrs) },
    });
  }

  async updateBooking(
    entity: BookingEntity,
    payload: Partial<BookingEntity>,
    requestLogger: Logger,
  ): Promise<BookingEntity> {
    requestLogger.info("Updating booking", {
      context: this.context,
      bookingId: entity.id,
    });
    Object.assign(entity, payload);
    return this.bookingRepo.save(entity);
  }

  async deleteBooking(
    entity: BookingEntity,
    requestLogger: Logger,
  ): Promise<void> {
    requestLogger.info("Deleting booking", {
      context: this.context,
      bookingId: entity.id,
    });
    await this.bookingRepo.remove(entity);
  }

  // Bulk creation of bookings, used for CSV import
  async saveBookings(
    payloads: Partial<BookingEntity>[],
    requestLogger: Logger,
  ): Promise<BookingEntity[]> {
    requestLogger.info("Bulk saving bookings", {
      context: this.context,
      count: payloads.length,
    });
    const entities = payloads.map((p) => this.bookingRepo.create(p));
    return this.bookingRepo.save(entities);
  }

  async findBookingsByFlightIdWithPagination(
    cancelledFlightId: number,
    page: number,
    limit: number,
    requestLogger: Logger,
  ): Promise<{ bookings: BookingEntity[]; totalBookings: number }> {
    requestLogger.info("Finding all bookings by flight id with pagination", {
      context: this.context,
      cancelledFlightId,
    });

    const skip = (page - 1) * limit;

    const [bookings, totalBookings] = await this.bookingRepo
      .createQueryBuilder("booking")
      .where("booking.cancelled_flight_id = :cancelledFlightId", {
        cancelledFlightId,
      })
      .orderBy("booking.createdAt", "DESC")
      // Tie-breaker for rows sharing the same createdAt - without it, ties
      // have no guaranteed order and rows can shift between pages.
      .addOrderBy("booking.id", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { bookings, totalBookings };
  }

  async findBookingStatsByFlightId(
    cancelledFlightId: number,
    requestLogger: Logger,
  ): Promise<{
    totalBookings: number;
    totalAdults: number;
    totalChildren: number;
  }> {
    requestLogger.info("Finding booking stats by flight id", {
      context: this.context,
      cancelledFlightId,
    });

    const stats = await this.bookingRepo
      .createQueryBuilder("booking")
      .select("COUNT(booking.id)", "totalBookings")
      .addSelect("COALESCE(SUM(booking.adults), 0)", "totalAdults")
      .addSelect("COALESCE(SUM(booking.children), 0)", "totalChildren")
      .where("booking.cancelled_flight_id = :cancelledFlightId", {
        cancelledFlightId,
      })
      .getRawOne();

    return {
      totalBookings: Number(stats?.totalBookings ?? 0),
      totalAdults: Number(stats?.totalAdults ?? 0),
      totalChildren: Number(stats?.totalChildren ?? 0),
    };
  }

  // ── Hotel allocation ─────────────────────────────────────────────────────

  private readonly providerIds = new Map<string, number>();

  private get manager(): EntityManager {
    return this.flightRepo.manager;
  }

  /** Provider id for a provider code; registers unknown providers. */
  private async providerIdFor(
    manager: EntityManager,
    code: string,
  ): Promise<number> {
    const cached = this.providerIds.get(code);
    if (cached) return cached;
    const providers = manager.getRepository(ProviderEntity);
    await providers
      .createQueryBuilder()
      .insert()
      .values({ code, name: code })
      .orIgnore()
      .execute();
    const provider = await providers.findOneOrFail({ where: { code } });
    this.providerIds.set(code, provider.id);
    return provider.id;
  }

  /** Ids of the given provider hotels, adding any we don't know yet. */
  private async ensureHotels(
    manager: EntityManager,
    providerId: number,
    hotels: Array<{
      hotelCode: string;
      name?: string | null;
      starRating?: number | null;
    }>,
  ): Promise<Map<string, number>> {
    const unique = new Map(
      hotels
        .filter((hotel) => hotel.hotelCode)
        .map((hotel) => [hotel.hotelCode, hotel]),
    );
    if (unique.size === 0) return new Map();
    await manager
      .getRepository(HotelEntity)
      .createQueryBuilder()
      .insert()
      .values(
        [...unique.values()].map((hotel) => ({
          providerId,
          providerHotelId: hotel.hotelCode,
          name: hotel.name ?? "",
          starRating: hotel.starRating || null,
        })),
      )
      .orIgnore()
      .execute();
    const rows = await manager.getRepository(HotelEntity).find({
      select: { id: true, providerHotelId: true },
      where: { providerId, providerHotelId: In([...unique.keys()]) },
    });
    return new Map(rows.map((row) => [row.providerHotelId, row.id]));
  }

  // ── Static hotel data (hotels table) ──

  async findHotelsByCodes(
    provider: string,
    hotelCodes: string[],
  ): Promise<HotelEntity[]> {
    if (hotelCodes.length === 0) return [];
    const providerId = await this.providerIdFor(this.manager, provider);
    return this.manager.getRepository(HotelEntity).find({
      where: { providerId, providerHotelId: In([...new Set(hotelCodes)]) },
    });
  }

  /** Stores supplier static content, replacing what we had for those hotels. */
  async saveHotelContent(
    provider: string,
    contents: HotelStaticContent[],
  ): Promise<void> {
    if (contents.length === 0) return;
    const providerId = await this.providerIdFor(this.manager, provider);
    await this.manager
      .getRepository(HotelEntity)
      .createQueryBuilder()
      .insert()
      .values(
        contents.map((content) => ({
          providerId,
          providerHotelId: content.hotelCode,
          name: content.name ?? "",
          starRating: content.starRating,
          kind: content.kind,
          address: content.address,
          postalCode: content.postalCode,
          countryCode: content.countryCode,
          isActive: content.isActive,
          latitude: content.latitude,
          longitude: content.longitude,
          contact: content.contact,
          website: content.website,
          imageUrl: content.imageUrl,
          amenities: content.amenities,
          policies: content.policies,
          contentUpdatedAt: () => "now()",
        })) as QueryDeepPartialEntity<HotelEntity>[],
      )
      .orUpdate(
        [
          "name",
          "star_rating",
          "kind",
          "address",
          "postal_code",
          "country_code",
          "is_active",
          "latitude",
          "longitude",
          "contact",
          "website",
          "image_url",
          "amenities",
          "policies",
          "content_updated_at",
        ],
        ["provider_id", "provider_hotel_id"],
      )
      .execute();
  }

  /** Hotels whose static content was never fetched or is older than `staleMs`, oldest first. */
  async findStaleHotelCodes(
    provider: string,
    staleMs: number,
    limit: number,
  ): Promise<string[]> {
    const providerId = await this.providerIdFor(this.manager, provider);
    const rows = await this.manager
      .getRepository(HotelEntity)
      .createQueryBuilder("hotel")
      .select("hotel.providerHotelId", "hotelCode")
      .where("hotel.providerId = :providerId", { providerId })
      .andWhere(
        "(hotel.contentUpdatedAt IS NULL OR hotel.contentUpdatedAt < now() - (:staleMs * interval '1 millisecond'))",
        { staleMs },
      )
      .orderBy("hotel.contentUpdatedAt", "ASC", "NULLS FIRST")
      .limit(limit)
      .getRawMany<{ hotelCode: string }>();
    return rows.map((row) => row.hotelCode);
  }

  /** Allocation records for PNRs, each with the hotel booking it currently shows. */
  private async loadAllocationRecords(
    manager: EntityManager,
    pnrs: BookingEntity[],
  ): Promise<HotelAllocationRecord[]> {
    if (pnrs.length === 0) return [];
    const live = await manager.getRepository(HotelBookingEntity).find({
      where: {
        bookingId: In(pnrs.map((pnr) => pnr.id)),
        status: Not(HotelBookingAttemptStatus.FAILED),
      },
      relations: { hotel: true, rooms: true, candidate: true },
    });
    const byPnr = new Map(live.map((hb) => [hb.bookingId, hb]));
    return pnrs.map((pnr) =>
      toAllocationRecord(
        pnr,
        SHOWS_BOOKING.has(pnr.allocationStatus) ? byPnr.get(pnr.id) : null,
      ),
    );
  }

  async findAllocationByBookingId(
    bookingId: number,
    requestLogger: Logger,
  ): Promise<HotelAllocationRecord | null> {
    requestLogger.info("Finding hotel allocation by booking", {
      context: this.context,
      bookingId,
    });
    const pnr = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!pnr) return null;
    const [record] = await this.loadAllocationRecords(this.manager, [pnr]);
    return record;
  }

  async claimFlightAllocationRun(
    cancelledFlightId: number,
    allowedStatuses: FlightStatus[],
    leaseMs: number,
    runId: string,
    requestLogger: Logger,
    /**
     * Set for user-started runs: refused once this many runs were counted.
     * The run itself is counted in completeFlightAllocationRun.
     */
    maxUserRuns?: number,
    keepError = false,
  ): Promise<
    | { claimed: true; previousStatus: FlightStatus }
    | {
        claimed: false;
        reason: "running" | "status" | "missing" | "limit";
        status?: FlightStatus;
      }
  > {
    requestLogger.info("Claiming hotel allocation run for flight", {
      context: this.context,
      cancelledFlightId,
    });
    return this.flightRepo.manager.transaction(async (manager) => {
      const row = await manager
        .getRepository(CancelledFlightEntity)
        .createQueryBuilder("flight")
        .setLock("pessimistic_write")
        .select("flight.status", "status")
        .addSelect("flight.hotel_allocation_runs", "runs")
        .addSelect(
          "EXTRACT(EPOCH FROM (now() - flight.updated_at)) * 1000",
          "ageMs",
        )
        .where("flight.id = :id", { id: cancelledFlightId })
        .getRawOne<{
          status: FlightStatus;
          runs: number;
          ageMs: string | number;
        }>();
      if (!row) {
        return { claimed: false as const, reason: "missing" as const };
      }
      if (
        row.status === FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS &&
        Number(row.ageMs) < leaseMs
      ) {
        return {
          claimed: false as const,
          reason: "running" as const,
          status: row.status,
        };
      }
      if (!allowedStatuses.includes(row.status)) {
        return {
          claimed: false as const,
          reason: "status" as const,
          status: row.status,
        };
      }
      if (maxUserRuns !== undefined && Number(row.runs) >= maxUserRuns) {
        return {
          claimed: false as const,
          reason: "limit" as const,
          status: row.status,
        };
      }
      await manager.update(
        CancelledFlightEntity,
        { id: cancelledFlightId },
        {
          status: FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS,
          hotelAllocationRunId: runId,
          ...(!keepError && { hotelAllocationError: null }),
        },
      );
      return { claimed: true as const, previousStatus: row.status };
    });
  }

  async touchFlightAllocationRun(
    cancelledFlightId: number,
    runId: string,
    requestLogger: Logger,
  ): Promise<void> {
    await this.flightRepo
      .update(
        {
          id: cancelledFlightId,
          status: FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS,
          hotelAllocationRunId: runId,
        },
        { status: FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS },
      )
      .catch((error: any) =>
        requestLogger.warn("Could not refresh allocation run lease", {
          context: this.context,
          cancelledFlightId,
          error: error?.message,
        }),
      );
  }

  async findAllocationsByFlightId(
    cancelledFlightId: number,
    requestLogger: Logger,
  ): Promise<HotelAllocationRecord[]> {
    requestLogger.info("Finding hotel allocations for flight", {
      context: this.context,
      cancelledFlightId,
    });
    const pnrs = await this.bookingRepo.find({
      where: { cancelledFlightId },
      order: { id: "ASC" },
    });
    return this.loadAllocationRecords(this.manager, pnrs);
  }

  async refreshFlightTotals(
    cancelledFlightId: number,
    requestLogger: Logger,
  ): Promise<FlightHotelTotals> {
    return this.manager.transaction(async (manager) => {
      const flight = await manager
        .getRepository(CancelledFlightEntity)
        .createQueryBuilder("flight")
        .setLock("pessimistic_write")
        .select("flight.status", "status")
        .where("flight.id = :id", { id: cancelledFlightId })
        .getRawOne<{ status: FlightStatus }>();
      const totals = await this.sumConfirmedAllocations(
        manager,
        cancelledFlightId,
      );
      const { confirmedCount, ...columns } = totals;
      if (
        flight?.status === FlightStatus.PAID ||
        flight?.status === FlightStatus.PUBLISHED
      ) {
        requestLogger.error(
          "Booking confirmed on a paid flight; totals not changed, check with the supplier",
          {
            context: this.context,
            cancelledFlightId,
            status: flight.status,
            confirmedCount,
            totalPrice: totals.totalPrice,
          },
        );
        return totals;
      }
      await manager.update(
        CancelledFlightEntity,
        { id: cancelledFlightId },
        columns,
      );
      requestLogger.info(
        "Refreshed cancelled flight totals from confirmed bookings",
        {
          context: this.context,
          cancelledFlightId,
          confirmedCount,
          totalPrice: totals.totalPrice,
        },
      );
      return totals;
    });
  }

  async completeFlightAllocationRun(
    cancelledFlightId: number,
    runId: string,
    platformFeePercentage: number,
    runError: string | null | undefined,
    requestLogger: Logger,
    /** User-started run: counted toward the retry limit if it reached the supplier. */
    countUserRun = false,
  ): Promise<void> {
    await this.manager.transaction(async (manager) => {
      const flight = await manager
        .getRepository(CancelledFlightEntity)
        .createQueryBuilder("flight")
        .setLock("pessimistic_write")
        .select("flight.hotelAllocationRunId", "runId")
        .where("flight.id = :id", { id: cancelledFlightId })
        .getRawOne<{ runId: string | null }>();
      if (flight?.runId !== runId) {
        requestLogger.warn(
          "Hotel allocation run was superseded; not completing it",
          {
            context: this.context,
            cancelledFlightId,
            runId,
            currentRunId: flight?.runId ?? null,
          },
        );
        return;
      }
      const totals = await this.sumConfirmedAllocations(
        manager,
        cancelledFlightId,
      );
      // Only ALLOCATED once every PNR is confirmed; failed or manual-check
      // PNRs keep the flight open for another allocation run.
      const status = (await this.areAllPnrsHotelBooked(
        cancelledFlightId,
        manager,
      ))
        ? FlightStatus.ALLOCATED
        : FlightStatus.PASSENGERS_BOOKING_CONFIRMED;
      // A run that never sent a booking to the supplier (search outage,
      // credentials error...) does not use up a retry.
      const counted =
        countUserRun &&
        (
          await manager.query(
            `SELECT 1 FROM hotel_bookings
              WHERE run_id = $1 AND provider_request_sent_at IS NOT NULL
              LIMIT 1`,
            [runId],
          )
        ).length > 0;
      const { confirmedCount, ...columns } = totals;
      await manager.update(
        CancelledFlightEntity,
        { id: cancelledFlightId },
        {
          ...columns,
          platformFeePercentage,
          status,
          hotelAllocationRunId: null,
          ...(runError !== undefined && { hotelAllocationError: runError }),
          ...(counted && {
            hotelAllocationRuns: () => "hotel_allocation_runs + 1",
          }),
        },
      );
      requestLogger.info("Completed hotel allocation run", {
        context: this.context,
        cancelledFlightId,
        runId,
        status,
        countedAsUserRun: counted,
        confirmedCount,
        totalPrice: totals.totalPrice,
        runError,
      });
    });
  }

  async getFlightAllocationRunState(
    cancelledFlightId: number,
    leaseMs: number,
  ): Promise<{ running: boolean; stale: boolean; error: string | null }> {
    const row = await this.flightRepo
      .createQueryBuilder("flight")
      .select("flight.status", "status")
      .addSelect("flight.hotelAllocationError", "error")
      .addSelect(
        "EXTRACT(EPOCH FROM (now() - flight.updated_at)) * 1000",
        "ageMs",
      )
      .where("flight.id = :id", { id: cancelledFlightId })
      .getRawOne<{
        status: FlightStatus;
        error: string | null;
        ageMs: string | number;
      }>();
    const inProgress =
      row?.status === FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS;
    const running = inProgress && Number(row?.ageMs) < leaseMs;
    return {
      running,
      stale: inProgress && !running,
      error: row?.error ?? null,
    };
  }

  // Mirrors HotelAllocationService.toBookingStatus, aggregated in SQL.
  async getAllocationProgress(
    cancelledFlightId: number,
    leaseMs: number,
  ): Promise<{
    airlineId: number;
    status: FlightStatus;
    running: boolean;
    stale: boolean;
    error: string | null;
    counts: Record<PnrBookingStatus, number>;
  } | null> {
    const flight = await this.flightRepo
      .createQueryBuilder("flight")
      .select("flight.airlineId", "airlineId")
      .addSelect("flight.status", "status")
      .addSelect("flight.hotelAllocationError", "error")
      .addSelect(
        "EXTRACT(EPOCH FROM (now() - flight.updated_at)) * 1000",
        "ageMs",
      )
      .where("flight.id = :id", { id: cancelledFlightId })
      .getRawOne<{
        airlineId: number;
        status: FlightStatus;
        error: string | null;
        ageMs: string | number;
      }>();
    if (!flight) {
      return null;
    }
    const inProgress =
      flight.status === FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS;
    const running = inProgress && Number(flight.ageMs) < leaseMs;
    const countRows: Array<{ status: PnrBookingStatus; count: number }> =
      await this.manager.query(
        `SELECT s.pnr_status AS "status", COUNT(*)::int AS "count"
         FROM (
           SELECT CASE
             WHEN b.allocation_status IN ('draft', 'failed', 'cancelled')
               OR (b.allocation_status = 'confirmed' AND EXISTS (
                 SELECT 1 FROM hotel_booking_rooms r
                  WHERE r.hotel_booking_id = b.confirmed_hotel_booking_id
                    AND r.partner_order_id LIKE 'temp-%'
               ))
             THEN CASE
               WHEN b.allocation_status = 'failed' THEN 'FAILED'
               WHEN $2::boolean AND EXISTS (
                 SELECT 1 FROM hotel_bookings t WHERE t.booking_id = b.id
               ) THEN 'PENDING'
               ELSE 'NOT_STARTED'
             END
             WHEN b.allocation_status IN ('confirmed', 'completed') THEN 'SUCCESS'
             WHEN b.allocation_status = 'manual_check' THEN 'MANUAL_CHECK'
             WHEN b.allocation_status = 'in_progress' THEN 'PENDING'
             ELSE 'NOT_STARTED'
           END AS pnr_status
           FROM cancelled_flight_bookings b
           WHERE b.cancelled_flight_id = $1
         ) s
         GROUP BY s.pnr_status`,
        [cancelledFlightId, running],
      );
    const counts: Record<PnrBookingStatus, number> = {
      SUCCESS: 0,
      PENDING: 0,
      FAILED: 0,
      MANUAL_CHECK: 0,
      NOT_STARTED: 0,
    };
    for (const row of countRows) {
      counts[row.status] = Number(row.count);
    }
    return {
      airlineId: flight.airlineId,
      status: flight.status,
      running,
      stale: inProgress && !running,
      error: flight.error ?? null,
      counts,
    };
  }

  /**
   * True when the flight has PNRs and every one has a confirmed hotel booking
   * (same rule as the SUCCESS status in getAllocationProgress). A single
   * failed, manual-check, pending or unbooked PNR makes it false.
   */
  async areAllPnrsHotelBooked(
    cancelledFlightId: number,
    manager: EntityManager = this.manager,
  ): Promise<boolean> {
    const [row]: Array<{ total: number; unbooked: number }> =
      await manager.query(
        `SELECT COUNT(*)::int AS "total",
                COUNT(*) FILTER (
                  WHERE b.allocation_status NOT IN ('confirmed', 'completed')
                     OR (b.allocation_status = 'confirmed' AND EXISTS (
                       SELECT 1 FROM hotel_booking_rooms r
                        WHERE r.hotel_booking_id = b.confirmed_hotel_booking_id
                          AND r.partner_order_id LIKE 'temp-%'
                     ))
                     OR b.allocation_status IS NULL
                )::int AS "unbooked"
           FROM cancelled_flight_bookings b
          WHERE b.cancelled_flight_id = $1`,
        [cancelledFlightId],
      );
    return Number(row?.total ?? 0) > 0 && Number(row?.unbooked ?? 0) === 0;
  }

  private async sumConfirmedAllocations(
    manager: EntityManager,
    cancelledFlightId: number,
  ): Promise<FlightHotelTotals> {
    const pnrs = await manager.getRepository(BookingEntity).find({
      where: {
        cancelledFlightId,
        allocationStatus: HotelAllocationStatus.CONFIRMED,
      },
    });
    return sumHotelTotals(await this.loadAllocationRecords(manager, pnrs));
  }

  async ensurePnrProcessingOrder(
    cancelledFlightId: number,
    entries: Array<{
      bookingId: number;
      processingOrder: number;
      classPriority: number;
    }>,
    requestLogger: Logger,
  ): Promise<void> {
    await this.manager.transaction(async (manager) => {
      const pnrs = manager.getRepository(BookingEntity);
      for (const entry of entries) {
        await pnrs.update(
          {
            id: entry.bookingId,
            cancelledFlightId,
            processingOrder: IsNull(),
          },
          {
            processingOrder: entry.processingOrder,
            classPriority: entry.classPriority,
          },
        );
      }
    });
    requestLogger.info("Persisted PNR processing order", {
      context: this.context,
      cancelledFlightId,
      pnrs: entries.length,
    });
  }

  async findFreshPlanBookingIds(
    cancelledFlightId: number,
    ttlMs: number,
  ): Promise<Set<number>> {
    const rows = await this.bookingRepo
      .createQueryBuilder("pnr")
      .select("pnr.id", "bookingId")
      .where("pnr.cancelledFlightId = :cancelledFlightId", {
        cancelledFlightId,
      })
      .andWhere("pnr.planId IS NOT NULL")
      .andWhere("pnr.plannedAt > now() - (:ttlMs * interval '1 millisecond')", {
        ttlMs,
      })
      .getRawMany<{ bookingId: number }>();
    return new Set(rows.map((row) => Number(row.bookingId)));
  }

  async savePnrPlans(
    cancelledFlightId: number,
    planId: string,
    provider: string,
    plans: Array<{
      bookingId: number;
      roomPlan: Array<{
        adults: number;
        children: number;
        roomsNeeded: number;
      }>;
      candidates: PlannedCandidateInput[];
    }>,
    requestLogger: Logger,
  ): Promise<void> {
    await this.manager.transaction(async (manager) => {
      const providerId = await this.providerIdFor(manager, provider);
      const hotelIds = await this.ensureHotels(
        manager,
        providerId,
        plans.flatMap((plan) =>
          plan.candidates.map((candidate) => ({
            hotelCode: candidate.hotelCode,
            name: candidate.hotelName,
            starRating: candidate.stars,
          })),
        ),
      );
      const candidates = manager.getRepository(HotelAllocationOptionEntity);
      const pnrs = await manager.getRepository(BookingEntity).find({
        where: { id: In(plans.map((plan) => plan.bookingId)) },
      });
      const records = new Map(
        (await this.loadAllocationRecords(manager, pnrs)).map((record) => [
          record.bookingId,
          record,
        ]),
      );
      for (const plan of plans) {
        if (!isRebookableAllocation(records.get(plan.bookingId))) {
          continue;
        }
        if (plan.candidates.length > 0) {
          await candidates.save(
            plan.candidates.map((candidate, index) =>
              candidates.create({
                cancelledFlightId,
                bookingId: plan.bookingId,
                planId,
                candidateOrder: index + 1,
                hotelId: hotelIds.get(candidate.hotelCode)!,
                tier: candidate.tier,
                estimatedPrice: candidate.estimatedPrice,
                currency: candidate.currency,
                rooms: candidate.rooms,
              }),
            ),
          );
        }
        await manager.getRepository(BookingEntity).update(
          { id: plan.bookingId },
          {
            allocationStatus: HotelAllocationStatus.DRAFT,
            allocationReason: null,
            confirmedHotelBookingId: null,
            planId,
            plannedAt: () => "now()",
            roomPlan: plan.roomPlan,
          },
        );
      }
    });
    requestLogger.info("Persisted hotel booking plan", {
      context: this.context,
      cancelledFlightId,
      planId,
      pnrs: plans.length,
      candidates: plans.reduce((sum, plan) => sum + plan.candidates.length, 0),
    });
  }

  async findCandidatesByPlans(
    cancelledFlightId: number,
    planIds: string[],
  ): Promise<HotelCandidate[]> {
    if (planIds.length === 0) {
      return [];
    }
    const candidates = await this.manager
      .getRepository(HotelAllocationOptionEntity)
      .find({
        where: { cancelledFlightId, planId: In(planIds) },
        relations: { hotel: true },
        order: { bookingId: "ASC", candidateOrder: "ASC" },
      });
    return candidates.map((candidate) =>
      Object.assign(candidate, {
        hotelCode: candidate.hotel?.providerHotelId ?? "",
        hotelName: candidate.hotel?.name ?? "",
        category: starsLabel(candidate.hotel?.starRating),
        stars: candidate.hotel?.starRating ?? 0,
      }),
    );
  }

  async findSuccessAttemptsMissingOrderInfo(
    cancelledFlightId: number,
    olderThanMs: number,
  ): Promise<HotelBookingEntity[]> {
    return this.manager
      .getRepository(HotelBookingEntity)
      .createQueryBuilder("attempt")
      .where("attempt.cancelledFlightId = :cancelledFlightId", {
        cancelledFlightId,
      })
      .andWhere("attempt.status = :success", {
        success: HotelBookingAttemptStatus.SUCCESS,
      })
      .andWhere("attempt.providerOrderInfoAt IS NULL")
      .andWhere(
        "EXISTS (SELECT 1 FROM hotel_booking_rooms r WHERE r.hotel_booking_id = attempt.id AND r.partner_order_id IS NOT NULL)",
      )
      .leftJoinAndSelect("attempt.rooms", "room")
      .andWhere(
        "attempt.providerResponseReceivedAt < now() - (:olderThanMs * interval '1 millisecond')",
        { olderThanMs },
      )
      .getMany();
  }

  async saveAttemptOrderInfo(
    attemptId: number,
    providerStatus: string | null,
    orders: unknown[],
  ): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .update(HotelBookingEntity)
      .set({
        providerStatus,
        providerOrderInfo: orders,
        providerOrderInfoAt: () => "now()",
      })
      .where("id = :attemptId", { attemptId })
      .execute();
  }

  async findAttemptsByFlightId(
    cancelledFlightId: number,
  ): Promise<HotelBookingEntity[]> {
    return this.manager.getRepository(HotelBookingEntity).find({
      where: { cancelledFlightId },
      relations: { rooms: true, candidate: true, hotel: true },
      order: { bookingId: "ASC", attemptOrder: "ASC" },
    });
  }

  async startBookingAttempt(
    params: {
      cancelledFlightId: number;
      bookingId: number;
      candidateId?: number | null;
      runId?: string | null;
      rooms: Array<{ rateKey: string; adults: number; children: number }>;
      provider: string;
      providerRequestId: string;
      hotelCode?: string | null;
      hotelName?: string | null;
      category?: string | null;
      checkInDate: string;
      checkOutDate: string;
      platformFeePercentage: number;
    },
    requestLogger: Logger,
  ): Promise<
    | { started: true; attempt: HotelBookingEntity }
    | { started: false; reason: string }
  > {
    return this.manager.transaction(async (manager) => {
      await this.lockBooking(manager, params.bookingId);
      const attempts = manager.getRepository(HotelBookingEntity);

      const active = await attempts.findOne({
        where: {
          bookingId: params.bookingId,
          status: Not(HotelBookingAttemptStatus.FAILED),
        },
        relations: { rooms: true },
      });
      // A placeholder ("temp-") allocation from the old recommendation flow was never booked.
      if (
        active?.status === HotelBookingAttemptStatus.SUCCESS &&
        bookingReferenceOf(active.rooms).startsWith("temp-")
      ) {
        await attempts.update(
          { id: active.id },
          {
            status: HotelBookingAttemptStatus.FAILED,
            failureReason: "Placeholder allocation replaced by a live booking",
            failedAt: () => "now()",
          },
        );
      } else if (active) {
        return {
          started: false as const,
          reason: `Booking '${params.bookingId}' already has a ${active.status} hotel booking attempt`,
        };
      }
      const pnr = await manager
        .getRepository(BookingEntity)
        .findOneOrFail({ where: { id: params.bookingId } });
      const [record] = await this.loadAllocationRecords(manager, [pnr]);
      if (!isRebookableAllocation(record) && !active) {
        return {
          started: false as const,
          reason: `Booking '${params.bookingId}' hotel booking is ${record.status}`,
        };
      }

      const providerId = await this.providerIdFor(manager, params.provider);
      const hotelIds = params.hotelCode
        ? await this.ensureHotels(manager, providerId, [
            {
              hotelCode: params.hotelCode,
              name: params.hotelName,
              starRating: starsFromCategory(params.category),
            },
          ])
        : new Map<string, number>();
      const max = await attempts
        .createQueryBuilder("attempt")
        .select("MAX(attempt.attemptOrder)", "max")
        .where("attempt.bookingId = :bookingId", {
          bookingId: params.bookingId,
        })
        .getRawOne<{ max: number | null }>();
      const attempt = await attempts.save(
        attempts.create({
          cancelledFlightId: params.cancelledFlightId,
          bookingId: params.bookingId,
          candidateId: params.candidateId ?? null,
          runId: params.runId ?? null,
          attemptOrder: Number(max?.max ?? 0) + 1,
          status: HotelBookingAttemptStatus.PENDING,
          providerId,
          hotelId: params.hotelCode
            ? (hotelIds.get(params.hotelCode) ?? null)
            : null,
          checkInDate: params.checkInDate,
          checkOutDate: params.checkOutDate,
          platformFeePercentage: params.platformFeePercentage,
          providerRequestId: params.providerRequestId,
        }),
      );
      await manager.getRepository(HotelBookingRoomEntity).insert(
        params.rooms.map((room, index) => ({
          hotelBookingId: attempt.id,
          roomNo: index + 1,
          rateKey: room.rateKey,
          adults: room.adults,
          children: room.children,
          status: "pending" as const,
        })),
      );

      await this.applyEffectiveState(manager, params.bookingId);
      requestLogger.info("Hotel booking attempt started", {
        context: this.context,
        bookingId: params.bookingId,
        attemptId: attempt.id,
        attemptOrder: attempt.attemptOrder,
        hotelCode: params.hotelCode ?? null,
      });
      return { started: true as const, attempt };
    });
  }

  async markAttemptRequestSent(
    attemptId: number,
    bookingId: number,
    hotel: { hotelCode: string; hotelName: string; category: string },
  ): Promise<boolean> {
    return this.manager.transaction(async (manager) => {
      await this.lockBooking(manager, bookingId);
      const attempt = await manager
        .getRepository(HotelBookingEntity)
        .findOne({ where: { id: attemptId } });
      if (!attempt) return false;
      const hotelIds = await this.ensureHotels(manager, attempt.providerId, [
        {
          hotelCode: hotel.hotelCode,
          name: hotel.hotelName,
          starRating: starsFromCategory(hotel.category),
        },
      ]);
      const result = await manager
        .createQueryBuilder()
        .update(HotelBookingEntity)
        .set({
          providerRequestSentAt: () => "now()",
          hotelId: hotelIds.get(hotel.hotelCode) ?? null,
        })
        .where("id = :attemptId", { attemptId })
        .andWhere("status = :pending", {
          pending: HotelBookingAttemptStatus.PENDING,
        })
        .andWhere("provider_request_sent_at IS NULL")
        .execute();
      if ((result.affected ?? 0) !== 1) {
        return false;
      }
      await this.applyEffectiveState(manager, bookingId);
      return true;
    });
  }

  /** Writes each room's supplier order state onto the attempt's room rows. */
  private async saveRoomOrders(
    manager: EntityManager,
    attemptId: number,
    orders: ProviderOrder[],
  ): Promise<void> {
    if (orders.length === 0) return;
    await manager
      .getRepository(HotelBookingRoomEntity)
      .createQueryBuilder()
      .insert()
      .values(
        orders.map((order) => ({
          hotelBookingId: attemptId,
          roomNo: order.room,
          roomName: order.roomName,
          boardName: order.boardName,
          adults: order.adults,
          children: order.children,
          price: order.price,
          buyingPrice: order.buyingPrice,
          rateKey: order.rateKey,
          taxesAtProperty: order.taxesAtProperty,
          partnerOrderId: order.reference || null,
          providerOrderId: order.providerOrderId ?? null,
          status: order.status,
          failureReason: order.failureReason ?? null,
        })),
      )
      .orUpdate(
        [
          "room_name",
          "board_name",
          "adults",
          "children",
          "price",
          "buying_price",
          "rate_key",
          "taxes_at_property",
          "partner_order_id",
          "status",
          "failure_reason",
        ],
        ["hotel_booking_id", "room_no"],
      )
      .execute();
    // The supplier's order number is only known once a room is booked; never clear it.
    for (const order of orders.filter((entry) => entry.providerOrderId)) {
      await manager
        .getRepository(HotelBookingRoomEntity)
        .update(
          { hotelBookingId: attemptId, roomNo: order.room },
          { providerOrderId: order.providerOrderId },
        );
    }
  }

  /** Stores a confirmed booking: hotel profile, booked snapshot, money and final rooms. */
  private async saveConfirmedBooking(
    manager: EntityManager,
    attempt: HotelBookingEntity,
    success: AllocationSuccess,
  ): Promise<void> {
    let hotelId = attempt.hotelId ?? null;
    if (success.hotelCode) {
      const hotels = manager.getRepository(HotelEntity);
      const ids = await this.ensureHotels(manager, attempt.providerId, [
        { hotelCode: success.hotelCode },
      ]);
      hotelId = ids.get(success.hotelCode) ?? hotelId;
      // Fills hotels whose stored content is missing or stale (suppliers
      // without a content API); fresh content-API hotels are left as they are.
      if (hotelId && success.contact !== undefined) {
        const stars = starsFromCategory(success.category);
        await hotels
          .createQueryBuilder()
          .update()
          .set({
            ...(success.hotelName ? { name: success.hotelName } : {}),
            ...(stars ? { starRating: stars } : {}),
            address: success.address ?? null,
            contact: success.contact,
            latitude: success.latitude ?? null,
            longitude: success.longitude ?? null,
            website: success.website ?? null,
            imageUrl: success.imageUrl ?? null,
            amenities: success.amenities ?? null,
            policies: success.hotelPolicies ?? null,
            contentUpdatedAt: () => "now()",
          } as QueryDeepPartialEntity<HotelEntity>)
          .where("id = :hotelId", { hotelId })
          .andWhere(
            "(content_updated_at IS NULL OR content_updated_at < now() - (:staleMs * interval '1 millisecond'))",
            { staleMs: config.hotelContent.staleAfterMs },
          )
          .execute();
      }
    }
    await manager.getRepository(HotelBookingEntity).update({ id: attempt.id }, {
      hotelId,
      checkInDate: success.checkInDate ?? attempt.checkInDate,
      checkOutDate: success.checkOutDate ?? attempt.checkOutDate,
      currency: success.currency ?? attempt.currency ?? null,
      actualPrice: success.actualPrice ?? 0,
      buyingPrice: success.buyingPrice ?? 0,
      platformFeePercentage:
        success.platformFeePercentage ?? attempt.platformFeePercentage,
      platformFee: success.platformFee ?? 0,
      totalPrice: success.totalPrice ?? 0,
      earnings: success.earnings ?? 0,
    } as QueryDeepPartialEntity<HotelBookingEntity>);
    if (attempt.candidateId && success.distanceFromAirportKm != null) {
      await manager
        .getRepository(HotelAllocationOptionEntity)
        .update(
          { id: attempt.candidateId },
          { distanceFromAirportKm: success.distanceFromAirportKm },
        );
    }
    const references = (success.bookingReference ?? "").split(",");
    await this.saveRoomOrders(
      manager,
      attempt.id,
      (success.rooms ?? []).map((room, index) => ({
        room: index + 1,
        reference:
          references.length === 1 ? references[0] : (references[index] ?? ""),
        status: "booked",
        rateKey: room.rateKey ?? "",
        roomName: room.roomName,
        boardName: room.boardName,
        adults: room.adults,
        children: room.children,
        price: room.price,
        buyingPrice: room.buyingPrice ?? room.price,
        taxesAtProperty: room.taxesAtProperty ?? [],
      })),
    );
  }

  async finishBookingAttempt(
    attemptId: number,
    bookingId: number,
    changes: {
      status: HotelBookingAttemptStatus;
      failureCode?: string | null;
      failureReason?: string | null;
      providerStatus?: string | null;
      providerOrders?: ProviderOrder[] | null;
      responseReceived?: boolean;
    },
    success: AllocationSuccess | undefined,
    requestLogger: Logger,
  ): Promise<{ updated: boolean; allocation: HotelAllocationRecord | null }> {
    return this.manager.transaction(async (manager) => {
      await this.lockBooking(manager, bookingId);
      const { responseReceived, providerOrders, ...columns } = changes;
      const result = await manager
        .createQueryBuilder()
        .update(HotelBookingEntity)
        .set({
          ...columns,
          ...(responseReceived
            ? { providerResponseReceivedAt: () => "now()" }
            : {}),
          ...(changes.status === HotelBookingAttemptStatus.SUCCESS
            ? { completedAt: () => "now()" }
            : {}),
          ...(changes.status === HotelBookingAttemptStatus.FAILED
            ? { failedAt: () => "now()" }
            : {}),
        })
        .where("id = :attemptId", { attemptId })
        .andWhere("status IN (:...open)", {
          open: [
            HotelBookingAttemptStatus.PENDING,
            HotelBookingAttemptStatus.MANUAL_CHECK,
          ],
        })
        .execute();
      if ((result.affected ?? 0) !== 1) {
        requestLogger.warn("Hotel booking attempt was already settled", {
          context: this.context,
          attemptId,
          bookingId,
          status: changes.status,
        });
        return { updated: false, allocation: null };
      }
      if (providerOrders) {
        await this.saveRoomOrders(manager, attemptId, providerOrders);
      }
      if (success) {
        const attempt = await manager
          .getRepository(HotelBookingEntity)
          .findOneOrFail({ where: { id: attemptId } });
        await this.saveConfirmedBooking(manager, attempt, success);
      }
      const allocation = await this.applyEffectiveState(
        manager,
        bookingId,
        success ? (success.reason ?? null) : undefined,
      );
      return { updated: true, allocation };
    });
  }

  /** Saves the rooms of a supplier order before its booking request is sent; false if the attempt is no longer pending. */
  async recordProviderOrder(
    attemptId: number,
    orders: ProviderOrder[],
  ): Promise<boolean> {
    return this.manager.transaction(async (manager) => {
      const pending = await manager.getRepository(HotelBookingEntity).exists({
        where: { id: attemptId, status: HotelBookingAttemptStatus.PENDING },
      });
      if (!pending) return false;
      await this.saveRoomOrders(manager, attemptId, orders);
      return true;
    });
  }

  async findAttemptBySupplierReference(
    provider: string,
    reference: string,
  ): Promise<HotelBookingEntity | null> {
    return this.manager
      .getRepository(HotelBookingEntity)
      .createQueryBuilder("attempt")
      .innerJoin("attempt.provider", "provider")
      .leftJoinAndSelect("attempt.rooms", "room")
      .leftJoinAndSelect("attempt.hotel", "hotel")
      .where("provider.code = :provider", { provider })
      .andWhere(
        "EXISTS (SELECT 1 FROM hotel_booking_rooms r WHERE r.hotel_booking_id = attempt.id AND r.partner_order_id = :reference)",
        { reference },
      )
      .orderBy("attempt.id", "DESC")
      .getOne();
  }

  async isAttemptStale(attemptId: number, staleMs: number): Promise<boolean> {
    const row = await this.manager
      .getRepository(HotelBookingEntity)
      .createQueryBuilder("attempt")
      .select("attempt.id", "id")
      .where("attempt.id = :attemptId", { attemptId })
      .andWhere(
        "attempt.updated_at < now() - (:staleMs * interval '1 millisecond')",
        { staleMs },
      )
      .getRawOne();
    return !!row;
  }

  /** Flights whose allocation run stopped without finishing (lease expired). */
  async findInterruptedRunFlightIds(leaseMs: number): Promise<number[]> {
    const rows: Array<{ id: number }> = await this.flightRepo
      .createQueryBuilder("flight")
      .select("flight.id", "id")
      .where("flight.status = :status", {
        status: FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS,
      })
      .andWhere(
        "flight.updated_at < now() - (:leaseMs * interval '1 millisecond')",
        { leaseMs },
      )
      .getRawMany();
    return rows.map((row) => Number(row.id));
  }

  /**
   * Flights (not mid-run) with MANUAL_CHECK attempts at this provider; their
   * in-memory post-run checks are lost when the backend restarts.
   */
  async findFlightIdsWithManualCheckAttempts(
    provider: string,
  ): Promise<number[]> {
    const rows: Array<{ id: number }> = await this.manager.query(
      `SELECT DISTINCT hb.cancelled_flight_id AS "id"
         FROM hotel_bookings hb
         JOIN providers p ON p.id = hb.provider_id
         JOIN cancelled_flights f ON f.id = hb.cancelled_flight_id
        WHERE hb.status = $1 AND p.code = $2 AND f.status <> $3`,
      [
        HotelBookingAttemptStatus.MANUAL_CHECK,
        provider,
        FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS,
      ],
    );
    return rows.map((row) => Number(row.id));
  }

  /** A flight's MANUAL_CHECK attempts with this provider. */
  async findManualCheckAttempts(
    cancelledFlightId: number,
    provider: string,
  ): Promise<HotelBookingEntity[]> {
    return this.manager
      .getRepository(HotelBookingEntity)
      .createQueryBuilder("attempt")
      .innerJoin("attempt.provider", "provider")
      .leftJoinAndSelect("attempt.rooms", "room")
      .leftJoinAndSelect("attempt.hotel", "hotel")
      .where("attempt.cancelled_flight_id = :cancelledFlightId", {
        cancelledFlightId,
      })
      .andWhere("attempt.status = :status", {
        status: HotelBookingAttemptStatus.MANUAL_CHECK,
      })
      .andWhere("provider.code = :provider", { provider })
      .getMany();
  }

  /** Updates per-room supplier statuses; the attempt stays open as MANUAL_CHECK. */
  async updateOpenAttemptOrders(
    attemptId: number,
    bookingId: number,
    orders: ProviderOrder[],
    changes: { failureCode?: string | null; failureReason?: string | null },
  ): Promise<boolean> {
    return this.manager.transaction(async (manager) => {
      await this.lockBooking(manager, bookingId);
      const result = await manager
        .createQueryBuilder()
        .update(HotelBookingEntity)
        .set({
          ...changes,
          status: HotelBookingAttemptStatus.MANUAL_CHECK,
        })
        .where("id = :attemptId", { attemptId })
        .andWhere("status IN (:...open)", {
          open: [
            HotelBookingAttemptStatus.PENDING,
            HotelBookingAttemptStatus.MANUAL_CHECK,
          ],
        })
        .execute();
      if ((result.affected ?? 0) !== 1) {
        return false;
      }
      await this.saveRoomOrders(manager, attemptId, orders);
      await this.applyEffectiveState(manager, bookingId);
      return true;
    });
  }

  /**
   * A booking confirmed after the run ended moves the flight to ALLOCATED,
   * but only once every PNR on the flight is confirmed.
   */
  async promoteFlightAfterLateConfirmation(
    cancelledFlightId: number,
  ): Promise<boolean> {
    return this.manager.transaction(async (manager) => {
      await manager
        .getRepository(CancelledFlightEntity)
        .createQueryBuilder("flight")
        .setLock("pessimistic_write")
        .select("flight.id")
        .where("flight.id = :id", { id: cancelledFlightId })
        .getRawOne();
      if (!(await this.areAllPnrsHotelBooked(cancelledFlightId, manager))) {
        return false;
      }
      const result = await manager.update(
        CancelledFlightEntity,
        {
          id: cancelledFlightId,
          status: FlightStatus.PASSENGERS_BOOKING_CONFIRMED,
        },
        { status: FlightStatus.ALLOCATED },
      );
      return (result.affected ?? 0) === 1;
    });
  }

  async isWebhookTokenUsed(provider: string, token: string): Promise<boolean> {
    return this.manager
      .getRepository(SupplierWebhookTokenEntity)
      .exists({ where: { provider, token } });
  }

  async saveWebhookToken(provider: string, token: string): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .insert()
      .into(SupplierWebhookTokenEntity)
      .values({ provider, token })
      .orIgnore()
      .execute();
  }

  async markPnrFailed(bookingId: number, reason: string): Promise<boolean> {
    return this.manager.transaction(async (manager) => {
      await this.lockBooking(manager, bookingId);
      const active = await manager.getRepository(HotelBookingEntity).findOne({
        where: { bookingId, status: Not(HotelBookingAttemptStatus.FAILED) },
      });
      const pnr = await manager
        .getRepository(BookingEntity)
        .findOne({ where: { id: bookingId } });
      if (!pnr) return false;
      const [record] = await this.loadAllocationRecords(manager, [pnr]);
      if (active || !isRebookableAllocation(record)) {
        return false;
      }
      await manager.getRepository(BookingEntity).update(
        { id: bookingId },
        {
          allocationStatus: HotelAllocationStatus.FAILED,
          allocationReason: reason,
          confirmedHotelBookingId: null,
        },
      );
      return true;
    });
  }

  async recoverInterruptedAttempts(
    cancelledFlightId: number,
    runId: string,
    staleMs: number,
    requestLogger: Logger,
  ): Promise<number> {
    const interrupted =
      "((run_id IS NOT NULL AND run_id <> :runId) OR (run_id IS NULL AND updated_at < now() - (:staleMs * interval '1 millisecond')))";
    const recover = (sent: boolean) =>
      this.manager
        .createQueryBuilder()
        .update(HotelBookingEntity)
        .set(
          sent
            ? {
                status: HotelBookingAttemptStatus.MANUAL_CHECK,
                failureCode: HotelBookingFailureCode.INTERRUPTED_AFTER_REQUEST,
                failureReason:
                  "Booking was interrupted after the request was sent to the supplier; outcome unknown",
              }
            : {
                status: HotelBookingAttemptStatus.FAILED,
                failureCode: HotelBookingFailureCode.INTERRUPTED_BEFORE_REQUEST,
                failureReason:
                  "Booking was interrupted before the request was sent to the supplier",
                failedAt: () => "now()",
              },
        )
        .where("cancelled_flight_id = :cancelledFlightId", {
          cancelledFlightId,
        })
        .andWhere("status = :pending", {
          pending: HotelBookingAttemptStatus.PENDING,
        })
        .andWhere(
          sent
            ? "provider_request_sent_at IS NOT NULL"
            : "provider_request_sent_at IS NULL",
        )
        .andWhere(interrupted, { runId, staleMs })
        .returning("booking_id")
        .execute();

    const results = [await recover(false), await recover(true)];
    const bookingIds = new Set<number>(
      results.flatMap((result) =>
        (result.raw as Array<{ booking_id: number }>).map((row) =>
          Number(row.booking_id),
        ),
      ),
    );
    for (const bookingId of bookingIds) {
      await this.manager.transaction(async (manager) => {
        await this.lockBooking(manager, bookingId);
        await this.applyEffectiveState(manager, bookingId);
      });
    }
    if (bookingIds.size > 0) {
      requestLogger.warn("Recovered interrupted hotel booking attempts", {
        context: this.context,
        cancelledFlightId,
        bookings: [...bookingIds],
      });
    }
    return bookingIds.size;
  }

  private async lockBooking(
    manager: EntityManager,
    bookingId: number,
  ): Promise<void> {
    await manager
      .getRepository(BookingEntity)
      .createQueryBuilder("booking")
      .setLock("pessimistic_write")
      .where("booking.id = :bookingId", { bookingId })
      .getOne();
  }

  /**
   * Updates the PNR's allocation state from its booking attempts and returns
   * the resulting allocation record. `successReason` is passed when an attempt
   * was just confirmed.
   */
  private async applyEffectiveState(
    manager: EntityManager,
    bookingId: number,
    successReason?: string | null,
  ): Promise<HotelAllocationRecord | null> {
    const pnrs = manager.getRepository(BookingEntity);
    const pnr = await pnrs.findOne({ where: { id: bookingId } });
    if (!pnr) {
      return null;
    }
    const attempts = await manager.getRepository(HotelBookingEntity).find({
      where: { bookingId },
      relations: { hotel: true },
      order: { attemptOrder: "ASC" },
    });
    const changes = effectiveAllocationState(
      pnr.allocationStatus,
      attempts,
      successReason,
    );
    if (changes) {
      await pnrs.update({ id: bookingId }, changes);
      Object.assign(pnr, changes);
    }
    const [record] = await this.loadAllocationRecords(manager, [pnr]);
    return record;
  }

  /** PNRs that have entered allocation, as hotel booking records (newest first). */
  async findHotelBookingsByFlightIdWithPagination(
    cancelledFlightId: number,
    page: number,
    limit: number,
    requestLogger: Logger,
  ): Promise<{
    hotelBookings: HotelAllocationRecord[];
    totalHotelBookings: number;
  }> {
    requestLogger.info(
      "Finding all hotel bookings by flight id with pagination",
      { context: this.context, cancelledFlightId },
    );

    const skip = (page - 1) * limit;
    const [pnrs, totalHotelBookings] = await this.bookingRepo
      .createQueryBuilder("pnr")
      .where("pnr.cancelledFlightId = :cancelledFlightId", {
        cancelledFlightId,
      })
      .andWhere(
        "(pnr.processingOrder IS NOT NULL OR pnr.allocationStatus <> :draft)",
        { draft: HotelAllocationStatus.DRAFT },
      )
      .orderBy("pnr.createdAt", "DESC")
      // Tie-breaker for rows sharing the same createdAt (e.g. bulk-created
      // in one transaction) - without it, ties have no guaranteed order and
      // rows can shift between pages across requests.
      .addOrderBy("pnr.id", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      hotelBookings: await this.loadAllocationRecords(this.manager, pnrs),
      totalHotelBookings,
    };
  }

  async findAllHotelBookingsByFlightId(
    cancelledFlightId: number,
    requestLogger: Logger,
  ): Promise<HotelAllocationRecord[]> {
    requestLogger.info("Finding all hotel bookings by flight id for report", {
      context: this.context,
      cancelledFlightId,
    });

    const pnrs = await this.bookingRepo.find({
      where: {
        cancelledFlightId,
        allocationStatus: HotelAllocationStatus.CONFIRMED,
      },
    });
    const records = await this.loadAllocationRecords(this.manager, pnrs);
    return records.sort((a, b) => a.id - b.id);
  }

  async findHotelBookingById(
    id: number,
    requestLogger: Logger,
  ): Promise<HotelBookingRecord | null> {
    requestLogger.info("Finding hotel booking by id", {
      context: this.context,
      id,
    });

    const hotelBooking = await this.manager
      .getRepository(HotelBookingEntity)
      .findOne({
        where: { id },
        relations: {
          booking: true,
          hotel: true,
          rooms: true,
          candidate: true,
          cancelledFlight: { departureAirport: true, arrivalAirport: true },
        },
      });
    return hotelBooking
      ? (toAllocationRecord(
          hotelBooking.booking,
          hotelBooking,
        ) as HotelBookingRecord)
      : null;
  }

  async findHotelSummaryByFlightId(
    cancelledFlightId: number,
    requestLogger: Logger,
  ): Promise<{
    totalBookings: number;
    totalAdults: number;
    totalChildren: number;
    totalRooms: number;
    totalHotelCost: number;
    totalDiscount: number;
    totalHotelTax: number;
    totalPlatformFee: number;
    totalCost: number;
  }> {
    requestLogger.info("Finding hotel summary by flight id", {
      context: this.context,
      cancelledFlightId,
    });

    const flight = await this.flightRepo.findOne({
      where: { id: cancelledFlightId },
    });

    return {
      totalBookings: Number(flight?.totalBooking ?? 0),
      totalAdults: Number(flight?.totalAdults ?? 0),
      totalChildren: Number(flight?.totalChildren ?? 0),
      totalRooms: Number(flight?.totalHotelRooms ?? 0),
      totalHotelCost: Number(flight?.totalActualPrice ?? 0),
      totalDiscount: Number(flight?.totalDiscounts ?? 0),
      totalHotelTax: Number(flight?.totalHotelTaxes ?? 0),
      totalPlatformFee: Number(flight?.totalPlatformFee ?? 0),
      totalCost: Number(flight?.totalPrice ?? 0),
    };
  }
}
