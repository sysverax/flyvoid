import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, Not, Repository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { BookingEntity } from "./entities/booking.entity";
import {
  FlightStatus,
  HotelAllocationStatus,
  HotelBookingAttemptStatus,
  HotelBookingFailureCode,
} from "./entities/enums";
import { HotelAllocationEntity } from "./entities/hotel-allocation.entity";
import { HotelBookingAttemptEntity } from "./entities/hotel-booking-attempt.entity";
import { HotelBookingCandidateEntity } from "./entities/hotel-booking-candidate.entity";
import { resolveEffectiveAttempt } from "./hotel-allocation.planner";
import { Logger } from "winston";

export const CLEARED_ALLOCATION_HOTEL = {
  hotelCode: "",
  hotelName: "",
  category: "",
  address: null,
  contact: null,
  latitude: null,
  longitude: null,
  distanceFromAirportKm: null,
  imageUrl: null,
  website: null,
  amenities: null,
  hotelPolicies: null,
  rooms: [],
  totalRooms: 0,
  actualPrice: 0,
  buyingPrice: 0,
  sellingPrice: 0,
  tax: 0,
  platformFee: 0,
  totalPrice: 0,
  earnings: 0,
  discount: 0,
  bookingReference: "",
} satisfies Partial<HotelAllocationEntity>;

export function isRebookableAllocation(
  row?: Pick<HotelAllocationEntity, "status" | "bookingReference"> | null,
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

export function effectiveAllocationChanges(
  row: Pick<HotelAllocationEntity, "status">,
  attempts: Array<
    Pick<
      HotelBookingAttemptEntity,
      "status" | "attemptOrder" | "hotelCode" | "hotelName" | "category" | "failureReason"
    >
  >,
  success?: Partial<HotelAllocationEntity>,
): Partial<HotelAllocationEntity> | null {
  const effective = resolveEffectiveAttempt(attempts);
  const context = (attempt: (typeof attempts)[number]) => ({
    ...CLEARED_ALLOCATION_HOTEL,
    hotelCode: attempt.hotelCode ?? "",
    hotelName: attempt.hotelName ?? "",
    category: attempt.category ?? "",
  });
  if (effective?.status === HotelBookingAttemptStatus.SUCCESS) {
    return success ? { ...success, status: HotelAllocationStatus.CONFIRMED } : null;
  }
  if (effective?.status === HotelBookingAttemptStatus.MANUAL_CHECK) {
    return {
      ...context(effective),
      status: HotelAllocationStatus.MANUAL_CHECK,
      reason: effective.failureReason ?? "Booking requires manual check",
    };
  }
  if (effective?.status === HotelBookingAttemptStatus.PENDING) {
    return {
      ...context(effective),
      status: HotelAllocationStatus.IN_PROGRESS,
      reason: effective.hotelName
        ? `Booking in progress at ${effective.hotelName}`
        : "Booking in progress",
    };
  }
  if (
    row.status === HotelAllocationStatus.IN_PROGRESS ||
    row.status === HotelAllocationStatus.MANUAL_CHECK
  ) {
    const latest = [...attempts].sort((a, b) => b.attemptOrder - a.attemptOrder)[0];
    return {
      ...CLEARED_ALLOCATION_HOTEL,
      status: HotelAllocationStatus.DRAFT,
      reason: latest?.failureReason ?? null,
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
      HotelAllocationEntity,
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
    @InjectRepository(HotelAllocationEntity)
    private readonly allocationRepo: Repository<HotelAllocationEntity>,
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

    if (status) {
      qb.andWhere("flight.status = :status", { status });
    }

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

    if (status) {
      qb.andWhere("flight.status = :status", { status });
    }

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
    const sumIgnoringNaN = (column: string) =>
      `COALESCE(SUM(CASE WHEN ${column} = 'NaN' THEN 0 ELSE ${column} END), 0)`;

    const raw = await qb
      .select("COUNT(flight.id)", "totalCancelFlights")
      .addSelect("COALESCE(SUM(flight.totalAdults), 0)", "totalAdults")
      .addSelect("COALESCE(SUM(flight.totalChildren), 0)", "totalChildren")
      .addSelect("COALESCE(SUM(flight.totalBooking), 0)", "totalBookings")
      .addSelect("COALESCE(SUM(flight.totalHotelRooms), 0)", "totalRooms")
      .addSelect(
        sumIgnoringNaN("flight.totalSellingPrice"),
        "totalHotelCost",
      )
      .addSelect(sumIgnoringNaN("flight.totalHotelTaxes"), "totalHotelTax")
      .addSelect(sumIgnoringNaN("flight.totalDiscounts"), "totalDiscount")
      .addSelect(sumIgnoringNaN("flight.totalPrice"), "totalCost")
      .addSelect(
        sumIgnoringNaN("flight.totalPlatformFee"),
        "totalPlatformFee",
      )
      .getRawOne<{
        totalCancelFlights: string;
        totalAdults: string;
        totalChildren: string;
        totalBookings: string;
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

  // ── HotelAllocation ──────────────────────────────────────────────────────
  async saveHotelAllocation(
    payload: Partial<HotelAllocationEntity>,
    requestLogger: Logger,
  ): Promise<HotelAllocationEntity> {
    requestLogger.info("Saving hotel allocation", {
      context: this.context,
      cancelledFlightId: payload.cancelledFlightId,
      bookingId: payload.bookingId,
      hotelName: payload.hotelName,
    });
    const entity = this.allocationRepo.create(payload);
    return this.allocationRepo.save(entity);
  }

  async deleteHotelAllocation(
    id: number,
    requestLogger: Logger,
  ): Promise<void> {
    requestLogger.info("Deleting hotel allocation", {
      context: this.context,
      id,
    });
    await this.allocationRepo.delete({ id });
  }

  async findAllocationByBookingId(
    bookingId: number,
    requestLogger: Logger,
  ): Promise<HotelAllocationEntity | null> {
    requestLogger.info("Finding hotel allocation by booking", {
      context: this.context,
      bookingId,
    });
    return this.allocationRepo.findOne({ where: { bookingId } });
  }

  async claimFlightAllocationRun(
    cancelledFlightId: number,
    allowedStatuses: FlightStatus[],
    leaseMs: number,
    runId: string,
    requestLogger: Logger,
  ): Promise<
    | { claimed: true; previousStatus: FlightStatus }
    | {
        claimed: false;
        reason: "running" | "status" | "missing";
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
        .addSelect(
          "EXTRACT(EPOCH FROM (now() - flight.updated_at)) * 1000",
          "ageMs",
        )
        .where("flight.id = :id", { id: cancelledFlightId })
        .getRawOne<{ status: FlightStatus; ageMs: string | number }>();
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
      await manager.update(
        CancelledFlightEntity,
        { id: cancelledFlightId },
        {
          status: FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS,
          hotelAllocationRunId: runId,
          hotelAllocationError: null,
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
  ): Promise<HotelAllocationEntity[]> {
    requestLogger.info("Finding hotel allocations for flight", {
      context: this.context,
      cancelledFlightId,
    });
    return this.allocationRepo.find({ where: { cancelledFlightId } });
  }

  async refreshFlightTotals(
    cancelledFlightId: number,
    requestLogger: Logger,
  ): Promise<FlightHotelTotals> {
    return this.allocationRepo.manager.transaction(async (manager) => {
      await manager
        .getRepository(CancelledFlightEntity)
        .createQueryBuilder("flight")
        .setLock("pessimistic_write")
        .select("flight.id")
        .where("flight.id = :id", { id: cancelledFlightId })
        .getRawOne();
      const totals = await this.sumConfirmedAllocations(
        manager,
        cancelledFlightId,
      );
      const { confirmedCount, ...columns } = totals;
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
    runError: string | null,
    requestLogger: Logger,
  ): Promise<void> {
    await this.allocationRepo.manager.transaction(async (manager) => {
      const flight = await manager
        .getRepository(CancelledFlightEntity)
        .createQueryBuilder("flight")
        .setLock("pessimistic_write")
        .select("flight.hotelAllocationRunId", "runId")
        .where("flight.id = :id", { id: cancelledFlightId })
        .getRawOne<{ runId: string | null }>();
      if (flight?.runId !== runId) {
        requestLogger.warn("Hotel allocation run was superseded; not completing it", {
          context: this.context,
          cancelledFlightId,
          runId,
          currentRunId: flight?.runId ?? null,
        });
        return;
      }
      const totals = await this.sumConfirmedAllocations(
        manager,
        cancelledFlightId,
      );
      const status =
        totals.confirmedCount > 0
          ? FlightStatus.ALLOCATED
          : FlightStatus.PASSENGERS_BOOKING_CONFIRMED;
      const { confirmedCount, ...columns } = totals;
      await manager.update(
        CancelledFlightEntity,
        { id: cancelledFlightId },
        {
          ...columns,
          platformFeePercentage,
          status,
          hotelAllocationRunId: null,
          hotelAllocationError: runError,
        },
      );
      requestLogger.info("Completed hotel allocation run", {
        context: this.context,
        cancelledFlightId,
        runId,
        status,
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
      .getRawOne<{ status: FlightStatus; error: string | null; ageMs: string | number }>();
    const inProgress = row?.status === FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS;
    const running = inProgress && Number(row?.ageMs) < leaseMs;
    return {
      running,
      stale: inProgress && !running,
      error: row?.error ?? null,
    };
  }

  private async sumConfirmedAllocations(
    manager: EntityManager,
    cancelledFlightId: number,
  ): Promise<FlightHotelTotals> {
    const rows = await manager.getRepository(HotelAllocationEntity).find({
      where: { cancelledFlightId, status: HotelAllocationStatus.CONFIRMED },
    });
    return sumHotelTotals(rows);
  }

  async ensurePnrProcessingOrder(
    cancelledFlightId: number,
    entries: Array<{
      bookingId: number;
      processingOrder: number;
      classPriority: number;
    }>,
    defaults: {
      checkInDate: string;
      checkOutDate: string;
      platformFeePercentage: number;
    },
    requestLogger: Logger,
  ): Promise<void> {
    await this.allocationRepo.manager.transaction(async (manager) => {
      const allocations = manager.getRepository(HotelAllocationEntity);
      const existing = await allocations.find({ where: { cancelledFlightId } });
      const byBooking = new Map(existing.map((row) => [row.bookingId, row]));
      for (const entry of entries) {
        const row = byBooking.get(entry.bookingId);
        if (!row) {
          await allocations.save(
            allocations.create({
              ...CLEARED_ALLOCATION_HOTEL,
              cancelledFlightId,
              bookingId: entry.bookingId,
              checkInDate: defaults.checkInDate,
              checkOutDate: defaults.checkOutDate,
              platformFeePercentage: defaults.platformFeePercentage,
              status: HotelAllocationStatus.DRAFT,
              reason: null,
              processingOrder: entry.processingOrder,
              classPriority: entry.classPriority,
            }),
          );
        } else if (row.processingOrder == null) {
          await allocations.update(
            { id: row.id },
            {
              processingOrder: entry.processingOrder,
              classPriority: entry.classPriority,
            },
          );
        }
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
    const rows = await this.allocationRepo
      .createQueryBuilder("allocation")
      .select("allocation.bookingId", "bookingId")
      .where("allocation.cancelledFlightId = :cancelledFlightId", {
        cancelledFlightId,
      })
      .andWhere("allocation.planId IS NOT NULL")
      .andWhere(
        "allocation.plannedAt > now() - (:ttlMs * interval '1 millisecond')",
        { ttlMs },
      )
      .getRawMany<{ bookingId: number }>();
    return new Set(rows.map((row) => Number(row.bookingId)));
  }

  async savePnrPlans(
    cancelledFlightId: number,
    planId: string,
    plans: Array<{
      bookingId: number;
      roomPlan: Array<{ adults: number; children: number; roomsNeeded: number }>;
      candidates: Array<Omit<HotelBookingCandidateEntity, "id" | "cancelledFlightId" | "bookingId" | "planId" | "candidateOrder" | "cancelledFlight" | "booking" | "createdAt">>;
    }>,
    requestLogger: Logger,
  ): Promise<void> {
    await this.allocationRepo.manager.transaction(async (manager) => {
      const candidates = manager.getRepository(HotelBookingCandidateEntity);
      const allocations = manager.getRepository(HotelAllocationEntity);
      for (const plan of plans) {
        const row = await allocations.findOne({
          where: { bookingId: plan.bookingId },
        });
        if (!row || !isRebookableAllocation(row)) {
          continue;
        }
        if (plan.candidates.length > 0) {
          await candidates.save(
            plan.candidates.map((candidate, index) =>
              candidates.create({
                ...candidate,
                cancelledFlightId,
                bookingId: plan.bookingId,
                planId,
                candidateOrder: index + 1,
              }),
            ),
          );
        }
        await allocations.update(
          { id: row.id },
          {
            ...CLEARED_ALLOCATION_HOTEL,
            status: HotelAllocationStatus.DRAFT,
            reason: null,
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
  ): Promise<HotelBookingCandidateEntity[]> {
    if (planIds.length === 0) {
      return [];
    }
    return this.allocationRepo.manager
      .getRepository(HotelBookingCandidateEntity)
      .find({
        where: { cancelledFlightId, planId: In(planIds) },
        order: { bookingId: "ASC", candidateOrder: "ASC" },
      });
  }

  async findSuccessAttemptsMissingOrderInfo(
    cancelledFlightId: number,
    olderThanMs: number,
  ): Promise<HotelBookingAttemptEntity[]> {
    return this.allocationRepo.manager
      .getRepository(HotelBookingAttemptEntity)
      .createQueryBuilder("attempt")
      .where("attempt.cancelledFlightId = :cancelledFlightId", {
        cancelledFlightId,
      })
      .andWhere("attempt.status = :success", {
        success: HotelBookingAttemptStatus.SUCCESS,
      })
      .andWhere("attempt.providerOrderInfoAt IS NULL")
      .andWhere("attempt.providerBookingReference IS NOT NULL")
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
    await this.allocationRepo.manager
      .createQueryBuilder()
      .update(HotelBookingAttemptEntity)
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
  ): Promise<HotelBookingAttemptEntity[]> {
    return this.allocationRepo.manager
      .getRepository(HotelBookingAttemptEntity)
      .find({
        where: { cancelledFlightId },
        order: { bookingId: "ASC", attemptOrder: "ASC" },
      });
  }

  async startBookingAttempt(
    params: {
      cancelledFlightId: number;
      bookingId: number;
      candidateId?: number | null;
      planId?: string | null;
      runId?: string | null;
      rateKeys: string[];
      provider: string;
      providerRequestId: string;
      hotelCode?: string | null;
      hotelName?: string | null;
      category?: string | null;
      checkInDate: string;
      checkOutDate: string;
    },
    requestLogger: Logger,
  ): Promise<
    | { started: true; attempt: HotelBookingAttemptEntity }
    | { started: false; reason: string }
  > {
    return this.allocationRepo.manager.transaction(async (manager) => {
      await this.lockBooking(manager, params.bookingId);
      const attempts = manager.getRepository(HotelBookingAttemptEntity);
      const allocations = manager.getRepository(HotelAllocationEntity);

      const active = await attempts.findOne({
        where: {
          bookingId: params.bookingId,
          status: Not(HotelBookingAttemptStatus.FAILED),
        },
      });
      if (active) {
        return {
          started: false as const,
          reason: `Booking '${params.bookingId}' already has a ${active.status} hotel booking attempt`,
        };
      }
      const row = await allocations.findOne({
        where: { bookingId: params.bookingId },
      });
      if (row && !isRebookableAllocation(row)) {
        return {
          started: false as const,
          reason: `Booking '${params.bookingId}' hotel booking is ${row.status}`,
        };
      }

      const max = await attempts
        .createQueryBuilder("attempt")
        .select("MAX(attempt.attemptOrder)", "max")
        .where("attempt.bookingId = :bookingId", { bookingId: params.bookingId })
        .getRawOne<{ max: number | null }>();
      const attempt = await attempts.save(
        attempts.create({
          cancelledFlightId: params.cancelledFlightId,
          bookingId: params.bookingId,
          candidateId: params.candidateId ?? null,
          planId: params.planId ?? null,
          runId: params.runId ?? null,
          attemptOrder: Number(max?.max ?? 0) + 1,
          status: HotelBookingAttemptStatus.PENDING,
          hotelCode: params.hotelCode ?? null,
          hotelName: params.hotelName ?? null,
          category: params.category ?? null,
          rateKeys: params.rateKeys,
          provider: params.provider,
          providerRequestId: params.providerRequestId,
        }),
      );

      if (!row) {
        await allocations.save(
          allocations.create({
            ...CLEARED_ALLOCATION_HOTEL,
            cancelledFlightId: params.cancelledFlightId,
            bookingId: params.bookingId,
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            status: HotelAllocationStatus.DRAFT,
            reason: null,
          }),
        );
      }
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
    return this.allocationRepo.manager.transaction(async (manager) => {
      await this.lockBooking(manager, bookingId);
      const result = await manager
        .createQueryBuilder()
        .update(HotelBookingAttemptEntity)
        .set({
          providerRequestSentAt: () => "now()",
          hotelCode: hotel.hotelCode,
          hotelName: hotel.hotelName,
          category: hotel.category,
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

  async finishBookingAttempt(
    attemptId: number,
    bookingId: number,
    changes: {
      status: HotelBookingAttemptStatus;
      failureCode?: string | null;
      failureReason?: string | null;
      providerStatus?: string | null;
      providerBookingReference?: string | null;
      providerIdempotencyKey?: string | null;
      responseReceived?: boolean;
    },
    success: Partial<HotelAllocationEntity> | undefined,
    requestLogger: Logger,
  ): Promise<{ updated: boolean; allocation: HotelAllocationEntity | null }> {
    return this.allocationRepo.manager.transaction(async (manager) => {
      await this.lockBooking(manager, bookingId);
      const { responseReceived, ...columns } = changes;
      const result = await manager
        .createQueryBuilder()
        .update(HotelBookingAttemptEntity)
        .set({
          ...columns,
          ...(responseReceived
            ? { providerResponseReceivedAt: () => "now()" }
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
      const allocation = await this.applyEffectiveState(
        manager,
        bookingId,
        success,
      );
      return { updated: true, allocation };
    });
  }

  async markPnrFailed(
    bookingId: number,
    reason: string,
  ): Promise<boolean> {
    return this.allocationRepo.manager.transaction(async (manager) => {
      await this.lockBooking(manager, bookingId);
      const active = await manager
        .getRepository(HotelBookingAttemptEntity)
        .findOne({
          where: { bookingId, status: Not(HotelBookingAttemptStatus.FAILED) },
        });
      const allocations = manager.getRepository(HotelAllocationEntity);
      const row = await allocations.findOne({ where: { bookingId } });
      if (active || !row || !isRebookableAllocation(row)) {
        return false;
      }
      await allocations.update(
        { id: row.id },
        { ...CLEARED_ALLOCATION_HOTEL, status: HotelAllocationStatus.FAILED, reason },
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
      this.allocationRepo.manager
        .createQueryBuilder()
        .update(HotelBookingAttemptEntity)
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
              },
        )
        .where("cancelled_flight_id = :cancelledFlightId", { cancelledFlightId })
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
      await this.allocationRepo.manager.transaction(async (manager) => {
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

  private async applyEffectiveState(
    manager: EntityManager,
    bookingId: number,
    success?: Partial<HotelAllocationEntity>,
  ): Promise<HotelAllocationEntity | null> {
    const allocations = manager.getRepository(HotelAllocationEntity);
    const row = await allocations.findOne({ where: { bookingId } });
    if (!row) {
      return null;
    }
    const attempts = await manager
      .getRepository(HotelBookingAttemptEntity)
      .find({ where: { bookingId }, order: { attemptOrder: "ASC" } });
    const changes = effectiveAllocationChanges(row, attempts, success);
    if (!changes) {
      return row;
    }
    await allocations.update(
      { id: row.id },
      changes as QueryDeepPartialEntity<HotelAllocationEntity>,
    );
    return { ...row, ...changes } as HotelAllocationEntity;
  }

  async findHotelBookingsByFlightIdWithPagination(
    cancelledFlightId: number,
    page: number,
    limit: number,
    requestLogger: Logger,
  ): Promise<{
    hotelBookings: HotelAllocationEntity[];
    totalHotelBookings: number;
  }> {
    requestLogger.info(
      "Finding all hotel bookings by flight id with pagination",
      { context: this.context, cancelledFlightId },
    );

    const skip = (page - 1) * limit;

    const [hotelBookings, totalHotelBookings] = await this.allocationRepo
      .createQueryBuilder("hotelBooking")
      .leftJoinAndSelect("hotelBooking.booking", "booking")
      .where("hotelBooking.cancelled_flight_id = :cancelledFlightId", {
        cancelledFlightId,
      })
      .orderBy("booking.createdAt", "DESC")
      // Tie-breaker for rows sharing the same createdAt (e.g. bulk-created
      // in one transaction) - without it, ties have no guaranteed order and
      // rows can shift between pages across requests.
      .addOrderBy("hotelBooking.id", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { hotelBookings, totalHotelBookings };
  }

  async findAllHotelBookingsByFlightId(
    cancelledFlightId: number,
    requestLogger: Logger,
  ): Promise<HotelAllocationEntity[]> {
    requestLogger.info("Finding all hotel bookings by flight id for report", {
      context: this.context,
      cancelledFlightId,
    });

    return this.allocationRepo
      .createQueryBuilder("hotelBooking")
      .leftJoinAndSelect("hotelBooking.booking", "booking")
      .where("hotelBooking.cancelled_flight_id = :cancelledFlightId", {
        cancelledFlightId,
      })
      .andWhere("hotelBooking.status = :confirmed", {
        confirmed: HotelAllocationStatus.CONFIRMED,
      })
      .orderBy("hotelBooking.id", "ASC")
      .getMany();
  }

  async findHotelBookingById(
    id: number,
    requestLogger: Logger,
  ): Promise<HotelAllocationEntity | null> {
    requestLogger.info("Finding hotel booking by id", {
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
