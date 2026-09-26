import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";
import { BookingEntity } from "./entities/booking.entity";
import {
  CancellationReason,
  FlightStatus,
  HotelAllocationStatus,
  SpecialNote,
  TravelClass,
} from "./entities/enums";
import {
  CreateCancelledFlightDto,
  UpdateCancelledFlightDto,
  CreateBookingDto,
  BookingResponseDto,
  UpdateBookingDto,
  CancelledFlightResponseDto,
  CancelledFlightListResponseDto,
  ImportBookingResponseDto,
  ReviewCancelledFlightResponseDto,
  AllocateHotelDto,
  BookHotelRequestDto,
  CancelledFlightHotelBookingListResponseDto,
  HotelSummaryCancelledFlightResponseDto,
} from "./dto";
import { HotelBookingDetailResponseDto } from "../hotel-bookings/dto";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { Logger } from "winston";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-request.interface";
import { UserType } from "../common/constants/user.constants";
import { GetCancelledFlightsQueryDto } from "./dto/get-cancelled-flights-query.dto";
import { request } from "http";
import { config } from "../config/config";
import { CancelledFlightBookingsListResponseDto } from "./dto/cancelled-flight-bookings-list-response.dto";

@Injectable()
export class CancelledFlightsService {
  private readonly context = "CancelledFlightsService";
  private readonly sesClient = new SESClient({
    region: config.ses.region,
    credentials: {
      accessKeyId: config.ses.accessKeyId,
      secretAccessKey: config.ses.secretAccessKey,
    },
  });

  constructor(
    private readonly cancelledFlightsRepository: CancelledFlightsRepository,
  ) {}

  private toCancelledFlightResponse(
    flight: CancelledFlightEntity,
  ): CancelledFlightResponseDto {
    return {
      id: flight.id,
      flightNumber: flight.flightNumber,
      airlineId: flight.airlineId,
      departureAirportId: flight.departureAirportId,
      arrivalAirportId: flight.arrivalAirportId,
      cancellationDate: flight.cancellationDate,
      cancellationReason: flight.cancellationReason ?? null,
      cancellationReasonText: flight.cancellationReasonText ?? null,
      status: flight.status,
      createdAt: flight.createdAt.toISOString(),
      updatedAt: flight.updatedAt?.toISOString() ?? null,
    };
  }

  private toBookingResponse(booking: BookingEntity): BookingResponseDto {
    return {
      id: booking.id,
      cancelledFlightId: booking.cancelledFlightId,
      pnr: booking.pnr,
      firstName: booking.firstName,
      lastName: booking.lastName,
      email: booking.email,
      phone: booking.phone,
      travelClass: booking.travelClass,
      adults: booking.adults,
      children: booking.children,
      specialNotes: booking.specialNotes ?? [],
      additionalNotes: booking.additionalNotes ?? null,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt?.toISOString() ?? null,
    };
  }

  // ── Create cancelled flight ──────────────────────────────────────────────

  async createCancelledFlight(
    airlineId: number,
    dto: CreateCancelledFlightDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<CancelledFlightResponseDto> {
    if (dto.departureAirportId === dto.arrivalAirportId) {
      requestLogger.warn(
        "Rejected cancelled flight creation: departure and arrival airports match",
        { context: this.context, airlineId, airportId: dto.departureAirportId },
      );
      throw new BadRequestException(
        "Departure and arrival airports must be different",
      );
    }

    const flight = await this.cancelledFlightsRepository.createFlight(
      {
        flightNumber: dto.flightNumber,
        airlineId: airlineId,
        departureAirportId: dto.departureAirportId,
        arrivalAirportId: dto.arrivalAirportId,
        cancellationDate: dto.cancellationDate,
        cancellationReason:
          (dto.cancellationReason as CancellationReason) ?? null,
        cancellationReasonText: dto.cancellationReasonText ?? null,
        status: FlightStatus.DRAFT,
      },
      requestLogger,
    );

    requestLogger.info("Cancelled flight created", {
      context: this.context,
      flightId: flight.id,
      flightNumber: flight.flightNumber,
    });

    return this.toCancelledFlightResponse(flight);
  }

  async updateCancelledFlight(
    flightId: number,
    airlineId: number,
    dto: UpdateCancelledFlightDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<CancelledFlightResponseDto> {
    const flight = await this.requireFlight(flightId, requestLogger);

    if (flight.airlineId !== airlineId) {
      requestLogger.warn(
        "Rejected cancelled flight update: flight belongs to a different airline",
        {
          context: this.context,
          flightId,
          airlineId,
          ownerAirlineId: flight.airlineId,
        },
      );
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    if (
      flight.status !== FlightStatus.DRAFT &&
      flight.status !== FlightStatus.IN_PROGRESS
    ) {
      requestLogger.warn(
        "Rejected cancelled flight update: flight not in an editable status",
        { context: this.context, flightId, status: flight.status },
      );
      throw new BadRequestException(
        `Cancelled flight '${flightId}' cannot be modified in status '${flight.status}'. Only 'draft' and 'in_progress' are allowed.`,
      );
    }

    const hasAnyUpdate =
      dto.flightNumber !== undefined ||
      dto.departureAirportId !== undefined ||
      dto.arrivalAirportId !== undefined ||
      dto.cancellationDate !== undefined ||
      dto.cancellationReason !== undefined ||
      dto.cancellationReasonText !== undefined;

    if (!hasAnyUpdate) {
      requestLogger.warn(
        "Rejected cancelled flight update: no fields provided",
        { context: this.context, flightId },
      );
      throw new BadRequestException("At least one field must be provided");
    }

    const nextDepartureAirportId =
      dto.departureAirportId ?? flight.departureAirportId;
    const nextArrivalAirportId =
      dto.arrivalAirportId ?? flight.arrivalAirportId;

    if (nextDepartureAirportId === nextArrivalAirportId) {
      requestLogger.warn(
        "Rejected cancelled flight update: departure and arrival airports match",
        { context: this.context, flightId, airportId: nextDepartureAirportId },
      );
      throw new BadRequestException(
        "Departure and arrival airports must be different",
      );
    }

    if (dto.flightNumber !== undefined) {
      flight.flightNumber = dto.flightNumber;
    }
    if (dto.departureAirportId !== undefined) {
      flight.departureAirportId = dto.departureAirportId;
    }
    if (dto.arrivalAirportId !== undefined) {
      flight.arrivalAirportId = dto.arrivalAirportId;
    }
    if (dto.cancellationDate !== undefined) {
      flight.cancellationDate = dto.cancellationDate;
    }
    if (dto.cancellationReason !== undefined) {
      flight.cancellationReason = dto.cancellationReason;
    }
    if (dto.cancellationReasonText !== undefined) {
      flight.cancellationReasonText = dto.cancellationReasonText;
    }

    const updatedFlight =
      await this.cancelledFlightsRepository.updateFlightEntity(
        flight,
        requestLogger,
      );

    requestLogger.info("Cancelled flight updated", {
      context: this.context,
      flightId,
    });

    return this.toCancelledFlightResponse(updatedFlight);
  }

  // ── Add single booking ───────────────────────────────────────────────────

  async addBooking(
    flightId: number,
    dto: CreateBookingDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<BookingResponseDto> {
    const flight = await this.requireFlight(flightId, requestLogger);

    const duplicate =
      await this.cancelledFlightsRepository.findBookingByPnrAndFlight(
        dto.pnr,
        flightId,
        requestLogger,
      );
    if (duplicate) {
      requestLogger.warn("Rejected booking: PNR already exists for flight", {
        context: this.context,
        flightId,
        pnr: dto.pnr,
      });
      throw new ConflictException(
        `Booking with PNR '${dto.pnr}' already exists for this flight`,
      );
    }

    const booking = await this.cancelledFlightsRepository.createBooking(
      {
        cancelledFlightId: flightId,
        pnr: dto.pnr,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        travelClass: dto.travelClass,
        adults: dto.adults,
        children: dto.children,
        specialNotes: dto.specialNotes ?? [],
        additionalNotes: dto.additionalNotes ?? null,
      },
      requestLogger,
    );

    await this.markFlightInProgressIfDraft(flight, requestLogger);

    requestLogger.info("Booking added", {
      context: this.context,
      flightId,
      bookingId: booking.id,
      pnr: booking.pnr,
    });

    return this.toBookingResponse(booking);
  }

  // Minimal RFC4180 parser: handles quoted fields (so a comma-separated
  // special_notes cell doesn't shift later columns) and "" escaped quotes.
  private parseCsvRows(content: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    const text = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];

      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  // ── Import preview ───────────────────────────────────────────────────────

  async importBookings(
    flightId: number,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    requestId: string,
    requestLogger: Logger,
  ): Promise<ImportBookingResponseDto> {
    const flight = await this.requireFlight(flightId, requestLogger);
    requestLogger.info("Parsing booking import CSV", {
      context: this.context,
      flightId,
      originalname: file.originalname,
      sizeBytes: file.buffer.length,
    });
    // Parse the CSV file
    const csv = file.buffer.toString("utf-8");
    const rows = this.parseCsvRows(csv);
    const pnrSet = new Set<string>();

    const bookings: {
      row: number;
      pnr: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      travelClass: TravelClass;
      adults: number;
      children: number;
      specialNotes: SpecialNote[];
      additionalNotes: string | null;
    }[] = [];
    const errorsList: { row: number; errors: string[] }[] = [];
    let validCount = 0;
    let errorCount = 0;

    rows.forEach((row, rowNumber) => {
      if (rowNumber === 0) return; // skip header

      const getValue = (col: number): string => String(row[col] ?? "").trim();

      if (row.every((value) => String(value ?? "").trim() === "")) {
        return;
      }

      const pnr = getValue(0);
      const firstName = getValue(1);
      const lastName = getValue(2);
      const email = getValue(3);
      const phone = getValue(4);
      const travelClassRaw = getValue(5).toLowerCase();
      const adultsRaw = parseInt(getValue(6), 10);
      const childrenRaw = parseInt(getValue(7), 10);
      const specialNotesRaw = getValue(8);
      const additionalNotes = getValue(9) || null;

      const errors: string[] = [];

      if (!pnr) {
        errors.push("PNR is required");
      } else if (pnrSet.has(pnr)) {
        errors.push(`Duplicate PNR '${pnr}' found in the file`);
      } else {
        pnrSet.add(pnr);
      }
      if (!firstName) errors.push("First Name is required");
      if (!lastName) errors.push("Last Name is required");
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("Email is invalid");
      }
      if (!phone) errors.push("Phone is required");
      const validTravelClasses = Object.values(TravelClass) as string[];
      if (!validTravelClasses.includes(travelClassRaw)) {
        errors.push(
          `Travel Class must be one of: ${validTravelClasses.join(", ")}`,
        );
      }
      if (isNaN(adultsRaw) || adultsRaw < 1) {
        errors.push("Adults must be a number >= 1");
      }
      if (isNaN(childrenRaw) || childrenRaw < 0) {
        errors.push("Children must be a number >= 0");
      }

      const validSpecialNotes = Object.values(SpecialNote) as string[];
      const specialNotes: SpecialNote[] = specialNotesRaw
        ? (specialNotesRaw
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter((s) => {
              if (s && !validSpecialNotes.includes(s)) {
                // errors.push(`Invalid special note: '${s}'`);
                errors.push(
                  `Special note must be one of: ${validSpecialNotes.join(", ")}`,
                );
                return false;
              }
              return !!s;
            }) as SpecialNote[])
        : [];

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else {
        errorCount++;
        errorsList.push({ row: rowNumber, errors });
      }

      bookings.push({
        row: rowNumber,
        pnr,
        firstName,
        lastName,
        email,
        phone,
        travelClass: travelClassRaw as TravelClass,
        adults: adultsRaw,
        children: childrenRaw,
        specialNotes,
        additionalNotes,
      });
    });

    // Check for duplicate PNRs in the database
    const existingBookings =
      await this.cancelledFlightsRepository.findBookingsByFlightIdAndPnrs(
        flightId,
        Array.from(pnrSet),
        requestLogger,
      );

    existingBookings.forEach((bookingEntity: BookingEntity) => {
      const row = bookings.find((b) => b.pnr === bookingEntity.pnr);
      if (row) {
        errorsList.push({
          row: row.row,
          errors: [`PNR '${bookingEntity.pnr}' already exists for this flight`],
        });
        errorCount++;
      }
    });

    if (errorCount > 0) {
      requestLogger.warn("Booking import has rows with validation errors", {
        context: this.context,
        flightId,
        totalRows: bookings.length,
        errorCount,
        validCount,
      });
    }

    const toSave: {
      cancelledFlightId: number;
      pnr: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      travelClass: TravelClass;
      adults: number;
      children: number;
      specialNotes: SpecialNote[];
      additionalNotes: string | null;
    }[] = bookings.map((b) => ({
      cancelledFlightId: flightId,
      pnr: b.pnr,
      firstName: b.firstName,
      lastName: b.lastName,
      email: b.email,
      phone: b.phone,
      travelClass: b.travelClass,
      adults: b.adults,
      children: b.children,
      specialNotes: b.specialNotes,
      additionalNotes: b.additionalNotes,
    }));

    const bookingFlights = await this.cancelledFlightsRepository.saveBookings(
      toSave,
      requestLogger,
    );

    if (bookingFlights.length > 0) {
      await this.markFlightInProgressIfDraft(flight, requestLogger);
    }

    requestLogger.info("Booking import completed", {
      context: this.context,
      flightId,
      totalRows: bookings.length,
      validBookings: validCount,
      errorBookings: errorCount,
      savedBookings: bookingFlights.length,
    });

    return {
      bookings: bookingFlights.map((b) => this.toBookingResponse(b)),
      summary: {
        totalBookings: bookings.length,
        validBookings: validCount,
        errorBookings: errorCount,
      },
      errorList: errorsList,
    };
  }

  // ── Update booking ───────────────────────────────────────────────────────

  async updateBooking(
    flightId: number,
    bookingId: number,
    dto: UpdateBookingDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<BookingResponseDto> {
    await this.requireFlight(flightId, requestLogger);
    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestLogger,
    );

    if (dto.pnr && dto.pnr !== booking.pnr) {
      const conflict =
        await this.cancelledFlightsRepository.findBookingByPnrAndFlight(
          dto.pnr,
          flightId,
          requestLogger,
        );
      if (conflict) {
        requestLogger.warn(
          "Rejected booking update: PNR already exists for flight",
          { context: this.context, flightId, bookingId, pnr: dto.pnr },
        );
        throw new ConflictException(
          `Booking with PNR '${dto.pnr}' already exists for this flight`,
        );
      }
    }

    const updated = await this.cancelledFlightsRepository.updateBooking(
      booking,
      {
        ...(dto.pnr !== undefined && { pnr: dto.pnr }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.travelClass !== undefined && {
          travelClass: dto.travelClass,
        }),
        ...(dto.adults !== undefined && { adults: dto.adults }),
        ...(dto.children !== undefined && { children: dto.children }),
        ...(dto.specialNotes !== undefined && {
          specialNotes: dto.specialNotes ?? [],
        }),
        ...(dto.additionalNotes !== undefined && {
          additionalNotes: dto.additionalNotes,
        }),
      },
      requestLogger,
    );

    requestLogger.info("Booking updated", {
      context: this.context,
      flightId,
      bookingId,
    });

    return this.toBookingResponse(updated);
  }

  // ── Delete booking ───────────────────────────────────────────────────────

  async deleteBooking(
    flightId: number,
    bookingId: number,
    requestId: string,
    requestLogger: Logger,
  ) {
    await this.requireFlight(flightId, requestLogger);
    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestLogger,
    );
    await this.cancelledFlightsRepository.deleteBooking(booking, requestLogger);
    requestLogger.info("Booking deleted", {
      context: this.context,
      flightId,
      bookingId,
    });
    return { message: "Booking deleted successfully" };
  }

  async listCancelledFlights(
    user: AuthenticatedUser,
    query: GetCancelledFlightsQueryDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<CancelledFlightListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const startDate = query.startDate;
    const endDate = query.endDate;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      requestLogger.warn(
        "Rejected cancelled flights query: startDate after endDate",
        { context: this.context, startDate, endDate },
      );
      throw new BadRequestException("startDate cannot be later than endDate");
    }

    let airlineScopeId: number | undefined;

    if (user.userType === UserType.AIRLINE) {
      airlineScopeId = user.airlineId;

      if (!airlineScopeId) {
        // Not a normal validation rejection — an authenticated airline user
        // should always have an airlineId, so this points at a data
        // integrity problem with the user's account, not bad input.
        requestLogger.error(
          "Authenticated airline user does not have an associated airlineId",
          { context: this.context, userId: user.sub },
        );
        throw new BadRequestException(
          "Authenticated airline user does not have an associated airlineId",
        );
      }

      if (query.airlineId && query.airlineId !== airlineScopeId) {
        requestLogger.warn(
          "Rejected cancelled flights query: airlineId filter for another airline",
          {
            context: this.context,
            requestedAirlineId: query.airlineId,
            ownAirlineId: airlineScopeId,
          },
        );
        throw new BadRequestException(
          "airlineId filter is not allowed for other airlines",
        );
      }
    } else {
      airlineScopeId = query.airlineId;
    }

    requestLogger.info(
      "Fetching cancelled flights with pagination and filters",
      {
        context: this.context,
        page,
        limit,
        status: query.status,
        search: query.search,
        airlineId: airlineScopeId,
        startDate,
        endDate,
      },
    );

    const { flights, totalCount } =
      await this.cancelledFlightsRepository.findFlightsWithPaginationAndFilters(
        {
          page,
          limit,
          status: query.status,
          search: query.search,
          airlineId: airlineScopeId,
          startDate,
          endDate,
        },
        requestLogger,
      );

    requestLogger.info("Cancelled flights fetched", {
      context: this.context,
      returnedCount: flights.length,
      totalCount,
    });

    return {
      cancelledFlights: flights.map((flight) => ({
        id: flight.id,
        flightNumber: flight.flightNumber,
        departureAirport: {
          id: flight.departureAirport.id,
          code: flight.departureAirport.iataCode,
          name: flight.departureAirport.name,
        },
        arrivalAirport: {
          id: flight.arrivalAirport.id,
          code: flight.arrivalAirport.iataCode,
          name: flight.arrivalAirport.name,
        },
        cancellationDate: flight.cancellationDate,
        totalBookings: flight.totalBooking ?? 0,
        totalPassengers:
          (flight.totalAdults ?? 0) + (flight.totalChildren ?? 0),
        totalCost: Number(flight.totalPrice ?? 0),
        status: flight.status,
      })),
      pagination: {
        currentPage: page,
        limit,
        totalCount,
      },
    };
  }

  // ── List bookings ────────────────────────────────────────────────────────
  async listBookings(
    flightId: number,
    pagination: PaginationQueryDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<CancelledFlightBookingsListResponseDto> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;

    await this.requireFlight(flightId, requestLogger);
    requestLogger.info("Fetching bookings for cancelled flight", {
      context: this.context,
      flightId,
      page,
      limit,
    });

    const { bookings, totalBookings } =
      await this.cancelledFlightsRepository.findBookingsByFlightIdWithPagination(
        flightId,
        page,
        limit,
        requestLogger,
      );

    if (totalBookings === 0) {
      requestLogger.info("No bookings found for cancelled flight", {
        context: this.context,
        flightId,
      });
    }

    return {
      bookings: bookings.map((b) => this.toBookingResponse(b)),
      totalBookings,
      currentPage: page,
      limit,
    };
  }

  // ── Review ───────────────────────────────────────────────────────────────
  async reviewFlight(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
  ): Promise<ReviewCancelledFlightResponseDto> {
    const [flight, bookingStats] = await Promise.all([
      this.cancelledFlightsRepository.findFlightWithRelations(
        flightId,
        requestLogger,
      ),
      this.cancelledFlightsRepository.findBookingStatsByFlightId(
        flightId,
        requestLogger,
      ),
    ]);

    if (!flight) {
      requestLogger.warn("Cancelled flight not found for review", {
        context: this.context,
        flightId,
      });
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    if (bookingStats.totalBookings === 0) {
      requestLogger.warn("Reviewing cancelled flight with no bookings yet", {
        context: this.context,
        flightId,
        status: flight.status,
      });
    }

    requestLogger.info("Cancelled flight review fetched", {
      context: this.context,
      flightId,
      status: flight.status,
      totalBookings: bookingStats.totalBookings,
    });

    return {
      flight: {
        id: flight.id,
        flightNumber: flight.flightNumber,
        airlineId: flight.airlineId,
        departureAirportId: flight.departureAirportId,
        arrivalAirportId: flight.arrivalAirportId,
        route: {
          departureAirport: {
            id: flight.departureAirport.id,
            code: flight.departureAirport.iataCode,
            name: flight.departureAirport.name,
          },
          arrivalAirport: {
            id: flight.arrivalAirport.id,
            code: flight.arrivalAirport.iataCode,
            name: flight.arrivalAirport.name,
          },
        },
        cancellationDate: flight.cancellationDate,
        cancellationReason: flight.cancellationReason ?? null,
        status: flight.status,
        createdAt: flight.createdAt.toISOString(),
        updatedAt: flight.updatedAt?.toISOString() ?? null,
      },
      summary: {
        totalBookings: bookingStats.totalBookings,
        totalAdults: bookingStats.totalAdults,
        totalChildren: bookingStats.totalChildren,
      },
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async markFlightInProgressIfDraft(
    flight: CancelledFlightEntity,
    requestLogger: Logger,
  ): Promise<void> {
    if (flight.status !== FlightStatus.DRAFT) {
      return;
    }

    requestLogger.info("Marking cancelled flight in_progress", {
      context: this.context,
      flightId: flight.id,
    });

    await this.cancelledFlightsRepository.updateFlightStatus({
      cancelledFlightEntity: flight,
      status: FlightStatus.IN_PROGRESS,
      passengerBookingStats: null,
      hotelBookingStats: null,
      requestLogger,
    });
  }

  private async requireFlight(flightId: number, requestLogger: Logger) {
    const flight = await this.cancelledFlightsRepository.findFlightById(
      flightId,
      requestLogger,
    );
    if (!flight) {
      requestLogger.warn("Cancelled flight not found", {
        context: this.context,
        flightId,
      });
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }
    return flight;
  }

  private async requireBookingForFlight(
    bookingId: number,
    flightId: number,
    requestLogger: Logger,
  ): Promise<BookingEntity> {
    const booking = await this.cancelledFlightsRepository.findBookingById(
      bookingId,
      requestLogger,
    );
    if (!booking || booking.cancelledFlightId !== flightId) {
      requestLogger.warn("Booking not found for flight", {
        context: this.context,
        bookingId,
        flightId,
      });
      throw new NotFoundException(
        `Booking '${bookingId}' not found for flight '${flightId}'`,
      );
    }
    return booking;
  }

  async confirmPassengerBookingDetails(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
  ): Promise<CancelledFlightResponseDto> {
    const [flight, bookingStats] = await Promise.all([
      this.cancelledFlightsRepository.findFlightWithRelations(
        flightId,
        requestLogger,
      ),
      this.cancelledFlightsRepository.findBookingStatsByFlightId(
        flightId,
        requestLogger,
      ),
    ]);
    if (!flight) {
      requestLogger.warn(
        "Cancelled flight not found for booking confirmation",
        {
          context: this.context,
          flightId,
        },
      );
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    if (flight.status !== FlightStatus.IN_PROGRESS) {
      requestLogger.warn(
        "Rejected passenger booking confirmation: flight not in_progress",
        { context: this.context, flightId, status: flight.status },
      );
      throw new BadRequestException(
        `Cannot confirm passenger booking details for flight '${flightId}' with status '${flight.status}'`,
      );
    }

    if (bookingStats.totalBookings === 0) {
      requestLogger.warn(
        "Rejected passenger booking confirmation: no bookings on flight",
        { context: this.context, flightId },
      );
      throw new BadRequestException(
        `Cannot confirm passenger booking details for flight '${flightId}' with no bookings`,
      );
    }

    const updatedFlight =
      await this.cancelledFlightsRepository.updateFlightStatus({
        cancelledFlightEntity: flight,
        status: FlightStatus.PASSENGERS_BOOKING_CONFIRMED,
        passengerBookingStats: {
          totalBookings: bookingStats.totalBookings,
          totalAdults: bookingStats.totalAdults,
          totalChildren: bookingStats.totalChildren,
        },
        hotelBookingStats: null, // No hotel booking stats at this point
        requestLogger,
      });

    requestLogger.info("Passenger booking details confirmed", {
      context: this.context,
      flightId,
    });

    return this.toCancelledFlightResponse(updatedFlight);
  }

  // ── List bookings ────────────────────────────────────────────────────────
  async listHotelBookings(
    flightId: number,
    pagination: PaginationQueryDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<CancelledFlightHotelBookingListResponseDto> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;

    await this.requireFlight(flightId, requestLogger);
    requestLogger.info("Fetching hotel bookings for cancelled flight", {
      context: this.context,
      flightId,
      page,
      limit,
    });

    const { hotelBookings, totalHotelBookings } =
      await this.cancelledFlightsRepository.findHotelBookingsByFlightIdWithPagination(
        flightId,
        page,
        limit,
        requestLogger,
      );

    if (totalHotelBookings === 0) {
      requestLogger.info("No hotel bookings found for cancelled flight", {
        context: this.context,
        flightId,
      });
    }

    return {
      hotelBookings: hotelBookings.map((h) => ({
        id: h.id,
        passengerBooking: {
          id: h.booking.id,
          pnr: h.booking.pnr,
          cancelledFlightId: h.booking.cancelledFlightId,
          firstName: h.booking.firstName,
          lastName: h.booking.lastName,
          email: h.booking.email,
          phone: h.booking.phone,
          travelClass: h.booking.travelClass,
          adults: h.booking.adults,
          children: h.booking.children,
        },
        cancelledFlightId: h.cancelledFlightId,
        hotelName: h.hotelName,
        rating: h.category,
        totalRooms: h.totalRooms,
        totalCost: h.totalPrice,
        reason: h.reason ?? null,
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.updatedAt?.toISOString() ?? null,
      })),
      totalHotelBookings: totalHotelBookings,
      currentPage: pagination.page || 1,
      limit: pagination.limit || 10,
    };
  }

  // ── Get single hotel booking detail ─────────────────────────────────────
  async getHotelBookingDetail(
    flightId: number,
    hotelBookingId: number,
    user: AuthenticatedUser,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelBookingDetailResponseDto> {
    const hotelBooking =
      await this.cancelledFlightsRepository.findHotelBookingById(
        hotelBookingId,
        requestLogger,
      );

    if (!hotelBooking || hotelBooking.cancelledFlightId !== flightId) {
      requestLogger.warn("Hotel booking not found for flight", {
        context: this.context,
        hotelBookingId,
        flightId,
      });
      throw new NotFoundException(
        `Hotel booking '${hotelBookingId}' not found for flight '${flightId}'`,
      );
    }

    if (
      user.userType === UserType.AIRLINE &&
      hotelBooking.cancelledFlight.airlineId !== user.airlineId
    ) {
      requestLogger.warn(
        "Rejected hotel booking detail access: airline mismatch",
        {
          context: this.context,
          hotelBookingId,
          flightId,
          userAirlineId: user.airlineId,
        },
      );
      throw new NotFoundException(
        `Hotel booking '${hotelBookingId}' not found for flight '${flightId}'`,
      );
    }

    const flight = hotelBooking.cancelledFlight;
    const includeMarginFields = user.userType !== UserType.AIRLINE;

    requestLogger.info("Hotel booking detail fetched", {
      context: this.context,
      hotelBookingId,
      flightId,
      includeMarginFields,
    });

    return {
      id: hotelBooking.id,
      flight: {
        id: flight.id,
        flightNumber: flight.flightNumber,
        airlineId: flight.airlineId,
        departureAirportId: flight.departureAirportId,
        arrivalAirportId: flight.arrivalAirportId,
        cancellationDate: flight.cancellationDate,
        cancellationReason: flight.cancellationReason ?? null,
        status: flight.status,
        createdAt: flight.createdAt.toISOString(),
        updatedAt: flight.updatedAt?.toISOString() ?? null,
        route: {
          departureAirport: {
            id: flight.departureAirport.id,
            code: flight.departureAirport.iataCode,
            name: flight.departureAirport.name,
          },
          arrivalAirport: {
            id: flight.arrivalAirport.id,
            code: flight.arrivalAirport.iataCode,
            name: flight.arrivalAirport.name,
          },
        },
      },
      booking: this.toBookingResponse(hotelBooking.booking),
      hotel: {
        hotelCode: hotelBooking.hotelCode,
        hotelName: hotelBooking.hotelName,
        category: hotelBooking.category,
        address: hotelBooking.address ?? null,
        contact: hotelBooking.contact ?? null,
        latitude: hotelBooking.latitude ?? null,
        longitude: hotelBooking.longitude ?? null,
        distanceFromAirportKm: hotelBooking.distanceFromAirportKm ?? null,
        imageUrl: hotelBooking.imageUrl ?? null,
        website: hotelBooking.website ?? null,
        amenities: hotelBooking.amenities ?? null,
        checkInDate: hotelBooking.checkInDate,
        checkOutDate: hotelBooking.checkOutDate,
        rooms: hotelBooking.rooms ?? [],
        totalRooms: hotelBooking.totalRooms,
        actualPrice: Number(hotelBooking.actualPrice),
        ...(includeMarginFields && {
          buyingPrice: Number(hotelBooking.buyingPrice),
        }),
        sellingPrice: Number(hotelBooking.sellingPrice),
        tax: Number(hotelBooking.tax),
        platformFeePercentage: Number(hotelBooking.platformFeePercentage),
        platformFee: Number(hotelBooking.platformFee),
        discount: Number(hotelBooking.discount),
        totalPrice: Number(hotelBooking.totalPrice),
        ...(includeMarginFields && {
          earnings: Number(hotelBooking.earnings),
        }),
        status: hotelBooking.status,
        bookingReference: hotelBooking.bookingReference,
        createdAt: hotelBooking.createdAt.toISOString(),
        updatedAt: hotelBooking.updatedAt?.toISOString() ?? null,
        reason: hotelBooking.reason ?? null,
      },
    };
  }

  // ── Hotel Summary of a cancelled flight ───────────────────────────────────────────────
  async hotelSummaryByFlight(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelSummaryCancelledFlightResponseDto> {
    const hotelSummary =
      await this.cancelledFlightsRepository.findHotelSummaryByFlightId(
        flightId,
        requestLogger,
      );

    if (!hotelSummary) {
      requestLogger.warn("Cancelled flight not found for hotel summary", {
        context: this.context,
        flightId,
      });
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    if (hotelSummary.totalRooms === 0) {
      requestLogger.info(
        "Hotel summary has no rooms allocated yet for flight",
        { context: this.context, flightId },
      );
    }

    return {
      summary: {
        totalBookings: hotelSummary.totalBookings,
        totalAdults: hotelSummary.totalAdults,
        totalChildren: hotelSummary.totalChildren,
        totalRooms: hotelSummary.totalRooms,
        totalHotelCost: hotelSummary.totalHotelCost,
        totalDiscount: hotelSummary.totalDiscount,
        totalHotelTax: hotelSummary.totalHotelTax,
        totalPlatformFee: hotelSummary.totalPlatformFee,
        totalPayable: hotelSummary.totalCost,
      },
    };
  }

  // ── Mark as paid ─────────────────────────────────────────────────────────

  async processPayment(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
  ): Promise<CancelledFlightResponseDto> {
    const flight = await this.requireFlight(flightId, requestLogger);

    if (flight.status !== FlightStatus.ALLOCATED) {
      requestLogger.warn(
        "Rejected payment processing: flight not in allocated status",
        { context: this.context, flightId, status: flight.status },
      );
      throw new BadRequestException(
        `Cannot process payment for flight '${flightId}' from status '${flight.status}'. Flight must be in 'allocated' status.`,
      );
    }

    const updatedFlight =
      await this.cancelledFlightsRepository.updateFlightStatus({
        cancelledFlightEntity: flight,
        status: FlightStatus.PAID,
        passengerBookingStats: {
          totalBookings: null,
          totalAdults: null,
          totalChildren: null,
        },
        hotelBookingStats: null,
        requestLogger,
      });

    requestLogger.info("Payment processed for cancelled flight", {
      context: this.context,
      flightId,
    });

    return this.toCancelledFlightResponse(updatedFlight);
  }

  // ── Publish ──────────────────────────────────────────────────────────────

  async publishFlight(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
  ): Promise<CancelledFlightResponseDto> {
    const flight = await this.requireFlight(flightId, requestLogger);

    if (flight.status !== FlightStatus.PAID) {
      requestLogger.warn("Rejected flight publish: flight not in paid status", {
        context: this.context,
        flightId,
        status: flight.status,
      });
      throw new BadRequestException(
        `Cannot publish flight '${flightId}' from status '${flight.status}'. Flight must be in 'paid' status.`,
      );
    }

    const updatedFlight =
      await this.cancelledFlightsRepository.updateFlightStatus({
        cancelledFlightEntity: flight,
        status: FlightStatus.PUBLISHED,
        passengerBookingStats: {
          totalBookings: null,
          totalAdults: null,
          totalChildren: null,
        },
        hotelBookingStats: null,
        requestLogger,
      });

    requestLogger.info("Cancelled flight published", {
      context: this.context,
      flightId,
    });

    // const bookings =
    //   await this.cancelledFlightsRepository.findBookingsByFlightId(
    //     flightId,
    //     requestId,
    //   );

    // await Promise.all(
    //   bookings.map((booking) =>
    //     this.sendFlightPublishedEmail(
    //       booking.email,
    //       `${booking.firstName} ${booking.lastName}`,
    //       updatedFlight.flightNumber,
    //       requestId,
    //       requestLogger,
    //     ),
    //   ),
    // );

    return this.toCancelledFlightResponse(updatedFlight);
  }

  // private async sendFlightPublishedEmail(
  //   recipientEmail: string,
  //   passengerName: string,
  //   flightNumber: string,
  //   requestId: string,
  //   requestLogger: Logger,
  // ): Promise<void> {
  //   try {
  //     await this.sesClient.send(
  //       new SendEmailCommand({
  //         Source: config.ses.fromEmail,
  //         Destination: {
  //           ToAddresses: [recipientEmail],
  //         },
  //         Message: {
  //           Subject: {
  //             Data: `Hotel arrangements confirmed for cancelled flight ${flightNumber}`,
  //           },
  //           Body: {
  //             Text: {
  //               Data: `Dear ${passengerName}, your hotel arrangements for cancelled flight ${flightNumber} have been confirmed. Please check your email for further details.`,
  //             },
  //           },
  //         },
  //       }),
  //     );
  //   } catch (error: any) {
  //     requestLogger.error(
  //       `Failed to send flight published email to '${recipientEmail}'`,
  //       {
  //         context: this.context,
  //         requestId,
  //         recipientEmail,
  //         flightNumber,
  //         error: error?.message,
  //       },
  //     );
  //   }
  // }

  // async allocateHotel(
  //   flightId: number,
  //   bookingId: number,
  //   dto: AllocateHotelDto,
  //   requestId: string,
  // ) {
  //   await this.requireFlight(flightId, requestId);
  //   await this.requireBookingForFlight(bookingId, flightId, requestId);

  //   const allocation =
  //     await this.cancelledFlightsRepository.saveHotelAllocation(
  //       {
  //         cancelledFlightId: flightId,
  //         hotelName: dto.hotelName,
  //         hotelAddress: dto.hotelAddress ?? null,
  //         checkInDate: dto.checkInDate,
  //         checkOutDate: dto.checkOutDate,
  //         totalRooms: dto.totalRooms,
  //         costPerRoom: dto.costPerRoom,
  //       },
  //       requestId,
  //     );

  //   this.logger.info("Hotel allocated to booking", this.context, requestId, {
  //     flightId,
  //     bookingId,
  //     allocationId: allocation.id,
  //     hotelName: dto.hotelName,
  //   });

  //   return {
  //     message: "Hotel allocated successfully",
  //     allocation: {
  //       id: allocation.id,
  //       hotelName: allocation.hotelName,
  //       hotelAddress: allocation.hotelAddress,
  //       checkInDate: allocation.checkInDate,
  //       checkOutDate: allocation.checkOutDate,
  //       totalRooms: allocation.totalRooms,
  //       costPerRoom: allocation.costPerRoom,
  //     },
  //   };
  // }

  // async checkRate(
  //   flightId: number,
  //   bookingId: number,
  //   rateKey: string,
  //   requestId: string,
  // ) {
  //   this.logger.info(
  //     `Checking rate for flight: ${flightId}, booking: ${bookingId}`,
  //     this.context,
  //     requestId,
  //   );
  //   await this.requireFlight(flightId, requestId);
  //   await this.requireBookingForFlight(bookingId, flightId, requestId);

  //   const result = await this.hotelPartnerService.checkRate(rateKey, requestId);
  //   return result;
  // }

  // async bookHotel(
  //   flightId: number,
  //   bookingId: number,
  //   dto: BookHotelRequestDto,
  //   requestId: string,
  // ) {
  //   this.logger.info(
  //     `Booking hotel for flight: ${flightId}, booking: ${bookingId}`,
  //     this.context,
  //     requestId,
  //   );

  //   const flight =
  //     await this.cancelledFlightsRepository.findFlightWithRelations(
  //       flightId,
  //       requestId,
  //     );
  //   if (!flight) {
  //     throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
  //   }

  //   const booking = await this.requireBookingForFlight(
  //     bookingId,
  //     flightId,
  //     requestId,
  //   );

  //   // 1. Call CheckRate API first to validate that rate exists and is still bookable
  //   const checkRateResult = await this.hotelPartnerService.checkRate(
  //     dto.rateKey,
  //     requestId,
  //   );
  //   const hotel = checkRateResult.hotel;
  //   if (!hotel) {
  //     throw new BadRequestException(
  //       "Hotel details not returned from CheckRate validation",
  //     );
  //   }

  //   // Determine room details and pricing from CheckRate validation response
  //   const hotelName = hotel.name;
  //   const hotelAddress = hotel.address || null;
  //   const totalRooms = hotel.rooms?.length || 1;

  //   // Read net price from first rate of first room
  //   const rateInfo = hotel.rooms?.[0]?.rates?.[0];
  //   const costPerRoom = rateInfo ? Number(rateInfo.net) : 0;

  //   // Resolve dates
  //   const checkIn = flight.cancellationDate;
  //   if (!checkIn) {
  //     throw new BadRequestException(
  //       `Cancellation date not found for flight '${flightId}'`,
  //     );
  //   }
  //   const checkInDateObj = new Date(checkIn);
  //   const finalCheckOutDateObj = new Date(checkInDateObj);
  //   finalCheckOutDateObj.setDate(finalCheckOutDateObj.getDate() + 1);
  //   const finalCheckOut = finalCheckOutDateObj.toISOString().split("T")[0];

  //   // 2. Perform live booking via Hotelbeds
  //   // TODO: Fix the return type of bookHotel to include the booking reference and status
  //   const bookingResult: {
  //     bookingReference: string;
  //     status: HotelAllocationStatus;
  //     hotelName: string;
  //     hotelAddress: string;
  //     checkInDate: string;
  //     checkOutDate: string;
  //     totalRooms: number;
  //     costPerRoom: number;
  //     price: number;
  //     buyingPrice: number;
  //   } = await this.hotelPartnerService.bookHotel(
  //     {
  //       firstName: booking.firstName,
  //       lastName: booking.lastName,
  //       bookingId: booking.id,
  //       pnr: booking.pnr,
  //     },
  //     dto.rateKey,
  //     dto.paymentData,
  //     requestId,
  //   );

  //   if (!bookingResult) {
  //     throw new BadRequestException(
  //       "Booking response did not contain confirmation details",
  //     );
  //   }

  //   // 3. Save hotel allocation in database
  //   // TODO: Selling price, platform fee and earnings calculations should be handled here based on business logic
  //   const allocation =
  //     await this.cancelledFlightsRepository.saveHotelAllocation(
  //       {
  //         cancelledFlightId: flightId,
  //         bookingId: bookingId,
  //         hotelName: hotelName,
  //         hotelAddress: hotelAddress,
  //         checkInDate: checkIn,
  //         checkOutDate: finalCheckOut,
  //         totalRooms: totalRooms,
  //         costPerRoom: costPerRoom,
  //         bookingReference: bookingResult.bookingReference,
  //         status: bookingResult.status,
  //         rateKey: dto.rateKey,
  //         price: bookingResult.price,
  //         buyingPrice: bookingResult.buyingPrice,
  //         sellingPrice: bookingResult.price, // Assuming selling price is the same as price for now
  //       },
  //       requestId,
  //     );

  //   this.logger.info(
  //     "Hotel booking completed and allocated to booking",
  //     this.context,
  //     requestId,
  //     {
  //       flightId,
  //       bookingId,
  //       allocationId: allocation.id,
  //       bookingReference: allocation.bookingReference,
  //       status: allocation.status,
  //     },
  //   );

  //   return {
  //     message: "Hotel booked and allocated successfully",
  //     allocation: {
  //       id: allocation.id,
  //       hotelName: allocation.hotelName,
  //       hotelAddress: allocation.hotelAddress,
  //       checkInDate: allocation.checkInDate,
  //       checkOutDate: allocation.checkOutDate,
  //       totalRooms: allocation.totalRooms,
  //       costPerRoom: allocation.costPerRoom,
  //       bookingReference: allocation.bookingReference,
  //       status: allocation.status,
  //     },
  //   };
  // }
}
