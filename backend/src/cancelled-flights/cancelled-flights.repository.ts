import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { BookingEntity } from "./entities/booking.entity";
import { FlightStatus } from "./entities/enums";
import { HotelAllocationEntity } from "./entities/hotel-allocation.entity";
import { Logger } from "winston";

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

  /**
   * Claims one booking's hotel reservation atomically. The booking row is
   * locked (SELECT ... FOR UPDATE) so concurrent claims run one at a time;
   * `prepare` sees the current allocation and either throws to refuse or
   * returns the in-progress row to save. One short transaction, so it also
   * works behind a connection pooler.
   */
  async claimHotelReservation(
    bookingId: number,
    prepare: (
      existing: HotelAllocationEntity | null,
    ) => Partial<HotelAllocationEntity>,
    requestLogger: Logger,
  ): Promise<{
    existing: HotelAllocationEntity | null;
    attempt: HotelAllocationEntity;
  }> {
    requestLogger.info("Claiming hotel reservation for booking", {
      context: this.context,
      bookingId,
    });
    return this.allocationRepo.manager.transaction(async (manager) => {
      await manager
        .getRepository(BookingEntity)
        .createQueryBuilder("booking")
        .setLock("pessimistic_write")
        .where("booking.id = :bookingId", { bookingId })
        .getOne();
      const allocations = manager.getRepository(HotelAllocationEntity);
      const existing = await allocations.findOne({ where: { bookingId } });
      const attempt = await allocations.save(
        allocations.create(prepare(existing)),
      );
      return { existing, attempt };
    });
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

  async saveHotelAllocations(
    cancelledFlightId: number,
    payload: {
      hotelBookings: Partial<HotelAllocationEntity>[];
      totalActualPrice: number;
      totalBuyingPrice: number;
      totalSellingPrice: number;
      totalDiscounts: number;
      totalHotelTaxes: number;
      platformFeePercentage: number;
      totalPlatformFee: number;
      totalPrice: number;
      totalEarnings: number;
      totalHotelRooms: number;
      status: FlightStatus;
    },
    requestLogger: Logger,
  ): Promise<void> {
    // transactionally save all hotel allocations, updated cancel flight
    await this.allocationRepo.manager.transaction(
      async (transactionalEntityManager) => {
        // Clear prior rows first - insert-only would duplicate every booking
        // if a retry path is ever added (unreachable today; the entry guard blocks it).
        await transactionalEntityManager.delete(HotelAllocationEntity, {
          cancelledFlightId,
        });

        const entities = payload.hotelBookings.map((p) =>
          this.allocationRepo.create(p),
        );
        await transactionalEntityManager.save(entities);
        requestLogger.info(`Saved ${entities.length} hotel allocations`, {
          context: this.context,
          cancelledFlightId,
        });

        // Update the cancelled flight with aggregated hotel booking totals
        await transactionalEntityManager.update(
          CancelledFlightEntity,
          { id: cancelledFlightId },
          {
            totalActualPrice: payload.totalActualPrice,
            totalBuyingPrice: payload.totalBuyingPrice,
            totalSellingPrice: payload.totalSellingPrice,
            totalDiscounts: payload.totalDiscounts,
            totalHotelTaxes: payload.totalHotelTaxes,
            platformFeePercentage: payload.platformFeePercentage,
            totalPlatformFee: payload.totalPlatformFee,
            totalPrice: payload.totalPrice,
            totalHotelRooms: payload.totalHotelRooms,
            totalEarnings: payload.totalEarnings,
            status: payload.status,
          },
        );
      },
    );
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
