import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Readable } from "stream";
import { LoggerService } from "../common/logger/logger.service";
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
  CreateBookingDto,
  AllocateHotelsResponseDto,
  BookingResponseDto,
  UpdateBookingDto,
  CancelledFlightResponseDto,
  ImportBookingResponseDto,
  ReviewCancelledFlightResponseDto,
  AllocateHotelDto,
  BookHotelRequestDto,
} from "./dto";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { AirlineEntity } from "../airline/entities/airline.entity";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { HotelCandidate, HotelPartnerService } from "./hotel-partner.service";
import { GroqService } from "../common/groq/groq.service";
import { HotelAllocationEntity } from "./entities/hotel-allocation.entity";

@Injectable()
export class CancelledFlightsService {
  private readonly context = "CancelledFlightsService";
  private readonly classPriorityMap: Record<string, number> = {
    first: 1,
    first_class: 1,
    business: 2,
    premium_economy: 3,
    economy: 4,
  };

  constructor(
    private readonly cancelledFlightsRepository: CancelledFlightsRepository,
    private readonly hotelPartnerService: HotelPartnerService,
    private readonly groqService: GroqService,
    private readonly logger: LoggerService,
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
  ): Promise<CancelledFlightResponseDto> {
    if (dto.departureAirportId === dto.arrivalAirportId) {
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
        status: FlightStatus.IN_PROGRESS,
      },
      requestId,
    );

    this.logger.info("Cancelled flight created", this.context, requestId, {
      flightId: flight.id,
      flightNumber: flight.flightNumber,
    });

    return this.toCancelledFlightResponse(flight);
  }

  // ── Add single booking ───────────────────────────────────────────────────

  async addBooking(
    flightId: number,
    dto: CreateBookingDto,
    requestId: string,
  ): Promise<BookingResponseDto> {
    await this.requireFlight(flightId, requestId);

    const duplicate =
      await this.cancelledFlightsRepository.findBookingByPnrAndFlight(
        dto.pnr,
        flightId,
        requestId,
      );
    if (duplicate) {
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

  async importBookings(
    flightId: number,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    requestId: string,
  ): Promise<ImportBookingResponseDto> {
    await this.requireFlight(flightId, requestId);
    // Parse the CSV file
    const csv = file.buffer.toString("utf-8");
    const rows = csv.split("\n").map((line) => line.split(","));
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
      estRooms: number;
      specialNotes: SpecialNote[];
      additionalNotes: string | null;
    }[] = [];
    const errorsList: { row: number; errors: string[] }[] = [];
    let validCount = 0;
    let errorCount = 0;

    rows.forEach((row, rowNumber) => {
      if (rowNumber === 0) return; // skip header

      const getValue = (col: number): string => String(row[col] ?? "").trim();

      const pnr = getValue(1);
      const firstName = getValue(2);
      const lastName = getValue(3);
      const email = getValue(4);
      const phone = getValue(5);
      const travelClassRaw = getValue(6).toLowerCase();
      const adultsRaw = parseInt(getValue(7), 10);
      const childrenRaw = parseInt(getValue(8), 10);
      const specialNotesRaw = getValue(9);
      const additionalNotes = getValue(10) || null;

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
      if (
        travelClassRaw !== TravelClass.ECONOMY &&
        travelClassRaw !== TravelClass.BUSINESS
      ) {
        errors.push("Travel Class must be 'economy' or 'business'");
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
                errors.push(`Invalid special note: '${s}'`);
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
        estRooms: isValid ? Math.ceil((adultsRaw + childrenRaw) / 2) : 0,
        specialNotes,
        additionalNotes,
      });
    });

    // Check for duplicate PNRs in the database
    const existingBookings =
      await this.cancelledFlightsRepository.findBookingsByFlightIdAndPnrs(
        flightId,
        Array.from(pnrSet),
        requestId,
      );

    existingBookings.forEach((bookingEntity: BookingEntity) => {
      const row = bookings.find((b) => b.pnr === bookingEntity.pnr);
      if (row) {
        row.estRooms = 0; // Mark as invalid
        errorsList.push({
          row: row.row,
          errors: [`PNR '${bookingEntity.pnr}' already exists for this flight`],
        });
        errorCount++;
      }
    });

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
      estRooms: number;
      specialNotes: SpecialNote[];
      additionalNotes: string | null;
    }[] = bookings
      .filter((b) => b.estRooms > 0)
      .map((b) => ({
        cancelledFlightId: flightId,
        pnr: b.pnr,
        firstName: b.firstName,
        lastName: b.lastName,
        email: b.email,
        phone: b.phone,
        travelClass: b.travelClass,
        adults: b.adults,
        children: b.children,
        estRooms: b.estRooms,
        specialNotes: b.specialNotes,
        additionalNotes: b.additionalNotes,
      }));

    const bookingFlights = await this.cancelledFlightsRepository.saveBookings(
      toSave,
      requestId,
    );

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
  ): Promise<BookingResponseDto> {
    await this.requireFlight(flightId, requestId);
    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestId,
    );

    if (dto.pnr && dto.pnr !== booking.pnr) {
      const conflict =
        await this.cancelledFlightsRepository.findBookingByPnrAndFlight(
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
      requestId,
    );

    return this.toBookingResponse(updated);
  }

  // ── Delete booking ───────────────────────────────────────────────────────

  async deleteBooking(flightId: number, bookingId: number, requestId: string) {
    await this.requireFlight(flightId, requestId);
    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestId,
    );
    await this.cancelledFlightsRepository.deleteBooking(booking, requestId);
    return { message: "Booking deleted successfully" };
  }

  // ── List bookings ────────────────────────────────────────────────────────
  async listBookings(
    flightId: number,
    pagination: PaginationQueryDto,
    requestId: string,
  ) {
    await this.requireFlight(flightId, requestId);
    const bookings =
      await this.cancelledFlightsRepository.findBookingsByFlightIdWithPagination(
        flightId,
        pagination.page || 1,
        pagination.limit || 10,
        requestId,
      );

    return bookings.map((b) => this.toBookingResponse(b));
  }

  // ── Review ───────────────────────────────────────────────────────────────
  async reviewFlight(
    flightId: number,
    requestId: string,
  ): Promise<ReviewCancelledFlightResponseDto> {
    const [flight, bookingStats] = await Promise.all([
      this.cancelledFlightsRepository.findFlightWithRelations(
        flightId,
        requestId,
      ),
      this.cancelledFlightsRepository.findBookingStatsByFlightId(
        flightId,
        requestId,
      ),
    ]);

    if (!flight) {
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

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

  private async requireFlight(flightId: number, requestId: string) {
    const flight = await this.cancelledFlightsRepository.findFlightById(
      flightId,
      requestId,
    );
    if (!flight) {
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }
    return flight;
  }

  private async requireBookingForFlight(
    bookingId: number,
    flightId: number,
    requestId: string,
  ): Promise<BookingEntity> {
    const booking = await this.cancelledFlightsRepository.findBookingById(
      bookingId,
      requestId,
    );
    if (!booking || booking.cancelledFlightId !== flightId) {
      throw new NotFoundException(
        `Booking '${bookingId}' not found for flight '${flightId}'`,
      );
    }
    return booking;
  }

  async confirmPassengerBookingDetails(
    flightId: number,
    requestId: string,
  ): Promise<CancelledFlightResponseDto> {
    const [flight, bookingStats] = await Promise.all([
      this.cancelledFlightsRepository.findFlightWithRelations(
        flightId,
        requestId,
      ),
      this.cancelledFlightsRepository.findBookingStatsByFlightId(
        flightId,
        requestId,
      ),
    ]);
    if (!flight) {
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    if (flight.status !== FlightStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot confirm passenger booking details for flight '${flightId}' with status '${flight.status}'`,
      );
    }

    if (bookingStats.totalBookings === 0) {
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
        HotelBookingStats: null, // No hotel booking stats at this point
        requestId,
      });

    return this.toCancelledFlightResponse(updatedFlight);
  }

  // ── AI Hotel Recommendations & Allocation ───────────────────────────────

  async getHotelRecommendations(
    flightId: number,
    bookingId: number,
    requestId: string,
  ) {
    this.logger.debug(
      `Starting hotel recommendations process for flight: ${flightId}, booking: ${bookingId}`,
      this.context,
      requestId,
    );

    const flight =
      await this.cancelledFlightsRepository.findFlightWithRelations(
        flightId,
        requestId,
      );
    if (!flight) {
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }
    this.logger.debug(
      `Successfully fetched flight record: ${flight.flightNumber}`,
      this.context,
      requestId,
    );

    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestId,
    );
    this.logger.debug(
      `Successfully fetched booking record for PNR: ${booking.pnr}`,
      this.context,
      requestId,
    );

    const departureAirport = flight.departureAirport;
    if (!departureAirport) {
      throw new NotFoundException(
        `Departure airport not found for flight '${flightId}'`,
      );
    }
    this.logger.debug(
      `Resolved departure airport: ${departureAirport.iataCode} (${departureAirport.latitude}, ${departureAirport.longitude})`,
      this.context,
      requestId,
    );

    // Calculate stay dates: check-in is flight cancellation date, check-out is check-in + 1 day
    const checkIn = flight.cancellationDate;
    if (!checkIn) {
      throw new BadRequestException(
        `Cancellation date not found for flight '${flightId}'`,
      );
    }

    const checkInDateObj = new Date(checkIn);
    if (isNaN(checkInDateObj.getTime())) {
      throw new BadRequestException(
        `Invalid cancellation date '${checkIn}' for flight '${flightId}'`,
      );
    }

    const finalCheckOutDateObj = new Date(checkInDateObj);
    finalCheckOutDateObj.setDate(finalCheckOutDateObj.getDate() + 1);
    const finalCheckOut = finalCheckOutDateObj.toISOString().split("T")[0];
    this.logger.debug(
      `Resolved stay dates - check-in: ${checkIn}, check-out: ${finalCheckOut}`,
      this.context,
      requestId,
    );

    this.logger.debug(
      `Querying Hotelbeds API for nearby hotels...`,
      this.context,
      requestId,
    );
    const candidateHotels = await this.hotelPartnerService.searchNearbyHotels(
      {
        iataCode: departureAirport.iataCode,
        latitude: Number(departureAirport.latitude),
        longitude: Number(departureAirport.longitude),
      },
      checkIn,
      finalCheckOut,
      requestId,
    );
    this.logger.debug(
      `Received ${candidateHotels.length} candidate hotels from Hotelbeds`,
      this.context,
      requestId,
      { candidateHotels },
    );

    this.logger.debug(
      `Calling Groq API for AI-based scoring and recommendation matching...`,
      this.context,
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
    this.logger.debug(
      `Received AI recommendations from Groq: ${JSON.stringify(groqResult)}`,
      this.context,
      requestId,
    );

    // Map recommendation scores and reasoning to hotel objects
    this.logger.debug(
      `Mapping AI scores and reasons to candidate hotels...`,
      this.context,
      requestId,
    );
    const recommendedHotels = candidateHotels
      .map((hotel) => {
        const recommendation = groqResult.recommendations?.find(
          (r: any) => r.hotelId === hotel.id,
        );
        return {
          ...hotel,
          score: recommendation?.score ?? 50,
          suitabilityReason:
            recommendation?.suitabilityReason ?? "No reasoning provided by AI.",
        };
      })
      .sort((a, b) => b.score - a.score);
    this.logger.debug(
      `Sorted recommended hotels count: ${recommendedHotels.length}`,
      this.context,
      requestId,
      { recommendedHotels },
    );

    return {
      passenger: `${booking.firstName} ${booking.lastName}`,
      travelClass: booking.travelClass,
      specialNotes: booking.specialNotes || [],
      airportCode: departureAirport.iataCode,
      recommendations: recommendedHotels,
    };
  }

  async allocateHotel(
    flightId: number,
    bookingId: number,
    dto: AllocateHotelDto,
    requestId: string,
  ) {
    await this.requireFlight(flightId, requestId);
    await this.requireBookingForFlight(bookingId, flightId, requestId);

    const allocation =
      await this.cancelledFlightsRepository.saveHotelAllocation(
        {
          cancelledFlightId: flightId,
          hotelName: dto.hotelName,
          hotelAddress: dto.hotelAddress ?? null,
          checkInDate: dto.checkInDate,
          checkOutDate: dto.checkOutDate,
          totalRooms: dto.totalRooms,
          costPerRoom: dto.costPerRoom,
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

  async checkRate(
    flightId: number,
    bookingId: number,
    rateKey: string,
    requestId: string,
  ) {
    this.logger.debug(
      `Checking rate for flight: ${flightId}, booking: ${bookingId}`,
      this.context,
      requestId,
    );
    await this.requireFlight(flightId, requestId);
    await this.requireBookingForFlight(bookingId, flightId, requestId);

    const result = await this.hotelPartnerService.checkRate(rateKey, requestId);
    return result;
  }

  async bookHotel(
    flightId: number,
    bookingId: number,
    dto: BookHotelRequestDto,
    requestId: string,
  ) {
    this.logger.debug(
      `Booking hotel for flight: ${flightId}, booking: ${bookingId}`,
      this.context,
      requestId,
    );

    const flight =
      await this.cancelledFlightsRepository.findFlightWithRelations(
        flightId,
        requestId,
      );
    if (!flight) {
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestId,
    );

    // 1. Call CheckRate API first to validate that rate exists and is still bookable
    const checkRateResult = await this.hotelPartnerService.checkRate(
      dto.rateKey,
      requestId,
    );
    const hotel = checkRateResult.hotel;
    if (!hotel) {
      throw new BadRequestException(
        "Hotel details not returned from CheckRate validation",
      );
    }

    // Determine room details and pricing from CheckRate validation response
    const hotelName = hotel.name;
    const hotelAddress = hotel.address || null;
    const totalRooms = hotel.rooms?.length || 1;

    // Read net price from first rate of first room
    const rateInfo = hotel.rooms?.[0]?.rates?.[0];
    const costPerRoom = rateInfo ? Number(rateInfo.net) : 0;

    // Resolve dates
    const checkIn = flight.cancellationDate;
    if (!checkIn) {
      throw new BadRequestException(
        `Cancellation date not found for flight '${flightId}'`,
      );
    }
    const checkInDateObj = new Date(checkIn);
    const finalCheckOutDateObj = new Date(checkInDateObj);
    finalCheckOutDateObj.setDate(finalCheckOutDateObj.getDate() + 1);
    const finalCheckOut = finalCheckOutDateObj.toISOString().split("T")[0];

    // 2. Perform live booking via Hotelbeds
    // TODO: Fix the return type of bookHotel to include the booking reference and status
    const bookingResult: {
      bookingReference: string;
      status: HotelAllocationStatus;
      hotelName: string;
      hotelAddress: string;
      checkInDate: string;
      checkOutDate: string;
      totalRooms: number;
      costPerRoom: number;
      price: number;
      buyingPrice: number;
    } = await this.hotelPartnerService.bookHotel(
      {
        firstName: booking.firstName,
        lastName: booking.lastName,
        bookingId: booking.id,
        pnr: booking.pnr,
      },
      dto.rateKey,
      dto.paymentData,
      requestId,
    );

    if (!bookingResult) {
      throw new BadRequestException(
        "Booking response did not contain confirmation details",
      );
    }

    // 3. Save hotel allocation in database
    // TODO: Selling price, platform fee and earnings calculations should be handled here based on business logic
    const allocation =
      await this.cancelledFlightsRepository.saveHotelAllocation(
        {
          cancelledFlightId: flightId,
          bookingId: bookingId,
          hotelName: hotelName,
          hotelAddress: hotelAddress,
          checkInDate: checkIn,
          checkOutDate: finalCheckOut,
          totalRooms: totalRooms,
          costPerRoom: costPerRoom,
          bookingReference: bookingResult.bookingReference,
          status: bookingResult.status,
          rateKey: dto.rateKey,
          price: bookingResult.price,
          buyingPrice: bookingResult.buyingPrice,
          sellingPrice: bookingResult.price, // Assuming selling price is the same as price for now
        },
        requestId,
      );

    this.logger.info(
      "Hotel booking completed and allocated to booking",
      this.context,
      requestId,
      {
        flightId,
        bookingId,
        allocationId: allocation.id,
        bookingReference: allocation.bookingReference,
        status: allocation.status,
      },
    );

    return {
      message: "Hotel booked and allocated successfully",
      allocation: {
        id: allocation.id,
        hotelName: allocation.hotelName,
        hotelAddress: allocation.hotelAddress,
        checkInDate: allocation.checkInDate,
        checkOutDate: allocation.checkOutDate,
        totalRooms: allocation.totalRooms,
        costPerRoom: allocation.costPerRoom,
        bookingReference: allocation.bookingReference,
        status: allocation.status,
      },
    };
  }

  async allocateHotelsForFlight(
    cancelledFlightId: number,
    requestId: string,
  ): Promise<AllocateHotelsResponseDto> {
    this.logger.debug(
      `Starting bulk hotel allocation for flight: ${cancelledFlightId}`,
      this.context,
      requestId,
    );

    const flight =
      await this.cancelledFlightsRepository.findFlightWithBookingsRelations(
        cancelledFlightId,
        requestId,
      );

    if (!flight) {
      throw new NotFoundException(
        `Cancelled flight '${cancelledFlightId}' not found`,
      );
    }

    if (flight.status !== FlightStatus.PASSENGERS_BOOKING_CONFIRMED) {
      throw new BadRequestException(
        `Flight '${cancelledFlightId}' is not ready for hotel allocation`,
      );
    }

    const existingAllocationsCount =
      await this.cancelledFlightsRepository.countHotelAllocationsByFlightId(
        cancelledFlightId,
        requestId,
      );

    if (existingAllocationsCount > 0) {
      throw new ConflictException(
        `Hotel allocations already exist for flight '${cancelledFlightId}'`,
      );
    }

    // PASSENGERS_BOOKING_CONFIRMED means all bookings on this flight are confirmed.
    const confirmedBookings = flight.bookings ?? [];

    if (confirmedBookings.length === 0) {
      throw new BadRequestException(
        `No confirmed bookings found for flight '${cancelledFlightId}'`,
      );
    }

    const checkIn = flight.cancellationDate;
    if (!checkIn) {
      throw new BadRequestException(
        `Cancellation date not found for flight '${cancelledFlightId}'`,
      );
    }

    const checkOut = this.getDatePlusDays(checkIn, 1);

    const airlinePreferences = this.getAirlineHotelPreferences(flight.airline);
    const departureAirport = flight.departureAirport;
    if (!departureAirport) {
      throw new NotFoundException(
        `Departure airport not found for flight '${cancelledFlightId}'`,
      );
    }

    try {
      await this.cancelledFlightsRepository.updateFlightStatus({
        cancelledFlightEntity: flight,
        status: FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS,
        passengerBookingStats: {
          totalBookings: null,
          totalAdults: null,
          totalChildren: null,
        },
        HotelBookingStats: null,
        requestId,
      });

      const hotels = await this.hotelPartnerService.searchNearbyHotels(
        {
          iataCode: departureAirport.iataCode,
          latitude: Number(departureAirport.latitude),
          longitude: Number(departureAirport.longitude),
        },
        checkIn,
        checkOut,
        requestId,
        {
          radiusKm: airlinePreferences.maxDistanceKm,
          allowedStars: airlinePreferences.allowedStars,
        },
      );

      if (hotels.length === 0) {
        throw new NotFoundException(
          `No hotels found near airport '${departureAirport.iataCode}'`,
        );
      }

      const bookingMap = new Map<number, BookingEntity>(
        confirmedBookings.map((booking) => [booking.id, booking]),
      );

      const inventoryState = this.initializeInventoryState(hotels);
      const groupedByClass = this.groupBookingsByClass(confirmedBookings);

      const successfulAllocations: AllocateHotelsResponseDto["allocations"] =
        [];
      const failedAllocations: AllocateHotelsResponseDto["failedAllocations"] =
        [];
      const allocationEntitiesPayload: Array<Partial<HotelAllocationEntity>> =
        [];

      for (const classGroup of groupedByClass) {
        const classSubGroups = await this.groqService.subGroupBySpecialNotes(
          classGroup.bookings.map((booking) => ({
            id: booking.id,
            pnr: booking.pnr,
            specialNotes: (booking.specialNotes ?? []) as string[],
            additionalNotes: booking.additionalNotes,
          })),
          requestId,
        );

        for (const subGroup of classSubGroups.subGroups) {
          const subgroupBookings = this.resolveSubGroupBookings(
            subGroup.bookingIds,
            classGroup.bookings,
            bookingMap,
          );

          if (subgroupBookings.length === 0) {
            continue;
          }

          const isAccessibilityGroup = this.isAccessibilitySubGroup(subGroup);
          const candidateHotels = hotels.filter((hotel) => {
            const hasInventory =
              (inventoryState.get(hotel.id)?.remainingRooms ?? 0) > 0;
            if (!hasInventory) {
              return false;
            }
            if (isAccessibilityGroup) {
              return hotel.isAccessible;
            }
            return true;
          });

          if (candidateHotels.length === 0) {
            for (const booking of subgroupBookings) {
              failedAllocations.push({
                bookingId: booking.id,
                pnr: booking.pnr,
                reason: isAccessibilityGroup
                  ? "No accessible hotels available for this subgroup"
                  : "No hotels available for this subgroup",
                status: "allocation_failed",
              });
            }
            continue;
          }

          const totalPassengers = subgroupBookings.reduce(
            (sum, booking) => sum + booking.adults + booking.children,
            0,
          );

          const scored = await this.groqService.scoreHotelsForSubGroup(
            {
              travelClass: classGroup.travelClass,
              classPriority: classGroup.priority,
              needsProfile: subGroup.needsProfile,
              totalPassengers,
              bookingCount: subgroupBookings.length,
            },
            candidateHotels.map((hotel) => ({
              id: hotel.id,
              name: hotel.name,
              stars: hotel.stars,
              amenities: hotel.amenities,
              minRate: hotel.minRate,
              isAccessible: hotel.isAccessible,
              totalAvailableRooms:
                inventoryState.get(hotel.id)?.remainingRooms ??
                hotel.totalAvailableRooms,
            })),
            requestId,
          );

          const scoredHotelIds = scored.scoredHotels.map(
            (hotel) => hotel.hotelId,
          );
          const scoredHotels = this.sortHotelsByScoring(
            candidateHotels,
            scoredHotelIds,
          );

          const bookingContext = {
            checkIn,
            checkOut,
            subgroupId: subGroup.id,
            requestId,
            airport: {
              iataCode: departureAirport.iataCode,
              latitude: Number(departureAirport.latitude),
              longitude: Number(departureAirport.longitude),
            },
            airlinePreferences,
          };

          const reservedPlans: Array<{
            booking: BookingEntity;
            reservedHotel: HotelCandidate;
            reservedHotelIndex: number;
            rooms: Array<{
              roomType: string;
              capacity: number;
              pricePerNight: number;
              totalCost: number;
              rateKey: string;
            }>;
            rateKey: string;
            totalCost: number;
            scoredHotels: HotelCandidate[];
            bookingContext: typeof bookingContext;
          }> = [];

          for (const booking of subgroupBookings) {
            const reservation = this.reserveRoomsForBooking(
              booking,
              scoredHotels,
              inventoryState,
              bookingContext,
            );

            if (!reservation.success) {
              failedAllocations.push({
                bookingId: booking.id,
                pnr: booking.pnr,
                reason: reservation.reason ?? "Failed to match rooms",
                status: "allocation_failed",
              });
              continue;
            }

            reservedPlans.push(reservation.plan);
          }

          for (const plan of reservedPlans) {
            const bookingAttempt = await this.bookReservedPlan(
              plan,
              inventoryState,
            );
            if (!bookingAttempt.success) {
              failedAllocations.push({
                bookingId: plan.booking.id,
                pnr: plan.booking.pnr,
                reason:
                  bookingAttempt.reason ?? "Failed to book allocated hotel",
                status: "allocation_failed",
              });
              continue;
            }

            const allocation = bookingAttempt.allocation;
            successfulAllocations.push(allocation.responseItem);
            allocationEntitiesPayload.push(allocation.entityPayload);
          }
        }
      }

      await this.cancelledFlightsRepository.saveHotelAllocationsBulk(
        allocationEntitiesPayload,
        requestId,
      );

      const totals = successfulAllocations.reduce(
        (acc, item) => {
          acc.totalRooms += item.totalRooms;
          acc.totalPrice += item.totalCost;
          acc.totalBuyingPrice += item.buyingPrice;
          acc.totalSellingPrice += item.sellingPrice;
          acc.totalPlatformFee += item.platformFee;
          acc.totalEarnings += item.earnings;
          return acc;
        },
        {
          totalRooms: 0,
          totalPrice: 0,
          totalBuyingPrice: 0,
          totalSellingPrice: 0,
          totalPlatformFee: 0,
          totalEarnings: 0,
        },
      );

      const allocationStatus =
        successfulAllocations.length > 0
          ? FlightStatus.ALLOCATED
          : FlightStatus.PASSENGERS_BOOKING_CONFIRMED;

      const updatedFlight =
        await this.cancelledFlightsRepository.updateFlightStatus({
          cancelledFlightEntity: flight,
          status: allocationStatus,
          passengerBookingStats: {
            totalBookings: null,
            totalAdults: null,
            totalChildren: null,
          },
          HotelBookingStats: {
            totalHotelRooms: totals.totalRooms,
            totalPrice: totals.totalPrice,
            totalBuyingPrice: totals.totalBuyingPrice,
            totalSellingPrice: totals.totalSellingPrice,
            totalPlatformFee: totals.totalPlatformFee,
            totalEarnings: totals.totalEarnings,
          },
          requestId,
        });

      this.logger.info(
        "Bulk hotel allocation completed",
        this.context,
        requestId,
        {
          flightId: cancelledFlightId,
          successfulAllocations: successfulAllocations.length,
          failedAllocations: failedAllocations.length,
        },
      );

      return {
        flightId: updatedFlight.id,
        flightNumber: updatedFlight.flightNumber,
        status: "allocation_complete",
        summary: {
          totalPNRs: confirmedBookings.length,
          successfulAllocations: successfulAllocations.length,
          failedAllocations: failedAllocations.length,
          totalRoomsAllocated: totals.totalRooms,
          totalCost: Number(totals.totalPrice.toFixed(2)),
        },
        allocations: successfulAllocations,
        failedAllocations,
      };
    } catch (error) {
      this.logger.error(
        "Bulk hotel allocation failed; restoring flight status",
        this.context,
        requestId,
        { flightId: cancelledFlightId, error },
      );
      await this.cancelledFlightsRepository.updateFlightStatus({
        cancelledFlightEntity: flight,
        status: FlightStatus.PASSENGERS_BOOKING_CONFIRMED,
        passengerBookingStats: {
          totalBookings: null,
          totalAdults: null,
          totalChildren: null,
        },
        HotelBookingStats: null,
        requestId,
      });
      throw error;
    }
  }

  private getDatePlusDays(date: string, days: number): string {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date '${date}'`);
    }
    parsed.setDate(parsed.getDate() + days);
    return parsed.toISOString().split("T")[0];
  }

  private getAirlineHotelPreferences(airline: AirlineEntity): {
    allowedStars: number[];
    maxDistanceKm: number;
  } {
    const record = airline as AirlineEntity & {
      hotelPreferences?: Record<string, unknown>;
      hotel_preferences?: Record<string, unknown>;
    };
    const preferences = (record.hotelPreferences ??
      record.hotel_preferences ??
      {}) as Record<string, unknown>;

    const starSource =
      preferences.allowedStars ??
      preferences.allowed_stars ??
      preferences.stars;
    const allowedStars = Array.isArray(starSource)
      ? starSource
          .map((star) => Number(star))
          .filter((star) => Number.isFinite(star) && star >= 1 && star <= 5)
      : [];

    const maxDistanceRaw = Number(
      preferences.maxDistanceKm ?? preferences.max_distance_km ?? 20,
    );

    return {
      allowedStars,
      maxDistanceKm:
        Number.isFinite(maxDistanceRaw) && maxDistanceRaw > 0
          ? maxDistanceRaw
          : 20,
    };
  }

  private groupBookingsByClass(bookings: BookingEntity[]): Array<{
    travelClass: string;
    priority: number;
    bookings: BookingEntity[];
  }> {
    const grouped = new Map<string, BookingEntity[]>();
    for (const booking of bookings) {
      const key = String(booking.travelClass ?? "unknown").toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(booking);
    }

    return Array.from(grouped.entries())
      .map(([travelClass, classBookings]) => ({
        travelClass,
        priority: this.classPriorityMap[travelClass] ?? 99,
        bookings: classBookings,
      }))
      .sort((a, b) => a.priority - b.priority);
  }

  private resolveSubGroupBookings(
    bookingIds: number[],
    classBookings: BookingEntity[],
    bookingMap: Map<number, BookingEntity>,
  ): BookingEntity[] {
    const selected = bookingIds
      .map((bookingId) => bookingMap.get(bookingId))
      .filter((booking): booking is BookingEntity => !!booking);

    if (selected.length > 0) {
      return selected;
    }

    return classBookings;
  }

  private isAccessibilitySubGroup(subGroup: {
    id: string;
    label: string;
    needsProfile: string;
  }): boolean {
    return /accessib|wheelchair|mobility|medical/i.test(
      `${subGroup.id} ${subGroup.label} ${subGroup.needsProfile}`,
    );
  }

  private initializeInventoryState(hotels: HotelCandidate[]): Map<
    string,
    {
      remainingRooms: number;
      roomTypeAvailability: Map<string, number>;
    }
  > {
    const state = new Map<
      string,
      {
        remainingRooms: number;
        roomTypeAvailability: Map<string, number>;
      }
    >();

    for (const hotel of hotels) {
      const roomTypeAvailability = new Map<string, number>();
      for (const roomType of hotel.roomTypes) {
        roomTypeAvailability.set(
          roomType.rateKey,
          Math.max(0, Math.floor(roomType.available)),
        );
      }

      state.set(hotel.id, {
        remainingRooms: Math.max(
          0,
          Math.floor(
            hotel.totalAvailableRooms ||
              hotel.roomTypes.reduce(
                (sum, roomType) => sum + roomType.available,
                0,
              ) ||
              0,
          ),
        ),
        roomTypeAvailability,
      });
    }

    return state;
  }

  private sortHotelsByScoring(
    hotels: HotelCandidate[],
    scoredHotelIds: string[],
  ): HotelCandidate[] {
    const scoreOrder = new Map<string, number>();
    scoredHotelIds.forEach((hotelId, index) => {
      scoreOrder.set(hotelId, index);
    });

    return [...hotels].sort((a, b) => {
      const aIndex = scoreOrder.has(a.id)
        ? (scoreOrder.get(a.id) as number)
        : Number.MAX_SAFE_INTEGER;
      const bIndex = scoreOrder.has(b.id)
        ? (scoreOrder.get(b.id) as number)
        : Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }

  private reserveRoomsForBooking(
    booking: BookingEntity,
    scoredHotels: HotelCandidate[],
    inventoryState: Map<
      string,
      {
        remainingRooms: number;
        roomTypeAvailability: Map<string, number>;
      }
    >,
    bookingContext: {
      checkIn: string;
      checkOut: string;
      subgroupId: string;
      requestId: string;
      airport: { iataCode: string; latitude: number; longitude: number };
      airlinePreferences: { allowedStars: number[]; maxDistanceKm: number };
    },
  ):
    | {
        success: true;
        plan: {
          booking: BookingEntity;
          reservedHotel: HotelCandidate;
          reservedHotelIndex: number;
          rooms: Array<{
            roomType: string;
            capacity: number;
            pricePerNight: number;
            totalCost: number;
            rateKey: string;
          }>;
          rateKey: string;
          totalCost: number;
          scoredHotels: HotelCandidate[];
          bookingContext: {
            checkIn: string;
            checkOut: string;
            subgroupId: string;
            requestId: string;
            airport: { iataCode: string; latitude: number; longitude: number };
            airlinePreferences: {
              allowedStars: number[];
              maxDistanceKm: number;
            };
          };
        };
      }
    | { success: false; reason: string } {
    const totalPassengers = booking.adults + booking.children;

    for (
      let hotelIndex = 0;
      hotelIndex < scoredHotels.length;
      hotelIndex += 1
    ) {
      const hotel = scoredHotels[hotelIndex];
      const reservation = this.tryReserveRooms(
        hotel,
        inventoryState,
        totalPassengers,
      );

      if (!reservation.success) {
        continue;
      }

      return {
        success: true,
        plan: {
          booking,
          reservedHotel: hotel,
          reservedHotelIndex: hotelIndex,
          rooms: reservation.rooms,
          rateKey: reservation.rateKey,
          totalCost: reservation.totalCost,
          scoredHotels,
          bookingContext,
        },
      };
    }

    return {
      success: false,
      reason: "No available rooms matching passenger requirements",
    };
  }

  private async bookReservedPlan(
    plan: {
      booking: BookingEntity;
      reservedHotel: HotelCandidate;
      reservedHotelIndex: number;
      rooms: Array<{
        roomType: string;
        capacity: number;
        pricePerNight: number;
        totalCost: number;
        rateKey: string;
      }>;
      rateKey: string;
      totalCost: number;
      scoredHotels: HotelCandidate[];
      bookingContext: {
        checkIn: string;
        checkOut: string;
        subgroupId: string;
        requestId: string;
        airport: { iataCode: string; latitude: number; longitude: number };
        airlinePreferences: { allowedStars: number[]; maxDistanceKm: number };
      };
    },
    inventoryState: Map<
      string,
      {
        remainingRooms: number;
        roomTypeAvailability: Map<string, number>;
      }
    >,
  ): Promise<
    | {
        success: true;
        allocation: {
          responseItem: AllocateHotelsResponseDto["allocations"][number];
          entityPayload: Partial<HotelAllocationEntity>;
        };
      }
    | { success: false; reason: string }
  > {
    const booking = plan.booking;
    const nights = 1;
    let activeHotel = plan.reservedHotel;
    let activeRooms = plan.rooms;
    let activeRateKey = plan.rateKey;

    for (
      let hotelIndex = plan.reservedHotelIndex;
      hotelIndex < plan.scoredHotels.length;
      hotelIndex += 1
    ) {
      if (hotelIndex !== plan.reservedHotelIndex) {
        const nextHotel = plan.scoredHotels[hotelIndex];
        const reReserve = this.tryReserveRooms(
          nextHotel,
          inventoryState,
          booking.adults + booking.children,
        );
        if (!reReserve.success) {
          continue;
        }
        activeHotel = nextHotel;
        activeRooms = reReserve.rooms;
        activeRateKey = reReserve.rateKey;
      }

      try {
        const bookingResult = await this.hotelPartnerService.bookHotelByParams(
          {
            firstName: booking.firstName,
            lastName: booking.lastName,
            bookingId: booking.id,
            pnr: booking.pnr,
            rateKey: activeRateKey,
          },
          plan.bookingContext.requestId,
        );

        const calculatedPrice = Number(
          (
            activeRooms.reduce((sum, room) => sum + room.totalCost, 0) * nights
          ).toFixed(2),
        );
        const price = Number(
          (bookingResult.price || calculatedPrice || plan.totalCost).toFixed(2),
        );
        const buyingPrice = Number(
          (bookingResult.buyingPrice || price).toFixed(2),
        );
        const platformFee = Number((price * 0.05).toFixed(2));
        const sellingPrice = Number((buyingPrice + platformFee).toFixed(2));
        const earnings = Number(
          (sellingPrice - buyingPrice - platformFee).toFixed(2),
        );

        const responseItem: AllocateHotelsResponseDto["allocations"][number] = {
          bookingId: booking.id,
          pnr: booking.pnr,
          passengerName: `${booking.firstName} ${booking.lastName}`,
          travelClass: String(booking.travelClass),
          subGroup: plan.bookingContext.subgroupId,
          adults: booking.adults,
          children: booking.children,
          hotel: {
            name: activeHotel.name,
            address: activeHotel.address,
            stars: activeHotel.stars,
            checkIn: plan.bookingContext.checkIn,
            checkOut: plan.bookingContext.checkOut,
          },
          rooms: activeRooms.map((room) => ({
            roomType: room.roomType,
            capacity: room.capacity,
            pricePerNight: Number(room.pricePerNight.toFixed(2)),
            totalCost: Number(room.totalCost.toFixed(2)),
          })),
          totalRooms: activeRooms.length,
          totalCost: price,
          buyingPrice,
          sellingPrice,
          platformFee,
          earnings,
          bookingReference: bookingResult.bookingReference,
          vendor: "hotelbeds",
          status: HotelAllocationStatus.CONFIRMED,
        };

        return {
          success: true,
          allocation: {
            responseItem,
            entityPayload: {
              cancelledFlightId: booking.cancelledFlightId,
              bookingId: booking.id,
              hotelName: activeHotel.name,
              hotelAddress: activeHotel.address,
              checkInDate: plan.bookingContext.checkIn,
              checkOutDate: plan.bookingContext.checkOut,
              totalRooms: activeRooms.length,
              costPerRoom: Number((price / activeRooms.length).toFixed(2)),
              bookingReference: bookingResult.bookingReference,
              status: HotelAllocationStatus.CONFIRMED,
              rateKey: activeRateKey,
              price,
              buyingPrice,
              sellingPrice,
              platformFee,
              earnings,
            },
          },
        };
      } catch (error: any) {
        const errorMessage = String(error?.message ?? "Booking failed");
        this.releaseReservedRooms(activeHotel, inventoryState, activeRooms);

        if (this.isRateKeyExpiredError(errorMessage)) {
          const refreshedRateKey = await this.refreshRateKeyForHotel(
            activeHotel,
            booking.adults + booking.children,
            plan.bookingContext,
            activeRooms,
          );

          if (refreshedRateKey) {
            const retryReservation = this.tryReserveRooms(
              activeHotel,
              inventoryState,
              booking.adults + booking.children,
              refreshedRateKey,
            );
            if (retryReservation.success) {
              activeRooms = retryReservation.rooms;
              activeRateKey = refreshedRateKey;
              // Move the loop counter back so its increment retries this same hotel once.
              hotelIndex -= 1;
              continue;
            }
          }
        }
      }
    }

    return {
      success: false,
      reason: "Booking failed for all scored hotels",
    };
  }

  private tryReserveRooms(
    hotel: HotelCandidate,
    inventoryState: Map<
      string,
      {
        remainingRooms: number;
        roomTypeAvailability: Map<string, number>;
      }
    >,
    totalPassengers: number,
    preferredRateKey?: string,
  ):
    | {
        success: true;
        rooms: Array<{
          roomType: string;
          capacity: number;
          pricePerNight: number;
          totalCost: number;
          rateKey: string;
        }>;
        rateKey: string;
        totalCost: number;
      }
    | { success: false; reason: string } {
    const hotelState = inventoryState.get(hotel.id);
    if (!hotelState || hotelState.remainingRooms <= 0) {
      return { success: false, reason: "Hotel is full" };
    }

    const availableRoomTypes = hotel.roomTypes.filter((roomType) => {
      const availability =
        hotelState.roomTypeAvailability.get(roomType.rateKey) ?? 0;
      return availability > 0;
    });

    if (availableRoomTypes.length === 0) {
      const fallbackRoomsNeeded = Math.ceil(totalPassengers / 2);
      if (hotelState.remainingRooms < fallbackRoomsNeeded) {
        return {
          success: false,
          reason: "No room type inventory and fallback rooms unavailable",
        };
      }

      hotelState.remainingRooms -= fallbackRoomsNeeded;
      const fallbackRateKey = preferredRateKey || hotel.rateKey;
      if (!fallbackRateKey) {
        hotelState.remainingRooms += fallbackRoomsNeeded;
        return { success: false, reason: "No valid rate key available" };
      }

      const rooms = Array.from({ length: fallbackRoomsNeeded }).map(() => ({
        roomType: "Standard Room",
        capacity: 2,
        pricePerNight: Number(hotel.minRate),
        totalCost: Number(hotel.minRate),
        rateKey: fallbackRateKey,
      }));

      return {
        success: true,
        rooms,
        rateKey: fallbackRateKey,
        totalCost: rooms.reduce((sum, room) => sum + room.totalCost, 0),
      };
    }

    const sortedByCapacityAsc = [...availableRoomTypes].sort(
      (a, b) => a.capacity - b.capacity,
    );

    const singleRoom = sortedByCapacityAsc.find(
      (roomType) => roomType.capacity >= totalPassengers,
    );

    if (singleRoom) {
      const availability =
        hotelState.roomTypeAvailability.get(singleRoom.rateKey) ?? 0;
      if (availability <= 0) {
        return {
          success: false,
          reason: "Selected room type is not available",
        };
      }
      hotelState.roomTypeAvailability.set(singleRoom.rateKey, availability - 1);
      hotelState.remainingRooms -= 1;

      return {
        success: true,
        rooms: [
          {
            roomType: singleRoom.type,
            capacity: singleRoom.capacity,
            pricePerNight: singleRoom.pricePerNight,
            totalCost: singleRoom.pricePerNight,
            rateKey: preferredRateKey || singleRoom.rateKey,
          },
        ],
        rateKey: preferredRateKey || singleRoom.rateKey,
        totalCost: singleRoom.pricePerNight,
      };
    }

    const sortedByCapacityDesc = [...availableRoomTypes].sort(
      (a, b) => b.capacity - a.capacity,
    );

    const selectedRooms: Array<{
      roomType: string;
      capacity: number;
      pricePerNight: number;
      totalCost: number;
      rateKey: string;
    }> = [];
    const availabilitySnapshot = new Map(hotelState.roomTypeAvailability);
    let remainingPassengers = totalPassengers;

    for (const roomType of sortedByCapacityDesc) {
      let availability =
        hotelState.roomTypeAvailability.get(roomType.rateKey) ?? 0;
      while (availability > 0 && remainingPassengers > 0) {
        selectedRooms.push({
          roomType: roomType.type,
          capacity: roomType.capacity,
          pricePerNight: roomType.pricePerNight,
          totalCost: roomType.pricePerNight,
          rateKey: roomType.rateKey,
        });
        remainingPassengers -= roomType.capacity;
        availability -= 1;
      }
      hotelState.roomTypeAvailability.set(roomType.rateKey, availability);
      if (remainingPassengers <= 0) {
        break;
      }
    }

    if (remainingPassengers > 0) {
      hotelState.roomTypeAvailability = availabilitySnapshot;
      return {
        success: false,
        reason: "Insufficient room capacity for passenger count",
      };
    }

    hotelState.remainingRooms -= selectedRooms.length;

    const effectiveRateKey =
      preferredRateKey || selectedRooms[0]?.rateKey || hotel.rateKey;
    if (!effectiveRateKey) {
      hotelState.roomTypeAvailability = availabilitySnapshot;
      hotelState.remainingRooms += selectedRooms.length;
      return { success: false, reason: "No valid rate key available" };
    }

    return {
      success: true,
      rooms: selectedRooms,
      rateKey: effectiveRateKey,
      totalCost: selectedRooms.reduce((sum, room) => sum + room.totalCost, 0),
    };
  }

  private releaseReservedRooms(
    hotel: HotelCandidate,
    inventoryState: Map<
      string,
      {
        remainingRooms: number;
        roomTypeAvailability: Map<string, number>;
      }
    >,
    rooms: Array<{ rateKey: string }>,
  ) {
    const hotelState = inventoryState.get(hotel.id);
    if (!hotelState || rooms.length === 0) {
      return;
    }

    for (const room of rooms) {
      const current = hotelState.roomTypeAvailability.get(room.rateKey) ?? 0;
      hotelState.roomTypeAvailability.set(room.rateKey, current + 1);
    }
    hotelState.remainingRooms += rooms.length;
  }

  private isRateKeyExpiredError(errorMessage: string): boolean {
    return /rate\s*key|invalid\s*rate|expired/i.test(errorMessage);
  }

  private async refreshRateKeyForHotel(
    hotel: HotelCandidate,
    totalPassengers: number,
    context: {
      checkIn: string;
      checkOut: string;
      subgroupId: string;
      requestId: string;
      airport: { iataCode: string; latitude: number; longitude: number };
      airlinePreferences: { allowedStars: number[]; maxDistanceKm: number };
    },
    previousRooms: Array<{ capacity: number }>,
  ): Promise<string | null> {
    try {
      const refreshedHotels = await this.hotelPartnerService.searchNearbyHotels(
        context.airport,
        context.checkIn,
        context.checkOut,
        context.requestId,
        {
          radiusKm: context.airlinePreferences.maxDistanceKm,
          allowedStars: context.airlinePreferences.allowedStars,
        },
      );
      const refreshedHotel = refreshedHotels.find(
        (candidate) => candidate.id === hotel.id,
      );
      if (!refreshedHotel) {
        return null;
      }

      const minRequiredCapacity = previousRooms[0]?.capacity || totalPassengers;
      const match = refreshedHotel.roomTypes.find(
        (roomType) =>
          roomType.capacity >= minRequiredCapacity && !!roomType.rateKey,
      );
      return match?.rateKey ?? refreshedHotel.rateKey ?? null;
    } catch (error: any) {
      this.logger.warn(
        `Failed to refresh rate key for hotel '${hotel.id}': ${String(error?.message ?? "Unknown error")}`,
        this.context,
        context.requestId,
      );
      return null;
    }
  }
}
