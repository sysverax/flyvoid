import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Readable } from "stream";
import { LoggerService } from "../common/logger/logger.service";
import { CancelledFlightsRepository } from "./cancel-flights.repository";
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
import {
  AvailabilityHotel,
  AvailabilityRoomRate,
  HotelPartnerService,
  RoomOccupancy,
} from "./hotel-partners.service";
import { GroqService } from "../common/groq/groq.service";
import { Logger } from "winston";

type AllocationStatus =
  | "RECOMMENDED"
  | "NO_SUITABLE_HOTEL"
  | "INVALID_PASSENGER_DATA"
  | "NO_AVAILABILITY";

interface RoomSplitPlan {
  preferred: RoomOccupancy[];
  fallbacks: RoomOccupancy[][];
}

interface BookingRecommendationResult {
  bookingId: number;
  pnr: string;
  class: TravelClass;
  passengers: {
    adults: number;
    children: number;
  };
  splitTried?: "preferred" | "fallback";
  hotel?: {
    hotelCode: string;
    hotelName: string;
    category: string;
  };
  rooms?: Array<{
    adults: number;
    children: number;
    rateKey: string;
    roomName: string;
    boardName: string;
    price: number;
    currency: string;
  }>;
  totalPrice?: number;
  allocationStatus: AllocationStatus;
  reason?: string;
}

const room = (adults: number, children = 0): RoomOccupancy => ({
  adults,
  children,
});

const ROOM_SPLIT_RULES: Record<string, RoomSplitPlan> = {
  "1_0": { preferred: [room(1)], fallbacks: [] },
  "2_0": { preferred: [room(2)], fallbacks: [] },
  "3_0": { preferred: [room(3)], fallbacks: [[room(2), room(1)]] },
  "4_0": { preferred: [room(2), room(2)], fallbacks: [[room(3), room(1)]] },
  "5_0": {
    preferred: [room(2), room(2), room(1)],
    fallbacks: [[room(3), room(2)]],
  },
  "6_0": { preferred: [room(2), room(2), room(2)], fallbacks: [] },
  "7_0": {
    preferred: [room(2), room(2), room(2), room(1)],
    fallbacks: [[room(3), room(2), room(2)]],
  },
  "8_0": { preferred: [room(2), room(2), room(2), room(2)], fallbacks: [] },
  "9_0": {
    preferred: [room(2), room(2), room(2), room(2), room(1)],
    fallbacks: [[room(3), room(2), room(2), room(2)]],
  },
  "1_1": { preferred: [room(1, 1)], fallbacks: [] },
  "1_2": { preferred: [room(1, 2)], fallbacks: [] },
  "1_3": { preferred: [room(1, 3)], fallbacks: [] },
  "1_4": { preferred: [room(1, 4)], fallbacks: [] },
  "2_1": { preferred: [room(2, 1)], fallbacks: [[room(1, 1), room(1)]] },
  "2_2": { preferred: [room(2, 2)], fallbacks: [[room(1, 1), room(1, 1)]] },
  "2_3": { preferred: [room(2, 3)], fallbacks: [[room(1, 2), room(1, 1)]] },
  "2_4": { preferred: [room(2, 4)], fallbacks: [[room(1, 2), room(1, 2)]] },
  "3_1": {
    preferred: [room(2), room(1, 1)],
    fallbacks: [[room(2, 1), room(1)]],
  },
  "3_2": {
    preferred: [room(2, 1), room(1, 1)],
    fallbacks: [[room(2), room(1, 1), room(1)]],
  },
  "3_3": {
    preferred: [room(2, 2), room(1, 1)],
    fallbacks: [[room(2, 1), room(1, 1), room(1, 1)]],
  },
  "3_4": {
    preferred: [room(2, 2), room(1, 2)],
    fallbacks: [[room(2, 1), room(1, 1), room(1, 2)]],
  },
  "4_1": {
    preferred: [room(2), room(2, 1)],
    fallbacks: [[room(2, 1), room(1, 1), room(1)]],
  },
  "4_2": {
    preferred: [room(2), room(1, 1), room(1, 1)],
    fallbacks: [[room(2, 1), room(1, 1), room(1)]],
  },
  "4_3": {
    preferred: [room(2, 1), room(1, 1), room(1, 1)],
    fallbacks: [[room(2), room(1, 1), room(1, 1), room(1)]],
  },
  "4_4": {
    preferred: [room(2, 2), room(2, 1)],
    fallbacks: [[room(2, 1), room(1, 1), room(1, 1), room(1)]],
  },
  "5_1": {
    preferred: [room(2), room(2), room(1, 1)],
    fallbacks: [[room(2, 1), room(1, 1), room(1, 1), room(1)]],
  },
  "5_2": {
    preferred: [room(2), room(2, 1), room(1, 1)],
    fallbacks: [[room(2, 1), room(1, 1), room(1, 1), room(1)]],
  },
  // Fixed based on explicit business validation: preserve exact 5 adults + 3 children.
  "5_3": {
    preferred: [room(2, 1), room(2, 1), room(1, 1)],
    fallbacks: [[room(2, 1), room(1, 1), room(1, 1), room(1)]],
  },
  "5_4": {
    preferred: [room(2, 2), room(2, 1), room(1, 1)],
    fallbacks: [[room(2, 1), room(1, 1), room(1, 1), room(1, 1)]],
  },
  "6_1": {
    preferred: [room(2), room(2), room(2), room(1)],
    fallbacks: [[room(1, 1), room(2), room(2), room(1)]],
  },
  "6_2": {
    preferred: [room(2), room(2), room(1, 1), room(1, 1)],
    fallbacks: [[room(2, 1), room(2, 1), room(1), room(1)]],
  },
  "6_3": {
    preferred: [room(2), room(2, 1), room(1, 1), room(1, 1)],
    fallbacks: [[room(2, 1), room(2, 1), room(1, 1), room(1)]],
  },
  "7_2": {
    preferred: [room(2), room(2), room(2, 1), room(1, 1)],
    fallbacks: [[room(2, 1), room(2, 1), room(2), room(1)]],
  },
};

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

  private occupancyKey(occupancy: RoomOccupancy): string {
    const ages = (occupancy.childrenAges ?? []).join("-");
    return `${occupancy.adults}_${occupancy.children}_${ages}`;
  }

  private validateSplit(
    adults: number,
    children: number,
    rooms: RoomOccupancy[],
  ): boolean {
    const totalAdults = rooms.reduce((sum, value) => sum + value.adults, 0);
    const totalChildren = rooms.reduce((sum, value) => sum + value.children, 0);
    const hasChildAlone = rooms.some(
      (value) => value.children > 0 && value.adults === 0,
    );

    return (
      totalAdults === adults &&
      totalChildren === children &&
      !hasChildAlone &&
      rooms.every((value) => value.adults >= 1)
    );
  }

  private resolveRoomSplitPlan(
    booking: BookingEntity,
    requestLogger: Logger,
  ): {
    plan?: RoomSplitPlan;
    reason?: string;
  } {
    if (booking.adults < 1) {
      requestLogger.error(
        `Invalid passenger data for booking '${booking.id}': adults must be at least 1`,
        {
          context: this.context,
          bookingId: booking.id,
        },
      );
      return { reason: "Adults must be at least 1" };
    }
    if (booking.children < 0) {
      requestLogger.error(
        `Invalid passenger data for booking '${booking.id}': children cannot be negative`,
        {
          context: this.context,
          bookingId: booking.id,
        },
      );
      return { reason: "Children cannot be negative" };
    }
    if (booking.children > 0 && booking.adults === 0) {
      requestLogger.error(
        `Invalid passenger data for booking '${booking.id}': children cannot be allocated without an adult`,
        {
          context: this.context,
          bookingId: booking.id,
        },
      );
      return {
        reason:
          "Invalid passenger data: children cannot be allocated without an adult",
      };
    }

    const key = `${booking.adults}_${booking.children}`;
    const configured = ROOM_SPLIT_RULES[key];
    if (!configured) {
      return {
        reason: `No room split rule configured for adults=${booking.adults}, children=${booking.children}`,
      };
    }

    const validPreferred = this.validateSplit(
      booking.adults,
      booking.children,
      configured.preferred,
    );
    if (!validPreferred) {
      return {
        reason: `Configured preferred split is invalid for adults=${booking.adults}, children=${booking.children}`,
      };
    }

    const validFallbacks = configured.fallbacks.filter((fallback) =>
      this.validateSplit(booking.adults, booking.children, fallback),
    );

    return {
      plan: {
        preferred: configured.preferred,
        fallbacks: validFallbacks,
      },
    };
  }

  private toGroupKey(booking: BookingEntity): string {
    const passengerProfile = booking.children > 0 ? "family" : "standard";
    const notes = [...(booking.specialNotes ?? [])].sort().join("|");
    return `${booking.travelClass}|${passengerProfile}|${notes}`;
  }

  private groupBookings(
    bookings: BookingEntity[],
  ): Map<string, BookingEntity[]> {
    const groups = new Map<string, BookingEntity[]>();

    for (const booking of bookings) {
      const key = this.toGroupKey(booking);
      const list = groups.get(key);
      if (list) {
        list.push(booking);
      } else {
        groups.set(key, [booking]);
      }
    }

    return groups;
  }

  private toAiHotelCandidates(hotels: AvailabilityHotel[]) {
    return hotels.map((hotel) => {
      const minRate = hotel.rates.reduce(
        (acc, rate) => (rate.netPrice < acc ? rate.netPrice : acc),
        Number.POSITIVE_INFINITY,
      );

      return {
        id: `hb-${hotel.hotelCode}`,
        name: hotel.hotelName,
        address: hotel.address,
        stars: hotel.stars,
        amenities: [
          "WiFi",
          ...(hotel.stars >= 4 ? ["Business Center"] : ["Free Shuttle"]),
        ],
        pricePerNight: Number.isFinite(minRate) ? minRate : 0,
        description: `${hotel.hotelName} (${hotel.category}) near airport transit area.`,
      };
    });
  }

  private async rankHotelsByGroup(
    groupedBookings: Map<string, BookingEntity[]>,
    hotels: AvailabilityHotel[],
    requestId: string,
  ): Promise<Map<string, string[]>> {
    const aiHotels = this.toAiHotelCandidates(hotels);
    const fallbackOrder = aiHotels
      .slice()
      .sort((a, b) => a.pricePerNight - b.pricePerNight)
      .map((item) => item.id);

    const rankingByGroup = new Map<string, string[]>();

    for (const [groupKey, groupBookings] of groupedBookings.entries()) {
      const first = groupBookings[0];
      const specialNotes = Array.from(
        new Set(groupBookings.flatMap((booking) => booking.specialNotes ?? [])),
      );

      try {
        const aiResult = await this.groqService.rankHotelsForPassengerGroup(
          {
            travelClass: first.travelClass,
            passengerProfile: first.children > 0 ? "family" : "standard",
            totalBookings: groupBookings.length,
            totalAdults: groupBookings.reduce(
              (sum, item) => sum + item.adults,
              0,
            ),
            totalChildren: groupBookings.reduce(
              (sum, item) => sum + item.children,
              0,
            ),
            specialNotes,
          },
          aiHotels,
          requestId,
        );

        const aiRanked = (aiResult?.recommendations ?? [])
          .filter((item: any) => typeof item?.hotelId === "string")
          .sort(
            (a: any, b: any) => Number(b?.score ?? 0) - Number(a?.score ?? 0),
          )
          .map((item: any) => String(item.hotelId));

        const mergedOrder = Array.from(
          new Set([...aiRanked, ...fallbackOrder]),
        );
        rankingByGroup.set(groupKey, mergedOrder);
      } catch (error: any) {
        this.logger.warn(
          `Groq ranking failed for group ${groupKey}, using deterministic fallback order`,
          this.context,
          requestId,
          { error: error.message },
        );
        rankingByGroup.set(groupKey, fallbackOrder);
      }
    }

    return rankingByGroup;
  }

  private getBestRatesForHotelAndSplit(
    rates: AvailabilityRoomRate[],
    split: RoomOccupancy[],
  ): Array<{
    adults: number;
    children: number;
    rateKey: string;
    roomName: string;
    boardName: string;
    price: number;
    currency: string;
  }> | null {
    const buckets = new Map<string, AvailabilityRoomRate[]>();
    for (const rate of rates) {
      const key = this.occupancyKey({
        adults: rate.adults,
        children: rate.children,
        childrenAges: rate.childrenAges,
      });
      const existing = buckets.get(key);
      if (existing) {
        existing.push(rate);
      } else {
        buckets.set(key, [rate]);
      }
    }

    const selected: Array<{
      adults: number;
      children: number;
      rateKey: string;
      roomName: string;
      boardName: string;
      price: number;
      currency: string;
    }> = [];

    for (const occupancy of split) {
      const key = this.occupancyKey(occupancy);
      const candidates = (buckets.get(key) ?? [])
        .filter((rate) => rate.allotment === null || rate.allotment > 0)
        .sort((a, b) => a.netPrice - b.netPrice);

      if (!candidates.length) {
        return null;
      }

      const best = candidates[0];
      selected.push({
        adults: occupancy.adults,
        children: occupancy.children,
        rateKey: best.rateKey,
        roomName: best.roomName,
        boardName: best.boardName,
        price: best.netPrice,
        currency: best.currency,
      });
    }

    return selected;
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

  async getHotelRecommendationsForFlight(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
  ) {
    requestLogger.info("Starting flight-level hotel recommendation process", {
      context: this.context,
      flightId,
    });

    const flight =
      await this.cancelledFlightsRepository.findFlightWithRelations(
        flightId,
        requestId,
      );
    if (!flight) {
      requestLogger.error(`Cancelled flight '${flightId}' not found`, {
        context: this.context,
        flightId,
      });
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    if (flight.status !== FlightStatus.PASSENGERS_BOOKING_CONFIRMED) {
      requestLogger.error(
        `Flight '${flightId}' is not eligible for hotel recommendation in status '${flight.status}'`,
        {
          context: this.context,
          flightId,
          status: flight.status,
        },
      );
      throw new BadRequestException(
        `Flight '${flightId}' is not eligible for hotel recommendation in status '${flight.status}'`,
      );
    }

    const checkIn = flight.cancellationDate;
    if (!checkIn) {
      requestLogger.error(
        `Cancellation date not found for flight '${flightId}'`,
        {
          context: this.context,
          flightId,
        },
      );
      throw new BadRequestException(
        `Cancellation date not found for flight '${flightId}'`,
      );
    }

    const checkInDateObj = new Date(checkIn);
    if (Number.isNaN(checkInDateObj.getTime())) {
      requestLogger.error(
        `Invalid cancellation date '${checkIn}' for flight '${flightId}'`,
        {
          context: this.context,
          flightId,
        },
      );
      throw new BadRequestException(
        `Invalid cancellation date '${checkIn}' for flight '${flightId}'`,
      );
    }

    const checkOutDateObj = new Date(checkInDateObj);
    checkOutDateObj.setDate(checkOutDateObj.getDate() + 1);
    const checkOut = checkOutDateObj.toISOString().split("T")[0];
    requestLogger.info(
      `Calculated check-in date ${checkIn} and check-out date ${checkOut} for flight '${flightId}'`,
      {
        context: this.context,
        flightId,
      },
    );

    const departureAirport = flight.departureAirport;
    if (!departureAirport) {
      requestLogger.error(
        `Departure airport not found for flight '${flightId}'`,
        {
          context: this.context,
          flightId,
        },
      );
      throw new NotFoundException(
        `Departure airport not found for flight '${flightId}'`,
      );
    }

    const bookings =
      await this.cancelledFlightsRepository.findBookingsByFlightId(
        flightId,
        requestId,
      );
    if (bookings.length === 0) {
      requestLogger.error(
        `No eligible bookings found for flight '${flightId}'`,
        {
          context: this.context,
          flightId,
        },
      );
      throw new BadRequestException(
        `No eligible bookings found for flight '${flightId}'`,
      );
    }

    requestLogger.info(
      `Loaded bookings for recommendation for flight '${flightId}'`,
      {
        context: this.context,
        flightId,
        bookingCount: bookings.length,
        totalPassengers: bookings.reduce(
          (sum, item) => sum + item.adults + item.children,
          0,
        ),
      },
    );

    const splitPlansByBooking = new Map<number, RoomSplitPlan>();
    const results: BookingRecommendationResult[] = [];

    for (const booking of bookings) {
      const split = this.resolveRoomSplitPlan(booking, requestLogger);
      if (!split.plan) {
        results.push({
          bookingId: booking.id,
          pnr: booking.pnr,
          class: booking.travelClass,
          passengers: {
            adults: booking.adults,
            children: booking.children,
          },
          allocationStatus: "INVALID_PASSENGER_DATA",
          reason: split.reason,
        });
        continue;
      }
      splitPlansByBooking.set(booking.id, split.plan);
    }

    const eligibleBookings = bookings.filter((booking) =>
      splitPlansByBooking.has(booking.id),
    );

    if (eligibleBookings.length === 0) {
      requestLogger.error(
        `No eligible bookings with valid room split plans found for flight '${flightId}'`,
        {
          context: this.context,
          flightId,
        },
      );
      return {
        cancelledFlightId: flight.id,
        status: "RECOMMENDATIONS_READY",
        summary: {
          totalBookings: bookings.length,
          allocatedBookings: 0,
          failedBookings: results.length,
          totalRooms: 0,
          totalBuyingPrice: 0,
          currency: "EUR",
        },
        allocations: results,
      };
    }

    const uniqueOccupancies = Array.from(
      new Map(
        eligibleBookings.flatMap((booking) => {
          const split = splitPlansByBooking.get(booking.id)!;
          const allRooms = [split.preferred, ...split.fallbacks].flat();
          return allRooms.map(
            (occupancy) => [this.occupancyKey(occupancy), occupancy] as const,
          );
        }),
      ).values(),
    );

    requestLogger.info("Calculated deduplicated occupancy requirements", {
      context: this.context,
      flightId,
      occupancyCount: uniqueOccupancies.length,
    });

    let hotels: AvailabilityHotel[] = [];
    try {
      hotels = await this.hotelPartnerService.searchNearbyHotelsWithOccupancies(
        {
          iataCode: departureAirport.iataCode,
          latitude: Number(departureAirport.latitude),
          longitude: Number(departureAirport.longitude),
        },
        checkIn,
        checkOut,
        uniqueOccupancies,
        requestId,
        requestLogger,
      );
    } catch (error: any) {
      this.logger.error(
        "Hotel availability search failed",
        this.context,
        requestId,
        { error: error.message },
      );

      const noAvailability = eligibleBookings.map((booking) => ({
        bookingId: booking.id,
        pnr: booking.pnr,
        class: booking.travelClass,
        passengers: {
          adults: booking.adults,
          children: booking.children,
        },
        allocationStatus: "NO_AVAILABILITY" as AllocationStatus,
        reason: "Failed to retrieve hotel availability",
      }));

      return {
        cancelledFlightId: flight.id,
        status: "RECOMMENDATIONS_READY",
        summary: {
          totalBookings: bookings.length,
          allocatedBookings: 0,
          failedBookings: noAvailability.length + results.length,
          totalRooms: 0,
          totalBuyingPrice: 0,
          currency: "EUR",
        },
        allocations: [...results, ...noAvailability],
      };
    }

    this.logger.info("Hotel availability loaded", this.context, requestId, {
      flightId,
      hotelCount: hotels.length,
      rateCount: hotels.reduce((sum, hotel) => sum + hotel.rates.length, 0),
    });

    const groupedBookings = this.groupBookings(eligibleBookings);
    const rankingByGroup = await this.rankHotelsByGroup(
      groupedBookings,
      hotels,
      requestId,
    );

    const hotelByAiId = new Map<string, AvailabilityHotel>(
      hotels.map((hotel) => [`hb-${hotel.hotelCode}`, hotel] as const),
    );

    for (const booking of eligibleBookings) {
      const splitPlan = splitPlansByBooking.get(booking.id)!;
      const groupKey = this.toGroupKey(booking);
      const rankedHotelIds = rankingByGroup.get(groupKey) ?? [];

      let allocation: BookingRecommendationResult | null = null;
      const splitCandidates: Array<{
        label: "preferred" | "fallback";
        rooms: RoomOccupancy[];
      }> = [
        { label: "preferred", rooms: splitPlan.preferred },
        ...splitPlan.fallbacks.map((rooms) => ({
          label: "fallback" as const,
          rooms,
        })),
      ];

      for (const splitCandidate of splitCandidates) {
        for (const aiHotelId of rankedHotelIds) {
          const hotel = hotelByAiId.get(aiHotelId);
          if (!hotel) {
            continue;
          }

          const selectedRooms = this.getBestRatesForHotelAndSplit(
            hotel.rates,
            splitCandidate.rooms,
          );

          if (!selectedRooms) {
            continue;
          }

          const totalPrice = selectedRooms.reduce(
            (sum, roomRate) => sum + roomRate.price,
            0,
          );
          allocation = {
            bookingId: booking.id,
            pnr: booking.pnr,
            class: booking.travelClass,
            passengers: {
              adults: booking.adults,
              children: booking.children,
            },
            splitTried: splitCandidate.label,
            hotel: {
              hotelCode: hotel.hotelCode,
              hotelName: hotel.hotelName,
              category: hotel.category,
            },
            rooms: selectedRooms,
            totalPrice,
            allocationStatus: "RECOMMENDED",
          };
          break;
        }

        if (allocation) {
          break;
        }
      }

      if (allocation) {
        results.push(allocation);
      } else {
        results.push({
          bookingId: booking.id,
          pnr: booking.pnr,
          class: booking.travelClass,
          passengers: {
            adults: booking.adults,
            children: booking.children,
          },
          allocationStatus: "NO_SUITABLE_HOTEL",
          reason:
            "No available hotel could satisfy preferred or fallback room occupancy requirements",
        });
      }
    }

    const allocated = results.filter(
      (item) => item.allocationStatus === "RECOMMENDED",
    );
    const failed = results.length - allocated.length;
    const totalRooms = allocated.reduce(
      (sum, item) => sum + (item.rooms?.length ?? 0),
      0,
    );
    const totalBuyingPrice = allocated.reduce(
      (sum, item) => sum + (item.totalPrice ?? 0),
      0,
    );
    const currency =
      allocated.find((item) => item.rooms?.[0]?.currency)?.rooms?.[0]
        ?.currency ?? "EUR";

    this.logger.info(
      "Completed flight-level hotel recommendation process",
      this.context,
      requestId,
      {
        flightId,
        allocatedBookings: allocated.length,
        failedBookings: failed,
      },
    );

    return {
      cancelledFlightId: flight.id,
      status: "RECOMMENDATIONS_READY",
      summary: {
        totalBookings: bookings.length,
        allocatedBookings: allocated.length,
        failedBookings: failed,
        totalRooms,
        totalBuyingPrice,
        currency,
      },
      allocations: results,
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
