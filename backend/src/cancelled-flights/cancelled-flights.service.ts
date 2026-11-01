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
import {
  BOOKING_PNR_UNIQUE_INDEX,
  BookingEntity,
} from "./entities/booking.entity";
import { QueryFailedError } from "typeorm";
import {
  CancellationReason,
  FlightStatus,
  HotelAllocationStatus,
} from "./entities/enums";
import {
  CreateCancelledFlightDto,
  UpdateCancelledFlightDto,
  CreateBookingDto,
  BookingResponseDto,
  UpdateBookingDto,
  CancelledFlightResponseDto,
  CancelledFlightListResponseDto,
  CancelledFlightAdminListResponseDto,
  CancelledFlightListItemDto,
  CancelledFlightAdminListItemDto,
  CancelledFlightShortListItemDto,
  CancelledFlightShortListResponseDto,
  ImportBookingResponseDto,
  FailedBookingDto,
  FailedBookingListResponseDto,
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
import { GetCancelledFlightsSummaryQueryDto } from "./dto/get-cancelled-flights-summary-query.dto";
import { CancelledFlightsSummaryResponseDto } from "./dto/cancelled-flights-summary-response.dto";
import { request } from "http";
import { config } from "../config/config";
import { StayDates, stayDatesError, todayIn } from "./stay-dates";
import {
  FLIGHT_PAYMENT_STEP_ENABLED,
  PUBLISHABLE_FLIGHT_STATUSES,
} from "./cancelled-flights.constants";
import { CancelledFlightBookingsListResponseDto } from "./dto/cancelled-flight-bookings-list-response.dto";
import { PdfService } from "../common/pdf/pdf.service";
import {
  buildHotelAllocationReportHtml,
  HotelAllocationReportRow,
} from "./templates/hotel-allocation-report.template";
import { HotelAllocationRecord } from "./hotel-allocation.record";
import { BookingImportFailureEntity } from "./entities/booking-import-failure.entity";
import {
  BookingCsvFormatError,
  ParsedBookingRow,
  bookingRuleErrors,
  matchesSavedBooking,
  parseBookingCsv,
} from "./booking-import";
import { normalizeNotes } from "./booking-notes";
import { normalizePnr } from "./dto/create-booking-request.dto";

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
    private readonly pdfService: PdfService,
  ) {}

  /**
   * Hotel stay rules (stay-dates.ts), with "today" taken at the departure
   * airport: the hotels are there, and near midnight its date can differ from
   * the server's or the operator's.
   */
  private async assertValidStayDates(
    stay: StayDates,
    departureAirportId: number,
    requestLogger: Logger,
  ): Promise<void> {
    const airport =
      await this.cancelledFlightsRepository.findAirportTimezone(
        departureAirportId,
      );
    if (!airport) {
      throw new BadRequestException("Departure airport not found");
    }

    const error = stayDatesError(stay, {
      today: todayIn(airport.timezone),
      airportCode: airport.iataCode,
      maxNights: config.stay.maxNights,
      maxCheckInDaysAhead: config.stay.maxCheckInDaysAhead,
    });
    if (error) {
      requestLogger.warn("Rejected cancelled flight stay dates", {
        context: this.context,
        departureAirportId,
        timezone: airport.timezone,
        ...stay,
        error,
      });
      throw new BadRequestException(error);
    }
  }

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
      checkInDate: flight.checkInDate,
      checkOutDate: flight.checkOutDate,
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
      residency: booking.residency,
      travelClass: booking.travelClass,
      adults: booking.adults,
      children: booking.children,
      childAges: booking.childAges ?? [],
      specialNotes: booking.specialNotes ?? null,
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

    await this.assertValidStayDates(
      {
        cancellationDate: dto.cancellationDate,
        checkInDate: dto.checkInDate,
        checkOutDate: dto.checkOutDate,
      },
      dto.departureAirportId,
      requestLogger,
    );

    const flight = await this.cancelledFlightsRepository.createFlight(
      {
        flightNumber: dto.flightNumber,
        airlineId: airlineId,
        departureAirportId: dto.departureAirportId,
        arrivalAirportId: dto.arrivalAirportId,
        cancellationDate: dto.cancellationDate,
        checkInDate: dto.checkInDate,
        checkOutDate: dto.checkOutDate,
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
      dto.checkInDate !== undefined ||
      dto.checkOutDate !== undefined ||
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

    // Stay rules on the new values combined with the stored ones, only when a
    // field they depend on changes (so editing e.g. the flight number never
    // fails because a stored check-in date has passed).
    if (
      dto.cancellationDate !== undefined ||
      dto.checkInDate !== undefined ||
      dto.checkOutDate !== undefined ||
      dto.departureAirportId !== undefined
    ) {
      await this.assertValidStayDates(
        {
          cancellationDate: dto.cancellationDate ?? flight.cancellationDate,
          checkInDate: dto.checkInDate ?? flight.checkInDate,
          checkOutDate: dto.checkOutDate ?? flight.checkOutDate,
        },
        nextDepartureAirportId,
        requestLogger,
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
    if (dto.checkInDate !== undefined) {
      flight.checkInDate = dto.checkInDate;
    }
    if (dto.checkOutDate !== undefined) {
      flight.checkOutDate = dto.checkOutDate;
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
    const payload = await this.validatedBookingPayload(
      flightId,
      dto,
      requestLogger,
    );

    const booking = await this.guardDuplicatePnr(
      () =>
        this.cancelledFlightsRepository.createBooking(payload, requestLogger),
      `Booking with PNR '${payload.pnr}' already exists for this flight`,
      flightId,
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

  /**
   * A new booking's row values, after the rules the DTO can't express: the
   * passenger limit, one age per child and a PNR not already on the flight.
   */
  private async validatedBookingPayload(
    flightId: number,
    dto: CreateBookingDto,
    requestLogger: Logger,
  ): Promise<Partial<BookingEntity>> {
    const childAges = dto.childAges ?? [];
    this.assertBookingRules(
      dto.pnr,
      { adults: dto.adults, children: dto.children, childAges },
      flightId,
      requestLogger,
    );

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

    return {
      cancelledFlightId: flightId,
      pnr: dto.pnr,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      residency: dto.residency,
      travelClass: dto.travelClass,
      adults: dto.adults,
      children: dto.children,
      childAges,
      specialNotes: normalizeNotes(dto.specialNotes),
    };
  }

  /**
   * Runs a booking write; when the unique PNR index rejects it (another
   * request saved the same PNR between our check and this write), answers
   * 409 with `message` instead of a database error.
   */
  private async guardDuplicatePnr<T>(
    write: () => Promise<T>,
    message: string,
    flightId: number,
    requestLogger: Logger,
  ): Promise<T> {
    try {
      return await write();
    } catch (error) {
      const driverError = (
        error as { driverError?: { code?: string; constraint?: string } }
      ).driverError;
      if (
        error instanceof QueryFailedError &&
        driverError?.code === "23505" &&
        driverError.constraint === BOOKING_PNR_UNIQUE_INDEX
      ) {
        requestLogger.warn("Rejected booking write: PNR saved concurrently", {
          context: this.context,
          flightId,
        });
        throw new ConflictException(message);
      }
      throw error;
    }
  }

  private assertBookingRules(
    pnr: string,
    counts: { adults: number; children: number; childAges: number[] },
    flightId: number,
    requestLogger: Logger,
  ): void {
    const errors = bookingRuleErrors(
      counts,
      config.booking.maxPassengersPerPnr,
    );
    if (errors.length === 0) return;

    requestLogger.warn("Rejected booking: passenger counts invalid", {
      context: this.context,
      flightId,
      pnr,
      adults: counts.adults,
      children: counts.children,
      childAges: counts.childAges.length,
      maxPassengers: config.booking.maxPassengersPerPnr,
    });
    throw new BadRequestException(
      errors.map((error) => error.message).join(". "),
    );
  }

  // ── Import bookings (CSV) ────────────────────────────────────────────────

  /**
   * Imports every valid row as a booking and keeps every invalid row as a
   * failed booking, with its errors, to fix or delete later. A bad row never
   * stops the others; only a file that can't be read as a bookings CSV is
   * rejected as a whole (see booking-import.ts).
   */
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

    let rows: ParsedBookingRow[];
    try {
      rows = parseBookingCsv(
        file.buffer.toString("utf-8"),
        config.booking.maxPassengersPerPnr,
      );
    } catch (error) {
      if (error instanceof BookingCsvFormatError) {
        requestLogger.warn("Rejected booking import: file format", {
          context: this.context,
          flightId,
          reason: error.message,
        });
        throw new BadRequestException(
          `${error.message} Nothing was imported.`,
        );
      }
      throw error;
    }

    // A PNR already on the flight: the same details again (the file uploaded
    // again) is skipped; different details fail the row.
    const validPnrs = rows
      .filter((row) => row.booking)
      .map((row) => row.booking!.pnr);
    const existing = validPnrs.length
      ? await this.cancelledFlightsRepository.findBookingsByFlightIdAndPnrs(
          flightId,
          validPnrs,
          requestLogger,
        )
      : [];
    const existingByPnr = new Map(
      existing.map((b) => [normalizePnr(b.pnr), b]),
    );
    const skippedRows = new Set<ParsedBookingRow>();
    for (const row of rows) {
      const current = row.booking && existingByPnr.get(row.booking.pnr);
      if (!row.booking || !current) continue;
      if (matchesSavedBooking(row.booking, current)) {
        skippedRows.add(row);
      } else {
        row.errors.push({
          field: "pnr",
          message: `PNR '${row.booking.pnr}' already exists for this flight with different details`,
        });
        row.booking = null;
      }
    }

    const validRows = rows.filter(
      (row) => row.booking && !skippedRows.has(row),
    );
    const failedRows = rows.filter((row) => !row.booking);
    const fileName = file.originalname ? file.originalname.slice(0, 255) : null;
    // Earlier failed rows for a PNR in this file are replaced by this upload:
    // that row is now imported, skipped, or failed again with fresh errors.
    const filePnrs = [
      ...new Set(rows.map((row) => row.values.pnr).filter(Boolean)),
    ];

    const saved = await this.guardDuplicatePnr(
      () =>
        this.cancelledFlightsRepository.saveBookingImport(
          flightId,
          filePnrs,
          validRows.map((row) => ({
            cancelledFlightId: flightId,
            ...row.booking!,
          })),
          failedRows.map((row) => ({
            cancelledFlightId: flightId,
            fileName,
            rowNumber: row.rowNumber,
            values: row.values,
            errors: row.errors,
          })),
          requestLogger,
        ),
      "Another change added one of these PNRs to the flight at the same time. Nothing was imported; upload the file again.",
      flightId,
      requestLogger,
    );

    if (saved.bookings.length > 0) {
      await this.markFlightInProgressIfDraft(flight, requestLogger);
    }

    const logMeta = {
      context: this.context,
      flightId,
      totalRows: rows.length,
      importedBookings: saved.bookings.length,
      skippedRows: skippedRows.size,
      failedRows: saved.failures.length,
    };
    if (saved.failures.length > 0) {
      requestLogger.warn("Booking import has rows with validation errors", {
        ...logMeta,
        failedRowNumbers: failedRows.map((row) => row.rowNumber),
      });
    }
    requestLogger.info("Booking import completed", logMeta);

    return {
      bookings: saved.bookings.map((b) => this.toBookingResponse(b)),
      failedBookings: saved.failures.map((f) => this.toFailedBookingResponse(f)),
      summary: {
        totalBookings: rows.length,
        validBookings: saved.bookings.length,
        skippedBookings: skippedRows.size,
        errorBookings: saved.failures.length,
      },
    };
  }

  // ── Failed import rows ───────────────────────────────────────────────────

  async listImportFailures(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
  ): Promise<FailedBookingListResponseDto> {
    await this.requireFlight(flightId, requestLogger);
    const failures = await this.cancelledFlightsRepository.findImportFailures(
      flightId,
      requestLogger,
    );
    return {
      failedBookings: failures.map((f) => this.toFailedBookingResponse(f)),
    };
  }

  /**
   * Fixes a failed row: creates the booking from the corrected values (same
   * rules as adding one) and deletes the failed row, together.
   */
  async resolveImportFailure(
    flightId: number,
    failureId: number,
    dto: CreateBookingDto,
    requestId: string,
    requestLogger: Logger,
  ): Promise<BookingResponseDto> {
    const flight = await this.requireFlight(flightId, requestLogger);
    const payload = await this.validatedBookingPayload(
      flightId,
      dto,
      requestLogger,
    );

    const booking = await this.guardDuplicatePnr(
      () =>
        this.cancelledFlightsRepository.createBookingFromImportFailure(
          payload,
          failureId,
          requestLogger,
        ),
      `Booking with PNR '${payload.pnr}' already exists for this flight`,
      flightId,
      requestLogger,
    );
    if (!booking) {
      requestLogger.warn("Failed import row not found for flight", {
        context: this.context,
        flightId,
        failureId,
      });
      throw new NotFoundException(
        `Failed booking '${failureId}' not found for flight '${flightId}'`,
      );
    }

    await this.markFlightInProgressIfDraft(flight, requestLogger);

    requestLogger.info("Failed import row fixed and saved as booking", {
      context: this.context,
      flightId,
      failureId,
      bookingId: booking.id,
      pnr: booking.pnr,
    });
    return this.toBookingResponse(booking);
  }

  /** Deletes one failed row, or all of the flight's when failureId is omitted. */
  async deleteImportFailures(
    flightId: number,
    failureId: number | undefined,
    requestId: string,
    requestLogger: Logger,
  ): Promise<{ message: string; deleted: number }> {
    await this.requireFlight(flightId, requestLogger);
    const deleted = await this.cancelledFlightsRepository.deleteImportFailures(
      flightId,
      requestLogger,
      failureId,
    );
    if (failureId !== undefined && deleted === 0) {
      requestLogger.warn("Failed import row not found for flight", {
        context: this.context,
        flightId,
        failureId,
      });
      throw new NotFoundException(
        `Failed booking '${failureId}' not found for flight '${flightId}'`,
      );
    }
    requestLogger.info("Failed import rows deleted", {
      context: this.context,
      flightId,
      failureId: failureId ?? "all",
      deleted,
    });
    return {
      message:
        failureId === undefined
          ? `${deleted} failed booking(s) deleted`
          : "Failed booking deleted",
      deleted,
    };
  }

  private toFailedBookingResponse(
    failure: BookingImportFailureEntity,
  ): FailedBookingDto {
    return {
      id: failure.id,
      rowNumber: failure.rowNumber,
      fileName: failure.fileName ?? null,
      values: failure.values,
      errors: failure.errors,
      createdAt: failure.createdAt.toISOString(),
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

    // Counts are checked when any of them changes; untouched older bookings
    // (saved before child ages existed) can still have other fields edited.
    if (
      dto.adults !== undefined ||
      dto.children !== undefined ||
      dto.childAges !== undefined
    ) {
      this.assertBookingRules(
        dto.pnr ?? booking.pnr,
        {
          adults: dto.adults ?? booking.adults,
          children: dto.children ?? booking.children,
          childAges: dto.childAges ?? booking.childAges ?? [],
        },
        flightId,
        requestLogger,
      );
    }

    if (dto.pnr && dto.pnr !== booking.pnr) {
      const conflict =
        await this.cancelledFlightsRepository.findBookingByPnrAndFlight(
          dto.pnr,
          flightId,
          requestLogger,
        );
      if (conflict && conflict.id !== booking.id) {
        requestLogger.warn(
          "Rejected booking update: PNR already exists for flight",
          { context: this.context, flightId, bookingId, pnr: dto.pnr },
        );
        throw new ConflictException(
          `Booking with PNR '${dto.pnr}' already exists for this flight`,
        );
      }
    }

    const updated = await this.guardDuplicatePnr(
      () =>
        this.cancelledFlightsRepository.updateBooking(
          booking,
          {
            ...(dto.pnr !== undefined && { pnr: dto.pnr }),
            ...(dto.firstName !== undefined && { firstName: dto.firstName }),
            ...(dto.lastName !== undefined && { lastName: dto.lastName }),
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.phone !== undefined && { phone: dto.phone }),
            ...(dto.residency !== undefined && { residency: dto.residency }),
            ...(dto.travelClass !== undefined && {
              travelClass: dto.travelClass,
            }),
            ...(dto.adults !== undefined && { adults: dto.adults }),
            ...(dto.children !== undefined && { children: dto.children }),
            ...(dto.childAges !== undefined && { childAges: dto.childAges }),
            ...(dto.specialNotes !== undefined && {
              specialNotes: normalizeNotes(dto.specialNotes),
            }),
          },
          requestLogger,
        ),
      `Booking with PNR '${dto.pnr}' already exists for this flight`,
      flightId,
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
  ): Promise<
    | CancelledFlightListResponseDto
    | CancelledFlightAdminListResponseDto
    | CancelledFlightShortListResponseDto
  > {
    const page = query.page || 1;
    const limit = query.limit || 10;

    // YYYY-MM-DD calendar dates; format and order are validated by the DTO
    // (CalendarDateRangeQueryDto).
    const startDate = query.startDate;
    const endDate = query.endDate;

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

    const pagination = { currentPage: page, limit, totalCount };

    // shorten=true: only what a dropdown needs, same shape for all users.
    if (query.shorten) {
      return {
        cancelledFlights: flights.map((flight) => ({
          id: flight.id,
          flightNumber: flight.flightNumber,
          cancellationDate: flight.cancellationDate,
        })) satisfies CancelledFlightShortListItemDto[],
        pagination,
      };
    }

    const allocationStarted =
      await this.cancelledFlightsRepository.findFlightIdsWithHotelBookings(
        flights.map((flight) => flight.id),
      );

    // Platform users get the owning airline (id, name) and the hotel, room and
    // earnings figures on each item; airline users already know their own
    // airline and must not see platform earnings, so they get the base shape.
    if (user.userType === UserType.PLATFORM) {
      const hotelsByFlight =
        await this.cancelledFlightsRepository.countBookedHotelsByFlightIds(
          flights.map((flight) => flight.id),
        );
      return {
        cancelledFlights: flights.map((flight) => ({
          ...this.toCancelledFlightListItem(flight, allocationStarted),
          totalHotels: hotelsByFlight.get(flight.id) ?? 0,
          totalRooms: flight.totalHotelRooms ?? 0,
          totalEarnings: Number(flight.totalEarnings ?? 0),
          airline: {
            id: flight.airline.id,
            name: flight.airline.name,
          },
        })) satisfies CancelledFlightAdminListItemDto[],
        pagination,
      };
    }

    return {
      cancelledFlights: flights.map((flight) =>
        this.toCancelledFlightListItem(flight, allocationStarted),
      ) satisfies CancelledFlightListItemDto[],
      pagination,
    };
  }

  private toCancelledFlightListItem(
    flight: CancelledFlightEntity,
    allocationStarted: Set<number>,
  ): CancelledFlightListItemDto {
    return {
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
      totalPassengers: (flight.totalAdults ?? 0) + (flight.totalChildren ?? 0),
      totalCost: Number(flight.totalPrice ?? 0),
      // Allocation started but not every PNR booked yet: list it as in progress.
      status:
        flight.status === FlightStatus.PASSENGERS_BOOKING_CONFIRMED &&
        allocationStarted.has(flight.id)
          ? FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS
          : flight.status,
    };
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  async getCancelledFlightsSummary(
    user: AuthenticatedUser,
    query: GetCancelledFlightsSummaryQueryDto,
    requestLogger: Logger,
  ): Promise<CancelledFlightsSummaryResponseDto> {
    const startDate = query.startDate;
    const endDate = query.endDate;

    let airlineScopeId: number | undefined;
    let platformFeePercentage: number | null = null;

    if (user.userType === UserType.AIRLINE) {
      airlineScopeId = user.airlineId;

      if (!airlineScopeId) {
        requestLogger.error(
          "Authenticated airline user does not have an associated airlineId",
          { context: this.context, userId: user.sub },
        );
        throw new BadRequestException(
          "Authenticated airline user does not have an associated airlineId",
        );
      }

      // Airline users are always scoped to their own airline, so the
      // platform-only airlineId filter is ignored rather than rejected.
      if (query.airlineId !== undefined) {
        requestLogger.debug(
          "Ignoring airlineId filter on cancelled flights summary for airline user",
          {
            context: this.context,
            requestedAirlineId: query.airlineId,
            ownAirlineId: airlineScopeId,
          },
        );
      }

      platformFeePercentage =
        user.platformFeePercentage !== undefined &&
        user.platformFeePercentage !== null
          ? Number(user.platformFeePercentage)
          : null;
    } else {
      airlineScopeId = query.airlineId;
    }

    requestLogger.info("Fetching cancelled flights summary", {
      context: this.context,
      status: query.status,
      search: query.search,
      airlineId: airlineScopeId,
      startDate,
      endDate,
    });

    const summary =
      await this.cancelledFlightsRepository.getCancelledFlightsSummary(
        {
          status: query.status,
          search: query.search,
          airlineId: airlineScopeId,
          startDate,
          endDate,
        },
        requestLogger,
      );

    requestLogger.info("Cancelled flights summary fetched", {
      context: this.context,
      ...summary,
      platformFeePercentage,
    });

    return { ...summary, platformFeePercentage };
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
        checkInDate: flight.checkInDate,
        checkOutDate: flight.checkOutDate,
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

    // Failed CSV rows must be fixed or deleted first, so none is forgotten.
    const failedRows =
      await this.cancelledFlightsRepository.countImportFailures(
        flightId,
        requestLogger,
      );
    if (failedRows > 0) {
      requestLogger.warn(
        "Rejected passenger booking confirmation: failed import rows remain",
        { context: this.context, flightId, failedRows },
      );
      throw new BadRequestException(
        `${failedRows} failed booking(s) from a CSV import still need fixing or deleting before you continue`,
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
          residency: h.booking.residency,
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
        status: h.status,
        bookingReference:
          h.status === HotelAllocationStatus.CONFIRMED && h.bookingReference
            ? h.bookingReference
            : null,
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
        checkInDate: flight.checkInDate,
        checkOutDate: flight.checkOutDate,
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
        hotelPolicies: hotelBooking.hotelPolicies ?? null,
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
        paymentStatus: hotelBooking.paymentStatus,
        paidAt: hotelBooking.paidAt?.toISOString() ?? null,
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
    if (!FLIGHT_PAYMENT_STEP_ENABLED) {
      requestLogger.warn("Rejected payment processing: payment step disabled", {
        context: this.context,
        flightId,
      });
      throw new NotFoundException(
        "The payment step is disabled: hotel bookings are charged to the airline wallet as each PNR is booked. An allocated flight can be published directly.",
      );
    }

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

    if (
      !(await this.cancelledFlightsRepository.areAllPnrsHotelBooked(flightId))
    ) {
      requestLogger.warn(
        "Rejected payment processing: not every PNR has a confirmed hotel booking",
        { context: this.context, flightId },
      );
      throw new BadRequestException(
        `Cannot process payment for flight '${flightId}': every booking must have a confirmed hotel. Resolve failed or manual-check bookings first.`,
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

    if (!PUBLISHABLE_FLIGHT_STATUSES.includes(flight.status)) {
      requestLogger.warn("Rejected flight publish: flight not ready to publish", {
        context: this.context,
        flightId,
        status: flight.status,
      });
      throw new BadRequestException(
        `Cannot publish flight '${flightId}' from status '${flight.status}'. Flight must be in ${PUBLISHABLE_FLIGHT_STATUSES.map((status) => `'${status}'`).join(" or ")} status.`,
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

  // ── Hotel allocation invoice/report (PDF) ──────────────────────────────
  // Supplier room names carry booking-engine caveats in parentheses, e.g.
  // "Junior Suite (smoking, bed type is subject to availability)" - the
  // invoice only needs the room type itself.
  private simplifyRoomName(roomName: string): string {
    // Truncate at the first "(" rather than matching balanced pairs - some
    // suppliers nest parentheses (e.g. "Junior Suite (Smoking (subject to
    // availability))"), which a single-level regex can't close correctly
    // and leaves a stray ")" behind.
    const simplified = roomName.split("(")[0].trim();
    return simplified || roomName.trim();
  }

  private summarizeAllocationRooms(
    rooms: HotelAllocationRecord["rooms"],
  ): { adults: number; children: number; roomsSummary: string } {
    let adults = 0;
    let children = 0;
    const roomNames = new Set<string>();

    for (const room of rooms ?? []) {
      adults += room.adults ?? 0;
      children += room.children ?? 0;
      roomNames.add(
        room.roomName ? this.simplifyRoomName(room.roomName) : "Room",
      );
    }

    return {
      adults,
      children,
      roomsSummary: Array.from(roomNames).join(", ") || "-",
    };
  }

  async generateHotelAllocationReport(
    flightId: number,
    user: AuthenticatedUser,
    requestLogger: Logger,
  ): Promise<{ fileName: string; pdf: Buffer }> {
    const flight = await this.cancelledFlightsRepository.findFlightWithRelations(
      flightId,
      requestLogger,
    );

    if (!flight) {
      requestLogger.warn("Cancelled flight not found for report", {
        context: this.context,
        flightId,
      });
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    if (user.userType === UserType.AIRLINE && flight.airlineId !== user.airlineId) {
      requestLogger.warn("Rejected report access: airline mismatch", {
        context: this.context,
        flightId,
        userAirlineId: user.airlineId,
      });
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    const allowedStatuses = [
      FlightStatus.ALLOCATED,
      FlightStatus.PAID,
      FlightStatus.PUBLISHED,
    ];
    if (!allowedStatuses.includes(flight.status)) {
      requestLogger.warn("Rejected report generation: flight not allocated", {
        context: this.context,
        flightId,
        status: flight.status,
      });
      throw new BadRequestException(
        `Cannot generate the hotel allocation report for flight '${flightId}' from status '${flight.status}'. Flight must be 'allocated', 'paid', or 'published'.`,
      );
    }

    const allocations =
      await this.cancelledFlightsRepository.findAllHotelBookingsByFlightId(
        flightId,
        requestLogger,
      );

    const rows: HotelAllocationReportRow[] = allocations.map((allocation) => {
      const { adults, children, roomsSummary } = this.summarizeAllocationRooms(
        allocation.rooms,
      );

      return {
        hotelBookingId: allocation.id,
        pnr: allocation.booking.pnr,
        passengerName: `${allocation.booking.firstName} ${allocation.booking.lastName}`,
        adults,
        children,
        travelClass: allocation.booking.travelClass,
        hotelName: allocation.hotelName,
        hotelAddress: allocation.address ?? null,
        rating: allocation.category,
        roomsSummary,
        totalRooms: allocation.totalRooms,
        cost: Number(allocation.sellingPrice),
        totalCost: Number(allocation.totalPrice),
      };
    });

    const invoiceNumber = `FV-INV-${String(flight.id).padStart(6, "0")}`;
    const invoiceDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
    const cancellationDate = new Date(flight.cancellationDate).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "short", day: "2-digit" },
    );
    const statusLabel =
      flight.status.charAt(0).toUpperCase() + flight.status.slice(1);

    const html = buildHotelAllocationReportHtml({
      invoiceNumber,
      invoiceDate,
      currency: config.currency,
      airline: {
        name: flight.airline.name,
        code: flight.airline.code,
        address: flight.airline.address,
        contactEmail: flight.airline.contactEmail,
        contactPhone: flight.airline.contactPhone,
      },
      flight: {
        flightNumber: flight.flightNumber,
        departure: `${flight.departureAirport.iataCode} - ${flight.departureAirport.city}`,
        arrival: `${flight.arrivalAirport.iataCode} - ${flight.arrivalAirport.city}`,
        cancellationDate,
        statusLabel,
      },
      rows,
      totals: {
        totalBookings: allocations.length,
        totalRooms: flight.totalHotelRooms ?? 0,
        subtotal: Number(flight.totalSellingPrice ?? 0),
        tax: Number(flight.totalHotelTaxes ?? 0),
        platformFeePercentage: Number(flight.platformFeePercentage ?? 0),
        platformFee: Number(flight.totalPlatformFee ?? 0),
        grandTotal: Number(flight.totalPrice ?? 0),
      },
    });

    requestLogger.info("Rendering hotel allocation report PDF", {
      context: this.context,
      flightId,
      rowCount: rows.length,
    });

    const pdf = await this.pdfService.renderHtmlToPdf(html, requestLogger, {
      landscape: true,
    });

    requestLogger.info("Hotel allocation report generated", {
      context: this.context,
      flightId,
      rowCount: rows.length,
    });

    return {
      fileName: `invoice-${flight.flightNumber}-${flight.id}.pdf`,
      pdf,
    };
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

}
