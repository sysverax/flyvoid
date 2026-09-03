import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { LoggerService } from "../common/logger/logger.service";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { BookingEntity } from "./entities/booking.entity";
import { FlightStatus } from "./entities/enums";
import { HotelAllocationEntity } from "./entities/hotel-allocation.entity";

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

  async updateFlightStatus({
    cancelledFlightEntity,
    status,
    passengerBookingStats,
    HotelBookingStats,
    requestId,
  }: {
    cancelledFlightEntity: CancelledFlightEntity;
    status: FlightStatus;
    passengerBookingStats: {
      totalBookings: number | null;
      totalAdults: number | null;
      totalChildren: number | null;
    };
    HotelBookingStats: {
      totalHotelRooms: number | null;
      totalPrice: number | null;
      totalBuyingPrice: number | null;
      totalSellingPrice: number | null;
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
    if (passengerBookingStats.totalBookings !== null) {
      cancelledFlightEntity.totalBooking = passengerBookingStats.totalBookings;
    }
    if (passengerBookingStats.totalAdults !== null) {
      cancelledFlightEntity.totalAdults = passengerBookingStats.totalAdults;
    }
    if (passengerBookingStats.totalChildren !== null) {
      cancelledFlightEntity.totalChildren = passengerBookingStats.totalChildren;
    }
    if (HotelBookingStats && HotelBookingStats.totalHotelRooms !== null) {
      cancelledFlightEntity.totalHotelRooms = HotelBookingStats.totalHotelRooms;
    }
    if (HotelBookingStats && HotelBookingStats.totalPrice !== null) {
      cancelledFlightEntity.totalPrice = HotelBookingStats.totalPrice;
    }
    if (HotelBookingStats && HotelBookingStats.totalBuyingPrice !== null) {
      cancelledFlightEntity.totalBuyingPrice =
        HotelBookingStats.totalBuyingPrice;
    }
    if (HotelBookingStats && HotelBookingStats.totalSellingPrice !== null) {
      cancelledFlightEntity.totalSellingPrice =
        HotelBookingStats.totalSellingPrice;
    }
    if (HotelBookingStats && HotelBookingStats.totalPlatformFee !== null) {
      cancelledFlightEntity.totalPlatformFee =
        HotelBookingStats.totalPlatformFee;
    }
    if (HotelBookingStats && HotelBookingStats.totalEarnings !== null) {
      cancelledFlightEntity.totalEarnings = HotelBookingStats.totalEarnings;
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
  ): Promise<BookingEntity[]> {
    this.logger.debug(
      "Finding all bookings by flight id with pagination",
      "CancelledFlightsRepository",
      requestId,
      { cancelledFlightId },
    );

    const skip = (page - 1) * limit;

    const bookings = await this.bookingRepo
      .createQueryBuilder("booking")
      .where("booking.cancelled_flight_id = :cancelledFlightId", {
        cancelledFlightId,
      })
      .skip(skip)
      .take(limit)
      .getMany();

    return bookings;
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
}
