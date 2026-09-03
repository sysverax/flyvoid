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
  BookingResponseDto,
  UpdateBookingDto,
  CancelledFlightResponseDto,
  ImportBookingResponseDto,
  ReviewCancelledFlightResponseDto,
  AllocateHotelDto,
  BookHotelRequestDto,
} from "./dto";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { HotelPartnerService } from "./hotel-partner.service";
import { GroqService } from "../common/groq/groq.service";

@Injectable()
export class CancelledFlightsService {
  private readonly context = "CancelledFlightsService";

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
}
