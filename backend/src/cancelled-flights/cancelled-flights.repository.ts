import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LoggerService } from "../common/logger/logger.service";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { BookingEntity } from "./entities/booking.entity";

@Injectable()
export class CancelledFlightsRepository {
  constructor(
    @InjectRepository(CancelledFlightEntity)
    private readonly flightRepo: Repository<CancelledFlightEntity>,
    @InjectRepository(BookingEntity)
    private readonly bookingRepo: Repository<BookingEntity>,
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
    id: string,
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
    id: string,
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
      relations: ["airline", "departureAirport", "arrivalAirport", "bookings"],
    });
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
    id: string,
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
    cancelledFlightId: string,
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
    cancelledFlightId: string,
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
}
