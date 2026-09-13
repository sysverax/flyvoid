import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { LoggerService } from "../common/logger/logger.service";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { BookingEntity } from "./entities/booking.entity";
import { FlightStatus } from "./entities/enums";
import { HotelAllocationEntity } from "./entities/hotel-allocation.entity";
import { Logger } from "winston";

@Injectable()
export class CancelledFlightsRepository {
  constructor(
    @InjectRepository(CancelledFlightEntity)
    private readonly flightRepo: Repository<CancelledFlightEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepo: Repository<BookingEntity>,
    @InjectRepository(HotelAllocationEntity)
    private readonly allocationRepo: Repository<HotelAllocationEntity>,
    private readonly logger: LoggerService,
  ) {}

  // ── CancelledFlight ──────────────────────────────────────────────────────

  async createFlight(
    payload: Partial<CancelledFlightEntity>,
    requestId: string,
  ): Promise<CancelledFlightEntity> {
    this.logger.debug(
      "Creating cancelled flight",
      "CancelledFlightsRepository",
      requestId,
      { flightNumber: payload.flightNumber },
    );
    const entity = this.flightRepo.create(payload);
    return this.flightRepo.save(entity);
  }

  async findFlightById(
    id: number,
    requestId: string,
  ): Promise<CancelledFlightEntity | null> {
    this.logger.debug(
      "Finding cancelled flight by id",
      "CancelledFlightsRepository",
      requestId,
      { id },
    );
    return this.flightRepo.findOne({ where: { id } });
  }

  async findFlightWithRelations(
    id: number,
    requestId: string,
  ): Promise<CancelledFlightEntity | null> {
    this.logger.debug(
      "Finding cancelled flight with relations",
      "CancelledFlightsRepository",
      requestId,
      { id },
    );
    return this.flightRepo.findOne({
      where: { id },
      relations: ["airline", "departureAirport", "arrivalAirport"],
    });
  }

  async updateFlightEntity(
    entity: CancelledFlightEntity,
    requestId: string,
  ): Promise<CancelledFlightEntity> {
    this.logger.debug(
      "Updating cancelled flight",
      "CancelledFlightsRepository",
      requestId,
      { id: entity.id },
    );
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
    requestId: string,
  ): Promise<{ flights: CancelledFlightEntity[]; totalCount: number }> {
    this.logger.debug(
      "Finding cancelled flights with pagination and filters",
      "CancelledFlightsRepository",
      requestId,
      { page, limit, status, search, airlineId, startDate, endDate },
    );

    const skip = (page - 1) * limit;

    const qb = this.flightRepo
      .createQueryBuilder("flight")
      .leftJoinAndSelect("flight.departureAirport", "departureAirport")
      .leftJoinAndSelect("flight.arrivalAirport", "arrivalAirport")
      .orderBy("flight.createdAt", "DESC")
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

  async updateFlightStatus({
    cancelledFlightEntity,
    status,
    passengerBookingStats,
    hotelBookingStats,
    requestId,
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
    requestId: string;
  }): Promise<CancelledFlightEntity> {
    this.logger.debug(
      "Updating cancelled flight status",
      "CancelledFlightsRepository",
      requestId,
      { flightId: cancelledFlightEntity.id, status },
    );

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
    requestId: string,
  ): Promise<BookingEntity> {
    this.logger.debug(
      "Creating booking",
      "CancelledFlightsRepository",
      requestId,
      { cancelledFlightId: payload.cancelledFlightId, pnr: payload.pnr },
    );
    const entity = this.bookingRepo.create(payload);
    return this.bookingRepo.save(entity);
  }

  async findBookingById(
    id: number,
    requestId: string,
  ): Promise<BookingEntity | null> {
    this.logger.debug(
      "Finding booking by id",
      "CancelledFlightsRepository",
      requestId,
      { id },
    );
    return this.bookingRepo.findOne({ where: { id } });
  }

  async findBookingsByFlightId(
    cancelledFlightId: number,
    requestId: string,
  ): Promise<BookingEntity[]> {
    this.logger.debug(
      "Finding bookings by flight id",
      "CancelledFlightsRepository",
      requestId,
      { cancelledFlightId },
    );
    return this.bookingRepo.find({
      where: { cancelledFlightId },
      order: { createdAt: "ASC" },
    });
  }

  async findBookingByPnrAndFlight(
    pnr: string,
    cancelledFlightId: number,
    requestId: string,
  ): Promise<BookingEntity | null> {
    this.logger.debug(
      "Finding booking by PNR and flight",
      "CancelledFlightsRepository",
      requestId,
      { pnr, cancelledFlightId },
    );
    return this.bookingRepo.findOne({ where: { pnr, cancelledFlightId } });
  }

  async findBookingsByFlightIdAndPnrs(
    cancelledFlightId: number,
    pnrs: string[],
    requestId: string,
  ): Promise<BookingEntity[]> {
    this.logger.debug(
      "Finding bookings by flight id and PNRs",
      "CancelledFlightsRepository",
      requestId,
      { cancelledFlightId, pnrs },
    );
    return this.bookingRepo.find({
      where: { cancelledFlightId, pnr: In(pnrs) },
    });
  }

  async updateBooking(
    entity: BookingEntity,
    payload: Partial<BookingEntity>,
    requestId: string,
  ): Promise<BookingEntity> {
    this.logger.debug(
      "Updating booking",
      "CancelledFlightsRepository",
      requestId,
      { bookingId: entity.id },
    );
    Object.assign(entity, payload);
    return this.bookingRepo.save(entity);
  }

  async deleteBooking(entity: BookingEntity, requestId: string): Promise<void> {
    this.logger.debug(
      "Deleting booking",
      "CancelledFlightsRepository",
      requestId,
      { bookingId: entity.id },
    );
    await this.bookingRepo.remove(entity);
  }

  // Bulk creation of bookings, used for CSV import
  async saveBookings(
    payloads: Partial<BookingEntity>[],
    requestId: string,
  ): Promise<BookingEntity[]> {
    this.logger.debug(
      "Bulk saving bookings",
      "CancelledFlightsRepository",
      requestId,
      { count: payloads.length },
    );
    const entities = payloads.map((p) => this.bookingRepo.create(p));
    return this.bookingRepo.save(entities);
  }

  async findBookingsByFlightIdWithPagination(
    cancelledFlightId: number,
    page: number,
    limit: number,
    requestId: string,
  ): Promise<{ bookings: BookingEntity[]; totalBookings: number }> {
    this.logger.debug(
      "Finding all bookings by flight id with pagination",
      "CancelledFlightsRepository",
      requestId,
      { cancelledFlightId },
    );

    const skip = (page - 1) * limit;

    const [bookings, totalBookings] = await this.bookingRepo
      .createQueryBuilder("booking")
      .where("booking.cancelled_flight_id = :cancelledFlightId", {
        cancelledFlightId,
      })
      .orderBy("booking.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { bookings, totalBookings };
  }

  async findBookingStatsByFlightId(
    cancelledFlightId: number,
    requestId: string,
  ): Promise<{
    totalBookings: number;
    totalAdults: number;
    totalChildren: number;
  }> {
    this.logger.debug(
      "Finding booking stats by flight id",
      "CancelledFlightsRepository",
      requestId,
      { cancelledFlightId },
    );

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
    requestId: string,
  ): Promise<HotelAllocationEntity> {
    this.logger.debug(
      "Saving hotel allocation",
      "CancelledFlightsRepository",
      requestId,
      {
        cancelledFlightId: payload.cancelledFlightId,
        bookingId: payload.bookingId,
        hotelName: payload.hotelName,
      },
    );
    const entity = this.allocationRepo.create(payload);
    return this.allocationRepo.save(entity);
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
    },
    requestId: string,
    requestLogger: Logger,
  ): Promise<void> {
    // transactionally save all hotel allocations, updated cancel flight
    await this.allocationRepo.manager.transaction(
      async (transactionalEntityManager) => {
        const entities = payload.hotelBookings.map((p) =>
          this.allocationRepo.create(p),
        );
        await transactionalEntityManager.save(entities);
        requestLogger.info(`Saved ${entities.length} hotel allocations`, {
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
            status: FlightStatus.ALLOCATED,
          },
        );
      },
    );
  }

  async findHotelBookingsByFlightIdWithPagination(
    cancelledFlightId: number,
    page: number,
    limit: number,
    requestId: string,
  ): Promise<{
    hotelBookings: HotelAllocationEntity[];
    totalHotelBookings: number;
  }> {
    this.logger.debug(
      "Finding all hotel bookings by flight id with pagination",
      "CancelledFlightsRepository",
      requestId,
      { cancelledFlightId },
    );

    const skip = (page - 1) * limit;

    const [hotelBookings, totalHotelBookings] = await this.allocationRepo
      .createQueryBuilder("hotelBooking")
      .leftJoinAndSelect("hotelBooking.booking", "booking")
      .where("hotelBooking.cancelled_flight_id = :cancelledFlightId", {
        cancelledFlightId,
      })
      .orderBy("booking.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { hotelBookings, totalHotelBookings };
  }

  async findHotelBookingById(
    id: number,
    requestId: string,
  ): Promise<HotelAllocationEntity | null> {
    this.logger.debug(
      "Finding hotel booking by id",
      "CancelledFlightsRepository",
      requestId,
      { id },
    );

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
    requestId: string,
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
    this.logger.debug(
      "Finding hotel summary by flight id",
      "CancelledFlightsRepository",
      requestId,
      { cancelledFlightId },
    );

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
