import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as ExcelJS from "exceljs";
import { LoggerService } from "../common/logger/logger.service";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";
import { CreateCancelledFlightDto } from "./dto/create-cancelled-flight.dto";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { UpdateBookingDto } from "./dto/update-booking.dto";
import { ImportBookingsConfirmDto } from "./dto/import-bookings.dto";
import { BookingEntity } from "./entities/booking.entity";
import {
  CancellationReason,
  FlightStatus,
  SpecialNote,
  TravelClass,
} from "./entities/enums";
import { GroqService } from "../common/groq/groq.service";
import { HotelPartnerService } from "./hotel-partner.service";
import { AllocateHotelDto } from "./dto/allocate-hotel.dto";

@Injectable()
export class CancelledFlightsService {
  private readonly context = "CancelledFlightsService";

  constructor(
    private readonly repo: CancelledFlightsRepository,
    private readonly logger: LoggerService,
    private readonly groqService: GroqService,
    private readonly hotelPartnerService: HotelPartnerService,
  ) {}

  // ── Create cancelled flight ──────────────────────────────────────────────

  async createCancelledFlight(
    dto: CreateCancelledFlightDto,
    requestId: string,
  ) {
    if (dto.departure_airport_id === dto.arrival_airport_id) {
      throw new BadRequestException(
        "Departure and arrival airports must be different",
      );
    }

    const flight = await this.repo.createFlight(
      {
        flightNumber: dto.flight_number,
        airlineId: dto.airline_id,
        departureAirportId: dto.departure_airport_id,
        arrivalAirportId: dto.arrival_airport_id,
        cancellationDate: dto.cancellation_date,
        cancellationReason:
          (dto.cancellation_reason as CancellationReason) ?? null,
        cancellationReasonText: dto.cancellation_reason_text ?? null,
        status: FlightStatus.DRAFT,
      },
      requestId,
    );

    this.logger.info("Cancelled flight created", this.context, requestId, {
      flightId: flight.id,
      flightNumber: flight.flightNumber,
    });

    return {
      id: flight.id,
      flight_number: flight.flightNumber,
      status: flight.status,
      cancellation_date: flight.cancellationDate,
      created_at: flight.createdAt,
    };
  }

  // ── Add single booking ───────────────────────────────────────────────────

  async addBooking(flightId: string, dto: CreateBookingDto, requestId: string) {
    await this.requireFlight(flightId, requestId);

    const duplicate = await this.repo.findBookingByPnrAndFlight(
      dto.pnr,
      flightId,
      requestId,
    );
    if (duplicate) {
      throw new ConflictException(
        `Booking with PNR '${dto.pnr}' already exists for this flight`,
      );
    }

    const booking = await this.repo.createBooking(
      {
        cancelledFlightId: flightId,
        pnr: dto.pnr,
        firstName: dto.first_name,
        lastName: dto.last_name,
        email: dto.email,
        phone: dto.phone,
        travelClass: dto.travel_class,
        adults: dto.adults,
        children: dto.children,
        specialNotes: dto.special_notes ?? [],
        additionalNotes: dto.additional_notes ?? null,
      },
      requestId,
    );

    this.logger.info("Booking added", this.context, requestId, {
      flightId,
      bookingId: booking.id,
      pnr: booking.pnr,
    });

    return this.toBookingResponse(booking);
  }

  // ── Import preview ───────────────────────────────────────────────────────

  async previewImport(
    flightId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    requestId: string,
  ) {
    await this.requireFlight(flightId, requestId);

    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(file.buffer as any);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException("Excel file has no worksheets");
    }

    const preview: object[] = [];
    let validCount = 0;
    let errorCount = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const getValue = (col: number): string =>
        String(row.getCell(col).value ?? "").trim();

      const pnr = getValue(1);
      const first_name = getValue(2);
      const last_name = getValue(3);
      const email = getValue(4);
      const phone = getValue(5);
      const travel_class_raw = getValue(6).toLowerCase();
      const adults_raw = parseInt(getValue(7), 10);
      const children_raw = parseInt(getValue(8), 10);
      const special_notes_raw = getValue(9);
      const additional_notes = getValue(10) || null;

      const errors: string[] = [];

      if (!pnr) errors.push("PNR is required");
      if (!first_name) errors.push("First Name is required");
      if (!last_name) errors.push("Last Name is required");
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("Email is invalid");
      }
      if (!phone) errors.push("Phone is required");
      if (
        travel_class_raw !== TravelClass.ECONOMY &&
        travel_class_raw !== TravelClass.BUSINESS
      ) {
        errors.push("Travel Class must be 'economy' or 'business'");
      }
      if (isNaN(adults_raw) || adults_raw < 1) {
        errors.push("Adults must be a number >= 1");
      }
      if (isNaN(children_raw) || children_raw < 0) {
        errors.push("Children must be a number >= 0");
      }

      const validSpecialNotes = Object.values(SpecialNote) as string[];
      const special_notes: SpecialNote[] = special_notes_raw
        ? (special_notes_raw
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter((s) => {
              if (s && !validSpecialNotes.includes(s)) {
                errors.push(`Invalid special note: '${s}'`);
                return false;
              }
              return !!s;
            }) as SpecialNote[])
        : [];

      const is_valid = errors.length === 0;
      if (is_valid) validCount++;
      else errorCount++;

      const adults = is_valid ? adults_raw : 0;
      const children = is_valid ? children_raw : 0;

      preview.push({
        row: rowNumber,
        pnr,
        first_name,
        last_name,
        email,
        phone,
        travel_class: travel_class_raw as TravelClass,
        adults,
        children,
        est_rooms: is_valid ? Math.ceil((adults + children) / 2) : 0,
        special_notes,
        additional_notes,
        is_valid,
        errors,
      });
    });

    return {
      total_rows: preview.length,
      valid_count: validCount,
      error_count: errorCount,
      preview,
    };
  }

  // ── Confirm import ───────────────────────────────────────────────────────

  async confirmImport(
    flightId: string,
    dto: ImportBookingsConfirmDto,
    requestId: string,
  ) {
    await this.requireFlight(flightId, requestId);

    const skippedPnrs: string[] = [];
    const toSave: Partial<BookingEntity>[] = [];

    for (const row of dto.rows) {
      const existing = await this.repo.findBookingByPnrAndFlight(
        row.pnr,
        flightId,
        requestId,
      );
      if (existing) {
        skippedPnrs.push(row.pnr);
        continue;
      }
      toSave.push({
        cancelledFlightId: flightId,
        pnr: row.pnr,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        travelClass: row.travel_class,
        adults: row.adults,
        children: row.children,
        specialNotes: row.special_notes ?? [],
        additionalNotes: row.additional_notes ?? null,
      });
    }

    if (toSave.length > 0) {
      await this.repo.saveBookings(toSave, requestId);
    }

    this.logger.info("Bookings imported", this.context, requestId, {
      flightId,
      imported: toSave.length,
      skipped: skippedPnrs.length,
    });

    return {
      imported: toSave.length,
      skipped: skippedPnrs.length,
      skipped_pnrs: skippedPnrs,
    };
  }

  // ── Update booking ───────────────────────────────────────────────────────

  async updateBooking(
    flightId: string,
    bookingId: string,
    dto: UpdateBookingDto,
    requestId: string,
  ) {
    await this.requireFlight(flightId, requestId);
    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestId,
    );

    if (dto.pnr && dto.pnr !== booking.pnr) {
      const conflict = await this.repo.findBookingByPnrAndFlight(
        dto.pnr,
        flightId,
        requestId,
      );
      if (conflict) {
        throw new ConflictException(
          `Booking with PNR '${dto.pnr}' already exists for this flight`,
        );
      }
    }

    const updated = await this.repo.updateBooking(
      booking,
      {
        ...(dto.pnr !== undefined && { pnr: dto.pnr }),
        ...(dto.first_name !== undefined && { firstName: dto.first_name }),
        ...(dto.last_name !== undefined && { lastName: dto.last_name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.travel_class !== undefined && {
          travelClass: dto.travel_class,
        }),
        ...(dto.adults !== undefined && { adults: dto.adults }),
        ...(dto.children !== undefined && { children: dto.children }),
        ...(dto.special_notes !== undefined && {
          specialNotes: dto.special_notes,
        }),
        ...(dto.additional_notes !== undefined && {
          additionalNotes: dto.additional_notes,
        }),
      },
      requestId,
    );

    return this.toBookingResponse(updated);
  }

  // ── Delete booking ───────────────────────────────────────────────────────

  async deleteBooking(flightId: string, bookingId: string, requestId: string) {
    await this.requireFlight(flightId, requestId);
    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestId,
    );
    await this.repo.deleteBooking(booking, requestId);
    return { message: "Booking deleted successfully" };
  }

  // ── List bookings ────────────────────────────────────────────────────────

  async listBookings(flightId: string, requestId: string) {
    await this.requireFlight(flightId, requestId);
    const bookings = await this.repo.findBookingsByFlightId(
      flightId,
      requestId,
    );

    const summary = this.computeSummary(bookings);

    return {
      summary,
      bookings: bookings.map((b) => this.toBookingResponse(b)),
    };
  }

  // ── Review ───────────────────────────────────────────────────────────────

  async reviewFlight(flightId: string, requestId: string) {
    const flight = await this.repo.findFlightWithRelations(flightId, requestId);
    if (!flight) {
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    const summary = this.computeSummary(flight.bookings ?? []);

    return {
      flight: {
        id: flight.id,
        flight_number: flight.flightNumber,
        route: {
          departure: {
            id: flight.departureAirport.id,
            code: flight.departureAirport.iataCode,
            name: flight.departureAirport.name,
          },
          arrival: {
            id: flight.arrivalAirport.id,
            code: flight.arrivalAirport.iataCode,
            name: flight.arrivalAirport.name,
          },
        },
        cancellation_date: flight.cancellationDate,
        cancellation_reason: flight.cancellationReason ?? null,
        status: flight.status,
      },
      summary: {
        total_bookings: summary.total_bookings,
        total_passengers: summary.total_passengers,
        est_rooms_required: summary.est_rooms,
        business_class_count: summary.business_count,
      },
      bookings: (flight.bookings ?? []).map((b) => ({
        pnr: b.pnr,
        contact: `${b.firstName} ${b.lastName}`,
        email: b.email,
        adults: b.adults,
        children: b.children,
        travel_class: b.travelClass,
        est_rooms: Math.ceil((b.adults + b.children) / 2),
      })),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async requireFlight(flightId: string, requestId: string) {
    const flight = await this.repo.findFlightById(flightId, requestId);
    if (!flight) {
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }
    return flight;
  }

  private async requireBookingForFlight(
    bookingId: string,
    flightId: string,
    requestId: string,
  ): Promise<BookingEntity> {
    const booking = await this.repo.findBookingById(bookingId, requestId);
    if (!booking || booking.cancelledFlightId !== flightId) {
      throw new NotFoundException(
        `Booking '${bookingId}' not found for flight '${flightId}'`,
      );
    }
    return booking;
  }

  private toBookingResponse(booking: BookingEntity) {
    return {
      id: booking.id,
      cancelled_flight_id: booking.cancelledFlightId,
      pnr: booking.pnr,
      first_name: booking.firstName,
      last_name: booking.lastName,
      email: booking.email,
      phone: booking.phone,
      travel_class: booking.travelClass,
      adults: booking.adults,
      children: booking.children,
      est_rooms: Math.ceil((booking.adults + booking.children) / 2),
      special_notes: booking.specialNotes ?? [],
      additional_notes: booking.additionalNotes ?? null,
      created_at: booking.createdAt,
    };
  }

  private computeSummary(bookings: BookingEntity[]) {
    const total_bookings = bookings.length;
    const total_passengers = bookings.reduce(
      (sum, b) => sum + b.adults + b.children,
      0,
    );
    const est_rooms = bookings.reduce(
      (sum, b) => sum + Math.ceil((b.adults + b.children) / 2),
      0,
    );
    const business_count = bookings.filter(
      (b) => b.travelClass === TravelClass.BUSINESS,
    ).length;
    return { total_bookings, total_passengers, est_rooms, business_count };
  }

  // ── AI Hotel Recommendations & Allocation ───────────────────────────────

  async getHotelRecommendations(flightId: string, bookingId: string, requestId: string) {
    const flight = await this.repo.findFlightWithRelations(flightId, requestId);
    if (!flight) {
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    const booking = await this.requireBookingForFlight(bookingId, flightId, requestId);

    const departureAirport = flight.departureAirport || {
      iataCode: "LAX",
      latitude: 33.9416,
      longitude: -118.4085,
    };

    // Calculate stay dates: check-in is flight cancellation date, check-out is check-in + 1 day
    const checkIn = flight.cancellationDate || new Date().toISOString().split("T")[0];
    const checkInDateObj = new Date(checkIn);
    const finalCheckIn = isNaN(checkInDateObj.getTime())
      ? new Date().toISOString().split("T")[0]
      : checkIn;
    
    const finalCheckInDateObj = new Date(finalCheckIn);
    finalCheckInDateObj.setDate(finalCheckInDateObj.getDate() + 1);
    const finalCheckOut = finalCheckInDateObj.toISOString().split("T")[0];

    const candidateHotels = await this.hotelPartnerService.searchNearbyHotels(
      {
        iataCode: departureAirport.iataCode,
        latitude: Number(departureAirport.latitude),
        longitude: Number(departureAirport.longitude),
      },
      finalCheckIn,
      finalCheckOut,
      requestId,
    );

    const groqResult = await this.groqService.getHotelRecommendations(
      {
        firstName: booking.firstName,
        lastName: booking.lastName,
        travelClass: booking.travelClass,
        adults: booking.adults,
        children: booking.children,
        specialNotes: booking.specialNotes,
        additionalNotes: booking.additionalNotes,
      },
      candidateHotels,
      requestId,
    );

    // Map recommendation scores and reasoning to hotel objects
    const recommendedHotels = candidateHotels.map((hotel) => {
      const recommendation = groqResult.recommendations?.find(
        (r: any) => r.hotelId === hotel.id,
      );
      return {
        ...hotel,
        score: recommendation?.score ?? 50,
        suitabilityReason: recommendation?.suitabilityReason ?? "No reasoning provided by AI.",
      };
    }).sort((a, b) => b.score - a.score);

    return {
      passenger: `${booking.firstName} ${booking.lastName}`,
      travelClass: booking.travelClass,
      specialNotes: booking.specialNotes || [],
      airportCode: departureAirport.iataCode,
      recommendations: recommendedHotels,
    };
  }

  async allocateHotel(
    flightId: string,
    bookingId: string,
    dto: AllocateHotelDto,
    requestId: string,
  ) {
    await this.requireFlight(flightId, requestId);
    await this.requireBookingForFlight(bookingId, flightId, requestId);

    const allocation = await this.repo.saveHotelAllocation(
      {
        cancelledFlightId: flightId,
        hotelName: dto.hotelName,
        hotelAddress: dto.hotelAddress ?? null,
        checkInDate: dto.checkInDate,
        checkOutDate: dto.checkOutDate,
        totalRooms: dto.totalRooms ?? 1,
        costPerRoom: dto.costPerRoom ?? 0,
      },
      requestId,
    );

    this.logger.info("Hotel allocated to booking", this.context, requestId, {
      flightId,
      bookingId,
      allocationId: allocation.id,
      hotelName: dto.hotelName,
    });

    return {
      message: "Hotel allocated successfully",
      allocation: {
        id: allocation.id,
        hotelName: allocation.hotelName,
        hotelAddress: allocation.hotelAddress,
        checkInDate: allocation.checkInDate,
        checkOutDate: allocation.checkOutDate,
        totalRooms: allocation.totalRooms,
        costPerRoom: allocation.costPerRoom,
      },
    };
  }
}
