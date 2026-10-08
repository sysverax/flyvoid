import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Logger } from "winston";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";
import { BookingEntity } from "./entities/booking.entity";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { randomUUID } from "crypto";
import {
  HotelAllocationEntity,
  HotelBookingAttempt,
  HotelBookingAttemptRecord,
} from "./entities/hotel-allocation.entity";
import { FlightStatus, HotelAllocationStatus, TravelClass } from "./entities/enums";
import {
  AvailabilityHotel,
  AvailabilityRoomRate,
  HOTEL_PROVIDER,
  HotelBookingOutcomeUnknownError,
  HotelBookingResult,
  HotelContentDetails,
  HotelProvider,
  HotelRateCheck,
  RoomOccupancy,
} from "./hotel-providers/hotel-provider.interface";
import { AiService } from "../common/ai/ai.service";
import { AuthenticatedRequest } from "../auth/interfaces/authenticated-request.interface";
import { config } from "../config/config";
import {
  HotelAllocationBookingResultDto,
  HotelAllocationsDto,
} from "./dto/hotel-allocations.dto";
import {
  AllotmentLedger,
  BookingCandidate,
  LedgerClaim,
  RoomNeed,
  ShapePool,
  buildSupplyPools,
  chooseRoomSplit,
  classRank,
  compareBookingPriority,
  rankCandidates,
  shapeKey,
  toRoomNeeds,
} from "./hotel-allocation.planner";
import { BookHotelRequestDto } from "./dto/book-hotel-request.dto";

type AllocationStatus =
  | "RECOMMENDED"
  | "NO_SUITABLE_HOTEL"
  | "INVALID_PASSENGER_DATA"
  | "NO_AVAILABILITY";

interface RoomSplitPlan {
  preferred: RoomOccupancy[];
  fallbacks: RoomOccupancy[][];
}

interface StayDates {
  checkIn: string;
  checkOut: string;
  checkInDate: Date;
  checkOutDate: Date;
}

interface AllocationRunState {
  attemptsByBooking: Map<number, number>;
  currency: string | null;
}

interface AllocationRunContext {
  flight: CancelledFlightEntity;
  stay: StayDates;
  platformFeePercentage: number;
  requestId: string;
  requestLogger: Logger;
  runState: AllocationRunState;
}

interface BookingPlanningState {
  hotels: AvailabilityHotel[];
  pools: Map<string, ShapePool>;
  ledger: AllotmentLedger;
  contentCache: Map<string, Promise<HotelContentDetails | null>>;
}

type BookingAttemptOutcome =
  | {
      kind: "confirmed";
      allocation: HotelAllocationEntity;
      references: string[];
      currency: string;
    }
  | { kind: "rejected"; reason: string; error?: unknown }
  | { kind: "unknown"; reason: string }
  | { kind: "blocked"; reason: string };

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
    stars: number;
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
  "6_0": {
    preferred: [room(2), room(2), room(2)],
    fallbacks: [[room(3), room(2), room(1)]],
  },
  "7_0": {
    preferred: [room(2), room(2), room(2), room(1)],
    fallbacks: [[room(3), room(2), room(2)]],
  },
  "8_0": {
    preferred: [room(2), room(2), room(2), room(2)],
    fallbacks: [[room(3), room(2), room(2), room(1)]],
  },
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
  "2_3": { preferred: [room(1, 2), room(1, 1)], fallbacks: [[room(2, 3)]] },
  "2_4": { preferred: [room(1, 2), room(1, 2)], fallbacks: [[room(2, 4)]] },

  "3_1": {
    preferred: [room(2), room(1, 1)],
    fallbacks: [[room(2, 1), room(1)]],
  },
  "3_2": {
    preferred: [room(2), room(1, 2)],
    fallbacks: [[room(2, 1), room(1, 1)]],
  },
  "3_3": {
    preferred: [room(2), room(1, 3)],
    fallbacks: [[room(2, 2), room(1, 1)]],
  },
  "3_4": {
    preferred: [room(2, 1), room(1, 3)],
    fallbacks: [[room(2, 2), room(1, 2)]],
  },
  "4_1": {
    preferred: [room(2), room(2, 1)],
    fallbacks: [[room(2, 1), room(1), room(1)]],
  },
  "4_2": {
    preferred: [room(2), room(2, 2)],
    fallbacks: [[room(2, 1), room(2, 1)]],
  },
  "4_3": {
    preferred: [room(2, 1), room(2, 2)],
    fallbacks: [[room(2), room(1, 3), room(1)]],
  },
  "4_4": {
    preferred: [room(2, 2), room(2, 2)],
    fallbacks: [[room(2), room(1, 3), room(1, 1)]],
  },
  "5_1": {
    preferred: [room(2), room(2), room(1, 1)],
    fallbacks: [[room(2), room(2, 1), room(1)]],
  },
  "5_2": {
    preferred: [room(2), room(2), room(1, 2)],
    fallbacks: [[room(2), room(2, 1), room(1, 1)]],
  },
  "5_3": {
    preferred: [room(2), room(2, 1), room(1, 2)],
    fallbacks: [[room(2), room(2), room(1, 3)]],
  },
  "5_4": {
    preferred: [room(2), room(2, 2), room(1, 2)],
    fallbacks: [[room(2, 2), room(2, 2), room(1)]],
  },
  "6_1": {
    preferred: [room(2), room(2), room(2, 1)],
    fallbacks: [[room(2), room(2), room(1, 1), room(1)]],
  },
  "6_2": {
    preferred: [room(2), room(2), room(2, 2)],
    fallbacks: [[room(2), room(2), room(1, 1), room(1, 1)]],
  },
  "6_3": {
    preferred: [room(2), room(2, 1), room(2, 2)],
    fallbacks: [[room(2), room(2), room(1, 1), room(1, 2)]],
  },
  "7_1": {
    preferred: [room(2), room(2), room(2), room(1, 1)],
    fallbacks: [[room(2), room(2), room(2, 1), room(1)]],
  },
  "7_2": {
    preferred: [room(2), room(2), room(2), room(1, 2)],
    fallbacks: [[room(2), room(2), room(2, 1), room(1, 1)]],
  },
  "8_1": {
    preferred: [room(2), room(2), room(2), room(2, 1)],
    fallbacks: [[room(2), room(2), room(2), room(1, 1), room(1)]],
  },
};

@Injectable()
export class HotelAllocationService {
  private readonly context = "HotelAllocationService";

  constructor(
    private readonly cancelledFlightsRepository: CancelledFlightsRepository,
    @Inject(HOTEL_PROVIDER) private readonly hotelProvider: HotelProvider,
    private readonly aiService: AiService,
  ) {}

  // Duplicated from CancelledFlightsService (kept tiny and independent so
  // this service has no dependency back on it).
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

  private occupancyKey(occupancy: RoomOccupancy): string {
    const ages = (occupancy.childrenAges ?? []).join("-");
    return `${occupancy.adults}_${occupancy.children}_${ages}`;
  }

  // Adults/children only, no ages - bookings never carry child ages, so an
  // ages-aware key never matches a real rate. Use for matching supply to
  // demand; occupancyKey (with ages) stays for building the search request.
  private roomShapeKey(occupancy: { adults: number; children: number }): string {
    return `${occupancy.adults}_${occupancy.children}`;
  }

  private roundCurrency(value: number): number {
    // Every computed price passes through here before being persisted - if
    // an upstream value is ever NaN/Infinity (e.g. a malformed supplier
    // rate), stop it here rather than writing a poisoned total that
    // silently NaNs every future SUM() over this column (Postgres numeric
    // uniquely allows storing NaN, and COALESCE does not catch it).
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const runnerCount = Math.max(1, Math.min(limit, items.length));
    const runners = Array.from({ length: runnerCount }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index], index);
      }
    });
    await Promise.all(runners);
    return results;
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
      requestLogger.warn(
        `Invalid passenger data for booking '${booking.id}': adults must be at least 1`,
        {
          context: this.context,
          bookingId: booking.id,
        },
      );
      return { reason: "Adults must be at least 1" };
    }
    if (booking.children < 0) {
      requestLogger.warn(
        `Invalid passenger data for booking '${booking.id}': children cannot be negative`,
        {
          context: this.context,
          bookingId: booking.id,
        },
      );
      return { reason: "Children cannot be negative" };
    }
    if (booking.children > 0 && booking.adults === 0) {
      requestLogger.warn(
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
        id: `hotel-${hotel.hotelCode}`,
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
    requestLogger: Logger,
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
        const aiResult = await this.aiService.rankHotelsForPassengerGroup(
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
        requestLogger.debug("AI hotel ranking received for group", {
          context: this.context,
          groupKey,
          aiRankedCount: aiRanked.length,
          topHotelIds: mergedOrder.slice(0, 3),
        });
      } catch (error: any) {
        requestLogger.warn(
          `AI ranking failed for group ${groupKey}, using deterministic fallback order`,
          { context: this.context, error: error.message },
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
      const key = this.roomShapeKey(rate);
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
      const key = this.roomShapeKey(occupancy);
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
        price: this.roundCurrency(best.netPrice),
        currency: best.currency,
      });
    }

    return selected;
  }
  // ── AI Hotel Recommendations & Allocation ───────────────────────────────

  async getHotelRecommendations(
    flightId: number,
    bookingId: number,
    requestId: string,
    requestLogger: Logger,
  ) {
    requestLogger.info(
      `Starting hotel recommendations process for flight: ${flightId}, booking: ${bookingId}`,
      { context: this.context },
    );

    const flight =
      await this.cancelledFlightsRepository.findFlightWithRelations(
        flightId,
        requestLogger,
      );
    if (!flight) {
      requestLogger.warn("Cancelled flight not found for hotel recommendations", {
        context: this.context,
        flightId,
      });
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }
    requestLogger.info(
      `Successfully fetched flight record: ${flight.flightNumber}`,
      { context: this.context },
    );

    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestLogger,
    );
    requestLogger.info(
      `Successfully fetched booking record for PNR: ${booking.pnr}`,
      { context: this.context },
    );

    const departureAirport = flight.departureAirport;
    if (!departureAirport) {
      requestLogger.warn("Departure airport not found for flight", {
        context: this.context,
        flightId,
      });
      throw new NotFoundException(
        `Departure airport not found for flight '${flightId}'`,
      );
    }
    requestLogger.info(
      `Resolved departure airport: ${departureAirport.iataCode} (${departureAirport.latitude}, ${departureAirport.longitude})`,
      { context: this.context },
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
    requestLogger.info(
      `Resolved stay dates - check-in: ${checkIn}, check-out: ${finalCheckOut}`,
      { context: this.context },
    );

    requestLogger.info(`Querying hotel supplier for nearby hotels...`, {
      context: this.context,
    });
    const candidateHotels = await this.hotelProvider.searchNearbyHotels(
      {
        iataCode: departureAirport.iataCode,
        latitude: Number(departureAirport.latitude),
        longitude: Number(departureAirport.longitude),
      },
      checkIn,
      finalCheckOut,
      requestId,
      requestLogger,
    );
    requestLogger.info(
      `Received ${candidateHotels.length} candidate hotels from hotel supplier`,
      { context: this.context, candidateHotelCount: candidateHotels.length },
    );

    requestLogger.info(
      `Calling AI API for AI-based scoring and recommendation matching...`,
      { context: this.context },
    );
    const aiResult = await this.aiService.getHotelRecommendations(
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
    requestLogger.info(
      `Received AI recommendations: ${JSON.stringify(aiResult)}`,
      { context: this.context },
    );

    // Map recommendation scores and reasoning to hotel objects
    requestLogger.info(`Mapping AI scores and reasons to candidate hotels...`, {
      context: this.context,
    });
    const recommendedHotels = candidateHotels
      .map((hotel) => {
        const recommendation = aiResult.recommendations?.find(
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
    requestLogger.info(
      `Hotel recommendations generated: ${recommendedHotels.length}`,
      {
        context: this.context,
        flightId,
        bookingId,
        recommendedCount: recommendedHotels.length,
      },
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
        requestLogger,
      );
    if (!flight) {
      requestLogger.warn(`Cancelled flight '${flightId}' not found`, {
        context: this.context,
        flightId,
      });
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }

    if (flight.status !== FlightStatus.PASSENGERS_BOOKING_CONFIRMED) {
      requestLogger.warn(
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
      requestLogger.warn(
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
      requestLogger.warn(
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
      requestLogger.warn(
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
        requestLogger,
      );
    if (bookings.length === 0) {
      requestLogger.warn(
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
      requestLogger.warn(
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
      hotels = await this.hotelProvider.searchNearbyHotelsWithOccupancies(
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
      requestLogger.error("Hotel availability search failed", {
        context: this.context,
        flightId,
        error: error.message,
      });

      // fail with the real error rather than masking it as "no availability"
      if (error instanceof HttpException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `Hotel availability search failed for flight '${flightId}': ${error.message}`,
      );
    }

    requestLogger.info("Hotel availability loaded", {
      context: this.context,
      flightId,
      hotelCount: hotels.length,
      rateCount: hotels.reduce((sum, hotel) => sum + hotel.rates.length, 0),
    });
    requestLogger.debug(
      "Hotels found for flight",
      {
        context: this.context,
        flightId,
        hotels: hotels.map((hotel) => ({
          hotelName: hotel.hotelName,
          category: hotel.category,
          stars: hotel.stars,
          rateCount: hotel.rates.length,
          minPrice: hotel.rates.length
            ? Math.min(...hotel.rates.map((rate) => rate.netPrice))
            : null,
        })),
      },
    );

    const groupedBookings = this.groupBookings(eligibleBookings);
    const rankingByGroup = await this.rankHotelsByGroup(
      groupedBookings,
      hotels,
      requestId,
      requestLogger,
    );

    const hotelByAiId = new Map<string, AvailabilityHotel>(
      hotels.map((hotel) => [`hotel-${hotel.hotelCode}`, hotel] as const),
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

          const totalPrice = this.roundCurrency(
            selectedRooms.reduce((sum, roomRate) => sum + roomRate.price, 0),
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
              stars: hotel.stars,
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
        requestLogger.debug("Booking recommendation chosen", {
          context: this.context,
          flightId,
          bookingId: booking.id,
          pnr: booking.pnr,
          hotelName: allocation.hotel?.hotelName,
          splitTried: allocation.splitTried,
          totalPrice: allocation.totalPrice,
        });
        results.push(allocation);
      } else {
        requestLogger.warn(
          "No suitable hotel found for booking during recommendation",
          { context: this.context, flightId, bookingId: booking.id, pnr: booking.pnr },
        );
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
    const totalBuyingPrice = this.roundCurrency(
      allocated.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0),
    );
    const currency =
      allocated.find((item) => item.rooms?.[0]?.currency)?.rooms?.[0]
        ?.currency ?? "EUR";

    const summaryLog =
      failed > 0
        ? requestLogger.warn.bind(requestLogger)
        : requestLogger.info.bind(requestLogger);
    summaryLog("Completed flight-level hotel recommendation process", {
      flightId,
      allocatedBookings: allocated.length,
      failedBookings: failed,
    });

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

  private static readonly ALLOCATION_RUN_STATUSES: FlightStatus[] = [
    FlightStatus.PASSENGERS_BOOKING_CONFIRMED,
    FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS,
    FlightStatus.ALLOCATED,
  ];

  private static readonly REBOOKABLE_STATUSES = new Set<HotelAllocationStatus>([
    HotelAllocationStatus.DRAFT,
    HotelAllocationStatus.FAILED,
    HotelAllocationStatus.CANCELLED,
  ]);

  private static readonly MAX_ATTEMPT_HISTORY = 20;

  async hotelAllocationsForFlight(
    flightId: number,
    user: AuthenticatedRequest["user"],
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelAllocationsDto> {
    // ?? not || : a legitimate 0% fee is falsy and must not fall back to
    // the default.
    const platformFeePercentage =
      user.platformFeePercentage ?? config.platformFeePercentage;
    requestLogger.info("Starting flight-level hotel allocation and booking", {
      context: this.context,
      flightId,
    });

    const flight = await this.requireAirlineFlight(
      flightId,
      user,
      requestLogger,
    );
    if (!HotelAllocationService.ALLOCATION_RUN_STATUSES.includes(flight.status)) {
      throw new BadRequestException(
        `Flight '${flightId}' is not eligible for hotel allocation in status '${flight.status}'`,
      );
    }
    const stay = this.resolveStayDates(flight, requestLogger);
    if (!flight.departureAirport) {
      throw new NotFoundException(
        `Departure airport not found for flight '${flightId}'`,
      );
    }
    const bookings =
      await this.cancelledFlightsRepository.findBookingsByFlightId(
        flightId,
        requestLogger,
      );
    if (bookings.length === 0) {
      throw new BadRequestException(
        `No eligible bookings found for flight '${flightId}'`,
      );
    }

    const leaseMs = config.hotelBooking.allocationRunLeaseMs;
    const run = await this.cancelledFlightsRepository.claimFlightAllocationRun(
      flightId,
      HotelAllocationService.ALLOCATION_RUN_STATUSES,
      leaseMs,
      requestLogger,
    );
    if (!run.claimed) {
      if (run.reason === "running") {
        throw new ConflictException(
          `Hotel allocation is already running for flight '${flightId}'; wait for it to finish, then refresh`,
        );
      }
      if (run.reason === "missing") {
        throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
      }
      throw new BadRequestException(
        `Flight '${flightId}' is not eligible for hotel allocation in status '${run.status}'`,
      );
    }

    const runState: AllocationRunState = {
      attemptsByBooking: new Map(),
      currency: null,
    };
    let completion: Awaited<
      ReturnType<CancelledFlightsRepository["completeFlightAllocationRun"]>
    > | null = null;
    try {
      await this.cancelledFlightsRepository.markStaleInProgressAllocations(
        flightId,
        leaseMs,
        "Allocation run was interrupted during the supplier booking; check with the supplier before rebooking",
        requestLogger,
      );
      const rows = await this.cancelledFlightsRepository.findAllocationsByFlightId(
        flightId,
        requestLogger,
      );
      const rowByBooking = new Map(rows.map((row) => [row.bookingId, row]));
      const pending = bookings
        .filter((booking) => this.isRebookable(rowByBooking.get(booking.id)))
        .sort(compareBookingPriority);

      requestLogger.info("Resolved bookings to process in this allocation run", {
        context: this.context,
        flightId,
        totalBookings: bookings.length,
        pending: pending.length,
        skipped: bookings.length - pending.length,
      });

      if (pending.length > 0) {
        await this.bookPendingBookings(
          {
            flight,
            stay,
            platformFeePercentage,
            requestId,
            requestLogger,
            runState,
          },
          pending,
        );
      }
    } finally {
      completion = await this.cancelledFlightsRepository
        .completeFlightAllocationRun(flightId, platformFeePercentage, requestLogger)
        .catch((error: any) => {
          requestLogger.error("Could not complete the hotel allocation run", {
            context: this.context,
            flightId,
            error: error?.message,
          });
          return null;
        });
    }
    if (!completion) {
      throw new InternalServerErrorException(
        `Hotel allocation for flight '${flightId}' ran but its result could not be saved; refresh before retrying`,
      );
    }

    return this.buildAllocationSummary(
      flightId,
      bookings,
      completion,
      platformFeePercentage,
      runState,
      requestLogger,
    );
  }

  private resolveStayDates(
    flight: CancelledFlightEntity,
    requestLogger: Logger,
  ): StayDates {
    const checkIn = flight.cancellationDate;
    if (!checkIn) {
      requestLogger.warn(`Cancellation date not found for flight '${flight.id}'`, {
        context: this.context,
        flightId: flight.id,
      });
      throw new BadRequestException(
        `Cancellation date not found for flight '${flight.id}'`,
      );
    }
    const checkInDate = new Date(checkIn);
    if (Number.isNaN(checkInDate.getTime())) {
      throw new BadRequestException(
        `Invalid cancellation date '${checkIn}' for flight '${flight.id}'`,
      );
    }
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + 1);
    return {
      checkIn: String(checkIn),
      checkOut: checkOutDate.toISOString().split("T")[0],
      checkInDate,
      checkOutDate,
    };
  }

  private isRebookable(row: HotelAllocationEntity | undefined | null): boolean {
    if (!row) {
      return true;
    }
    if (
      row.status === HotelAllocationStatus.CONFIRMED &&
      row.bookingReference?.startsWith("temp-")
    ) {
      return true;
    }
    return HotelAllocationService.REBOOKABLE_STATUSES.has(row.status);
  }

  private async bookPendingBookings(
    run: AllocationRunContext,
    pending: BookingEntity[],
  ): Promise<void> {
    const { flight, stay, requestId, requestLogger } = run;

    const plans: Array<{ booking: BookingEntity; plan: RoomSplitPlan }> = [];
    for (const booking of pending) {
      const split = this.resolveRoomSplitPlan(booking, requestLogger);
      if (!split.plan) {
        await this.recordBookingFailed(
          run,
          booking,
          `Invalid passenger data: ${split.reason ?? "no room split"}`,
        );
        continue;
      }
      plans.push({ booking, plan: split.plan });
    }
    if (plans.length === 0) {
      return;
    }

    const uniqueOccupancies = Array.from(
      new Map(
        plans.flatMap(({ plan }) =>
          [plan.preferred, ...plan.fallbacks]
            .flat()
            .map((room) => [this.occupancyKey(room), room] as const),
        ),
      ).values(),
    );

    let hotels: AvailabilityHotel[];
    try {
      hotels = await this.hotelProvider.searchNearbyHotelsWithOccupancies(
        {
          iataCode: flight.departureAirport.iataCode,
          latitude: Number(flight.departureAirport.latitude),
          longitude: Number(flight.departureAirport.longitude),
        },
        stay.checkIn,
        stay.checkOut,
        uniqueOccupancies,
        requestId,
        requestLogger,
      );
    } catch (error: any) {
      requestLogger.error("Hotel availability search failed", {
        context: this.context,
        flightId: flight.id,
        error: error.message,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `Hotel availability search failed for flight '${flight.id}': ${error.message}`,
      );
    }

    const entries = plans.map(({ booking, plan }) => ({
      booking,
      needs: toRoomNeeds(chooseRoomSplit(plan, hotels)),
    }));

    const demand = new Map<string, RoomNeed>();
    for (const { needs } of entries) {
      for (const need of needs) {
        const key = shapeKey(need.shape);
        const current = demand.get(key);
        if (current) {
          current.roomsNeeded += need.roomsNeeded;
        } else {
          demand.set(key, { shape: need.shape, roomsNeeded: need.roomsNeeded });
        }
      }
    }
    const pools = buildSupplyPools(
      hotels,
      demand,
      config.hotelBooking.supplyBufferRatio,
    );
    requestLogger.info("Built hotel supply pools", {
      context: this.context,
      flightId: flight.id,
      hotelCount: hotels.length,
      pools: [...pools.values()].map((pool) => ({
        shape: pool.shapeKey,
        demand: pool.demand,
        target: pool.target,
        poolAllotment: pool.poolAllotment,
        totalAllotment: pool.totalAllotment,
        poolHotels: pool.hotelCodes.size,
        belowTarget: pool.poolAllotment < pool.target,
      })),
    });

    const planning: BookingPlanningState = {
      hotels,
      pools,
      ledger: new AllotmentLedger(hotels),
      contentCache: new Map(),
    };

    const ranks = [...new Set(entries.map((e) => classRank(e.booking.travelClass)))]
      .sort((a, b) => b - a);
    const concurrency = Math.max(1, config.hotelBooking.concurrencyPerClass);
    for (const rank of ranks) {
      const stage = entries.filter(
        (entry) => classRank(entry.booking.travelClass) === rank,
      );
      requestLogger.info("Booking hotels for cabin class stage", {
        context: this.context,
        flightId: flight.id,
        classRank: rank,
        bookings: stage.length,
      });
      await this.mapWithConcurrency(stage, concurrency, async (entry) => {
        await this.bookWithFallback(run, planning, entry.booking, entry.needs);
        await this.cancelledFlightsRepository.touchFlightAllocationRun(
          flight.id,
          requestLogger,
        );
      });
    }
  }

  private async bookWithFallback(
    run: AllocationRunContext,
    planning: BookingPlanningState,
    booking: BookingEntity,
    needs: RoomNeed[],
  ): Promise<void> {
    const { requestLogger } = run;
    const excludedRateKeys = new Set<string>();
    const maxAttempts = Math.max(1, config.hotelBooking.maxAttemptsPerBooking);
    let attempts = 0;
    let lastFailure: string | null = null;

    try {
      for (;;) {
        if (attempts >= maxAttempts) {
          await this.recordBookingFailed(
            run,
            booking,
            `Gave up after ${attempts} failed booking attempt(s); last failure: ${lastFailure}`,
          );
          return;
        }

        const candidates = rankCandidates(
          planning.hotels,
          needs,
          planning.ledger,
          planning.pools,
          excludedRateKeys,
        );
        let selected: { candidate: BookingCandidate; claim: LedgerClaim } | null =
          null;
        for (const candidate of candidates) {
          const claim = planning.ledger.tryClaim(
            candidate.picks.map((pick) => ({
              rateKey: pick.rate.rateKey,
              rooms: pick.roomsNeeded,
            })),
          );
          if (claim) {
            selected = { candidate, claim };
            break;
          }
        }
        if (!selected) {
          await this.recordBookingFailed(
            run,
            booking,
            lastFailure
              ? `Every candidate hotel failed to book; last failure: ${lastFailure}`
              : `No hotel near the airport has rooms left for this booking's room split (${this.describeNeeds(needs)})`,
          );
          return;
        }

        const { candidate, claim } = selected;
        attempts += 1;
        run.runState.attemptsByBooking.set(booking.id, attempts);
        requestLogger.info("Attempting hotel booking candidate", {
          context: this.context,
          flightId: run.flight.id,
          bookingId: booking.id,
          pnr: booking.pnr,
          attempt: attempts,
          hotelCode: candidate.hotel.hotelCode,
          stars: candidate.hotel.stars,
          tier: candidate.tier,
          totalPrice: candidate.totalPrice,
        });

        const outcome = await this.attemptHotelBooking({
          flight: run.flight,
          booking,
          rooms: candidate.picks.flatMap((pick) =>
            Array.from({ length: pick.roomsNeeded }, () => ({
              rateKey: pick.rate.rateKey,
              shape: pick.shape,
            })),
          ),
          platformFeePercentage: run.platformFeePercentage,
          requestId: run.requestId,
          requestLogger,
          contentCache: planning.contentCache,
        });

        if (outcome.kind === "confirmed") {
          planning.ledger.commit(claim);
          run.runState.currency ??= outcome.currency;
          return;
        }
        if (outcome.kind === "unknown") {
          planning.ledger.commit(claim);
          return;
        }
        if (outcome.kind === "blocked") {
          planning.ledger.release(claim);
          return;
        }
        planning.ledger.release(claim);
        for (const pick of candidate.picks) {
          excludedRateKeys.add(pick.rate.rateKey);
        }
        lastFailure = `${candidate.hotel.hotelName}: ${outcome.reason}`;
      }
    } catch (error: any) {
      requestLogger.error("Unexpected error while booking a hotel for a PNR", {
        context: this.context,
        flightId: run.flight.id,
        bookingId: booking.id,
        pnr: booking.pnr,
        error: error?.message,
        stack: error?.stack,
      });
    }
  }

  private describeNeeds(needs: RoomNeed[]): string {
    return needs
      .map(
        (need) =>
          `${need.roomsNeeded} x ${need.shape.adults} adult(s) + ${need.shape.children} child(ren)`,
      )
      .join(", ");
  }

  private async recordBookingFailed(
    run: AllocationRunContext,
    booking: BookingEntity,
    reason: string,
  ): Promise<void> {
    const { requestLogger } = run;
    requestLogger.warn("PNR hotel booking failed", {
      context: this.context,
      flightId: run.flight.id,
      bookingId: booking.id,
      pnr: booking.pnr,
      reason,
    });
    try {
      await this.cancelledFlightsRepository.claimHotelReservation(
        booking.id,
        (latest) => {
          this.assertHotelBookable(booking.id, latest);
          return latest
            ? {
                id: latest.id,
                status: HotelAllocationStatus.FAILED,
                bookingReference: "",
                reason,
              }
            : {
                cancelledFlightId: run.flight.id,
                bookingId: booking.id,
                checkInDate: run.stay.checkInDate.toISOString(),
                checkOutDate: run.stay.checkOutDate.toISOString(),
                hotelCode: "",
                hotelName: "",
                category: "",
                rooms: [],
                totalRooms: 0,
                platformFeePercentage: run.platformFeePercentage,
                status: HotelAllocationStatus.FAILED,
                bookingReference: "",
                reason,
              };
        },
        requestLogger,
      );
    } catch (error: any) {
      requestLogger.warn("Could not record the PNR's failed hotel booking", {
        context: this.context,
        bookingId: booking.id,
        error: error?.message,
      });
    }
  }

  private async attemptHotelBooking(input: {
    flight: CancelledFlightEntity;
    booking: BookingEntity;
    rooms: Array<{ rateKey: string; shape?: RoomOccupancy }>;
    paymentData?: unknown;
    platformFeePercentage: number;
    requestId: string;
    requestLogger: Logger;
    contentCache?: Map<string, Promise<HotelContentDetails | null>>;
  }): Promise<BookingAttemptOutcome> {
    const { flight, booking, rooms, requestId, requestLogger } = input;
    const rateKeys = rooms.map((room) => room.rateKey);

    const checks: HotelRateCheck[] = [];
    for (const room of rooms) {
      let check: HotelRateCheck;
      try {
        check = await this.hotelProvider.checkRate(room.rateKey, requestId);
      } catch (error: any) {
        return {
          kind: "rejected",
          reason: `Rate check failed: ${error?.message ?? error}`,
          error,
        };
      }
      if (
        room.shape &&
        (check.adults < room.shape.adults ||
          check.children < room.shape.children)
      ) {
        return {
          kind: "rejected",
          reason: `Rate re-check returned a room for ${check.adults} adult(s) + ${check.children} child(ren); the party needs ${room.shape.adults} + ${room.shape.children}`,
        };
      }
      checks.push(check);
    }
    if (new Set(checks.map((check) => check.hotelCode)).size > 1) {
      return {
        kind: "rejected",
        reason: "All rooms of one booking must be in the same hotel",
        error: new BadRequestException(
          "All rooms of one booking must be in the same hotel",
        ),
      };
    }
    const hotelCode = checks[0].hotelCode;
    const hotelName = checks[0].hotelName || hotelCode;

    const attemptRecord: HotelBookingAttemptRecord = {
      attemptId: randomUUID(),
      supplier: config.hotelProvider.name,
      hotelCode,
      hotelName,
      rateKeys,
      requestedAt: new Date().toISOString(),
      outcome: "in_progress",
    };
    let attempt: HotelAllocationEntity;
    const claimState: { attempt?: HotelBookingAttempt } = {};
    try {
      const claimed = await this.cancelledFlightsRepository.claimHotelReservation(
        booking.id,
        (latest) => {
          this.assertHotelBookable(booking.id, latest);
          claimState.attempt = {
            ...attemptRecord,
            history: this.attemptHistory(latest?.bookingAttempt),
          };
          return {
            ...(latest ? { id: latest.id } : {}),
            ...this.buildAllocationRow(
              flight.id,
              booking,
              checks.map((check, index) => ({
                check,
                rateKey: rateKeys[index],
                price: check.netPrice,
                buyingPrice: check.buyingPrice ?? check.netPrice,
              })),
              input.platformFeePercentage,
              latest ? undefined : null,
            ),
            status: HotelAllocationStatus.IN_PROGRESS,
            bookingReference: "",
            reason: `Booking ${rateKeys.length} room(s) at ${hotelName} with the supplier`,
            bookingAttempt: claimState.attempt,
          };
        },
        requestLogger,
      );
      attempt = claimed.attempt;
    } catch (error: any) {
      if (error instanceof ConflictException) {
        return { kind: "blocked", reason: error.message };
      }
      return {
        kind: "rejected",
        reason: `Could not record the booking attempt: ${error?.message ?? error}`,
        error,
      };
    }
    const inProgress = claimState.attempt!;

    const booked: Array<{
      check: HotelRateCheck;
      rateKey: string;
      result: HotelBookingResult;
    }> = [];
    try {
      for (const [index, rateKey] of rateKeys.entries()) {
        requestLogger.info("Booking hotel room with supplier", {
          context: this.context,
          flightId: flight.id,
          bookingId: booking.id,
          hotelCode,
          room: index + 1,
          rooms: rateKeys.length,
          attemptId: inProgress.attemptId,
        });
        const result = await this.hotelProvider.bookHotel(
          {
            firstName: booking.firstName,
            lastName: booking.lastName,
            bookingId: booking.id,
            pnr: booking.pnr,
            contactEmail: flight.airline?.contactEmail,
            contactPhone: flight.airline?.contactPhone,
          },
          rateKey,
          input.paymentData,
          requestId,
        );
        booked.push({ check: checks[index], rateKey, result });
      }
    } catch (error: any) {
      const message = String(error?.message ?? error);
      const references = booked.map((room) => room.result.bookingReference);
      const outcomeUnknown = error instanceof HotelBookingOutcomeUnknownError;

      if (!outcomeUnknown && booked.length === 0) {
        await this.saveAttemptState(
          attempt.id,
          {
            status: HotelAllocationStatus.FAILED,
            reason: `Booking at ${hotelName} failed: ${message}`,
            bookingAttempt: {
              ...inProgress,
              outcome: "failed",
              completedAt: new Date().toISOString(),
              error: message,
            },
          },
          requestLogger,
        );
        return { kind: "rejected", reason: message, error };
      }

      const unknownReference = outcomeUnknown
        ? (error as HotelBookingOutcomeUnknownError).supplierReference ?? null
        : null;
      const failedRoom = booked.length + 1;
      const reason =
        `Needs manual check with the supplier: ${booked.length} of ${rateKeys.length} room(s) booked at ${hotelName}` +
        (references.length ? ` (refs: ${references.join(", ")})` : "") +
        (outcomeUnknown
          ? `; room ${failedRoom} outcome unknown${unknownReference ? ` (supplier ref ${unknownReference})` : ""}: ${message}`
          : `; room ${failedRoom} failed: ${message}`) +
        ". Do not rebook until reconciled.";
      requestLogger.error("Hotel booking outcome needs manual check", {
        context: this.context,
        flightId: flight.id,
        bookingId: booking.id,
        pnr: booking.pnr,
        attemptId: inProgress.attemptId,
        reason,
      });
      await this.saveAttemptState(
        attempt.id,
        {
          status: HotelAllocationStatus.MANUAL_CHECK,
          reason,
          bookingAttempt: {
            ...inProgress,
            outcome: "unknown",
            completedAt: new Date().toISOString(),
            supplierReferences: references,
            unknownReference,
            error: message,
          },
        },
        requestLogger,
      );
      return { kind: "unknown", reason };
    }

    const references = booked.map((room) => room.result.bookingReference);
    const content = await this.cachedHotelContent(
      hotelCode,
      input.contentCache,
      requestId,
      requestLogger,
    );
    const row = this.buildAllocationRow(
      flight.id,
      booking,
      booked.map(({ check, rateKey, result }) => {
        const price = Number(result.costPerRoom ?? result.price ?? check.netPrice);
        return {
          check,
          rateKey,
          price,
          buyingPrice: Number(result.buyingPrice ?? price),
          hotelName: result.hotelName,
          address: result.hotelAddress,
        };
      }),
      input.platformFeePercentage,
      content,
    );
    const allConfirmed = booked.every(
      (room) => room.result.status === HotelAllocationStatus.CONFIRMED,
    );
    const finalAttempt: HotelBookingAttempt = {
      ...inProgress,
      outcome: allConfirmed ? "confirmed" : "unknown",
      completedAt: new Date().toISOString(),
      supplierReferences: references,
    };
    if (!allConfirmed) {
      const reason = `Supplier accepted the booking at ${hotelName} without confirming it (statuses: ${booked
        .map((room) => room.result.status)
        .join(", ")}; refs: ${references.join(", ")}). Check with the supplier.`;
      await this.saveAttemptState(
        attempt.id,
        { ...row, status: HotelAllocationStatus.MANUAL_CHECK, reason, bookingAttempt: finalAttempt },
        requestLogger,
      );
      return { kind: "unknown", reason };
    }

    try {
      const allocation = await this.cancelledFlightsRepository.saveHotelAllocation(
        {
          ...row,
          id: attempt.id,
          status: HotelAllocationStatus.CONFIRMED,
          bookingReference: references.join(","),
          reason: this.confirmedReason(booking, row.hotelName ?? hotelName, row.category ?? ""),
          bookingAttempt: finalAttempt,
        },
        requestLogger,
      );
      requestLogger.info("Hotel booked and confirmed for PNR", {
        context: this.context,
        flightId: flight.id,
        bookingId: booking.id,
        pnr: booking.pnr,
        hotelCode,
        bookingReference: allocation.bookingReference,
      });
      return {
        kind: "confirmed",
        allocation,
        references,
        currency: checks[0].currency,
      };
    } catch (error: any) {
      const reason = `Hotel booked with the supplier (${references.join(", ")}) but saving it failed: ${error?.message}. Record it manually; do not rebook.`;
      requestLogger.error("Hotel booked but saving the allocation failed", {
        context: this.context,
        bookingId: booking.id,
        allocationId: attempt.id,
        references,
        error: error?.message,
      });
      await this.saveAttemptState(
        attempt.id,
        {
          status: HotelAllocationStatus.MANUAL_CHECK,
          reason,
          bookingAttempt: { ...finalAttempt, outcome: "unknown", error: error?.message },
        },
        requestLogger,
      );
      return { kind: "unknown", reason };
    }
  }

  private async saveAttemptState(
    allocationId: number,
    changes: Partial<HotelAllocationEntity>,
    requestLogger: Logger,
  ): Promise<void> {
    await this.cancelledFlightsRepository
      .saveHotelAllocation({ ...changes, id: allocationId }, requestLogger)
      .catch((error: any) =>
        requestLogger.error("Could not record the hotel booking attempt outcome", {
          context: this.context,
          allocationId,
          status: changes.status,
          reason: changes.reason,
          error: error?.message,
        }),
      );
  }

  private attemptHistory(
    previous: HotelBookingAttempt | null | undefined,
  ): HotelBookingAttemptRecord[] {
    if (!previous) {
      return [];
    }
    const { history, ...record } = previous;
    return [...(history ?? []), record].slice(
      -HotelAllocationService.MAX_ATTEMPT_HISTORY,
    );
  }

  private cachedHotelContent(
    hotelCode: string,
    cache: Map<string, Promise<HotelContentDetails | null>> | undefined,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelContentDetails | null> {
    const load = () =>
      this.hotelProvider
        .getHotelContentDetails(hotelCode, requestId, requestLogger)
        .catch(() => null);
    if (!cache) {
      return load();
    }
    if (!cache.has(hotelCode)) {
      cache.set(hotelCode, load());
    }
    return cache.get(hotelCode)!;
  }

  private confirmedReason(
    booking: BookingEntity,
    hotelName: string,
    category: string,
  ): string {
    const specialNotes = booking.specialNotes ?? [];
    return (
      `Booked ${hotelName}${category ? ` (${category})` : ""} for ${booking.travelClass} class` +
      (specialNotes.length
        ? `; special request (${specialNotes.join(", ")}) recorded but not verifiable from hotel data - confirm with the hotel directly.`
        : ".")
    );
  }

  private async buildAllocationSummary(
    flightId: number,
    bookings: BookingEntity[],
    completion: {
      status: FlightStatus;
      totals: Awaited<
        ReturnType<CancelledFlightsRepository["completeFlightAllocationRun"]>
      >["totals"];
    },
    platformFeePercentage: number,
    runState: AllocationRunState,
    requestLogger: Logger,
  ): Promise<HotelAllocationsDto> {
    const rows = await this.cancelledFlightsRepository.findAllocationsByFlightId(
      flightId,
      requestLogger,
    );
    const rowByBooking = new Map(rows.map((row) => [row.bookingId, row]));
    const results: HotelAllocationBookingResultDto[] = [...bookings]
      .sort(compareBookingPriority)
      .map((booking) => {
        const row = rowByBooking.get(booking.id);
        const status = this.isRebookable(row)
          ? row?.status === HotelAllocationStatus.FAILED
            ? HotelAllocationStatus.FAILED
            : HotelAllocationStatus.DRAFT
          : row!.status;
        const confirmed = status === HotelAllocationStatus.CONFIRMED;
        const showHotel =
          !!row?.hotelCode &&
          (confirmed ||
            status === HotelAllocationStatus.MANUAL_CHECK ||
            status === HotelAllocationStatus.IN_PROGRESS);
        return {
          bookingId: booking.id,
          pnr: booking.pnr,
          travelClass: booking.travelClass,
          status,
          hotelCode: showHotel ? row!.hotelCode : null,
          hotelName: showHotel ? row!.hotelName : null,
          category: showHotel ? row!.category : null,
          bookingReference: confirmed ? row!.bookingReference : null,
          totalRooms: confirmed ? row!.totalRooms ?? 0 : 0,
          totalPrice: confirmed ? Number(row!.totalPrice ?? 0) : 0,
          attempts: runState.attemptsByBooking.get(booking.id) ?? 0,
          reason: row?.reason ?? null,
        };
      });
    const count = (status: HotelAllocationStatus) =>
      results.filter((result) => result.status === status).length;
    const confirmedBookings = count(HotelAllocationStatus.CONFIRMED);
    const failedBookings = count(HotelAllocationStatus.FAILED);
    const manualCheckBookings = count(HotelAllocationStatus.MANUAL_CHECK);
    const inProgressBookings = count(HotelAllocationStatus.IN_PROGRESS);

    requestLogger.info("Hotel allocation run summary", {
      context: this.context,
      flightId,
      flightStatus: completion.status,
      confirmedBookings,
      failedBookings,
      manualCheckBookings,
      inProgressBookings,
    });

    const { totals } = completion;
    return {
      cancelledFlightId: flightId,
      status: completion.status,
      totalBookings: bookings.length,
      confirmedBookings,
      allocatedBookings: confirmedBookings,
      failedBookings,
      manualCheckBookings,
      inProgressBookings,
      pendingBookings: count(HotelAllocationStatus.DRAFT),
      results,
      totalRooms: totals.totalHotelRooms,
      totalActualPrice: totals.totalActualPrice,
      totalSellingPrice: totals.totalSellingPrice,
      totalDiscounts: totals.totalDiscounts,
      totalHotelTaxes: totals.totalHotelTaxes,
      platformFeePercentage,
      totalPlatformFee: totals.totalPlatformFee,
      totalPrice: totals.totalPrice,
      currency: runState.currency ?? "EUR",
    };
  }

  private static readonly HOTEL_BOOKABLE_FLIGHT_STATUSES =
    new Set<FlightStatus>([
      FlightStatus.ALLOCATED,
      FlightStatus.PAID,
      FlightStatus.PUBLISHED,
    ]);

  /** The flight, or 404 when it doesn't exist or belongs to another airline. */
  private async requireAirlineFlight(
    flightId: number,
    user: AuthenticatedRequest["user"],
    requestLogger: Logger,
  ): Promise<CancelledFlightEntity> {
    const flight = await this.cancelledFlightsRepository.findFlightWithRelations(
      flightId,
      requestLogger,
    );
    if (!flight || flight.airlineId !== user.airlineId) {
      requestLogger.warn("Cancelled flight not found for airline", {
        context: this.context,
        flightId,
        airlineId: user.airlineId,
        ownerAirlineId: flight?.airlineId,
      });
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }
    return flight;
  }

  /** Re-validates a rate with the active hotel supplier before booking. */
  async checkRate(
    flightId: number,
    bookingId: number,
    rateKey: string,
    user: AuthenticatedRequest["user"],
    requestId: string,
    requestLogger: Logger,
  ): Promise<Omit<HotelRateCheck, "buyingPrice">> {
    await this.requireAirlineFlight(flightId, user, requestLogger);
    await this.requireBookingForFlight(bookingId, flightId, requestLogger);
    requestLogger.info("Checking rate with hotel supplier", {
      context: this.context,
      flightId,
      bookingId,
    });
    // buyingPrice is our cost; airlines don't see it (as in hotel-bookings).
    const { buyingPrice, ...check } = await this.hotelProvider.checkRate(
      rateKey,
      requestId,
    );
    return check;
  }

  async bookHotel(
    flightId: number,
    bookingId: number,
    dto: BookHotelRequestDto,
    user: AuthenticatedRequest["user"],
    requestId: string,
    requestLogger: Logger,
  ) {
    const flight = await this.requireAirlineFlight(
      flightId,
      user,
      requestLogger,
    );
    if (!HotelAllocationService.HOTEL_BOOKABLE_FLIGHT_STATUSES.has(flight.status)) {
      throw new BadRequestException(
        `Flight '${flightId}' is not ready for hotel booking in status '${flight.status}'; allocate hotels first`,
      );
    }
    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestLogger,
    );

    const current =
      await this.cancelledFlightsRepository.findAllocationByBookingId(
        booking.id,
        requestLogger,
      );
    this.assertHotelBookable(booking.id, current);
    const rateKeys = this.resolveRateKeys(dto, booking.id, current);
    const storedRooms = current?.rooms ?? [];

    const outcome = await this.attemptHotelBooking({
      flight,
      booking,
      rooms: rateKeys.map((rateKey, index) => ({
        rateKey,
        shape:
          storedRooms.length === rateKeys.length
            ? {
                adults: storedRooms[index].adults,
                children: storedRooms[index].children,
              }
            : undefined,
      })),
      paymentData: dto.paymentData,
      platformFeePercentage:
        user.platformFeePercentage ?? config.platformFeePercentage,
      requestId,
      requestLogger,
    });

    if (outcome.kind === "blocked") {
      throw new ConflictException(outcome.reason);
    }
    if (outcome.kind === "unknown") {
      throw new BadGatewayException(outcome.reason);
    }
    if (outcome.kind === "rejected") {
      if (outcome.error instanceof HttpException) {
        throw outcome.error;
      }
      throw new BadGatewayException(outcome.reason);
    }

    if (flight.status === FlightStatus.ALLOCATED) {
      await this.cancelledFlightsRepository.refreshFlightTotals(
        flight.id,
        requestLogger,
      );
    }

    const { allocation } = outcome;
    return {
      id: allocation.id,
      bookingId: booking.id,
      hotelCode: allocation.hotelCode,
      hotelName: allocation.hotelName,
      address: allocation.address ?? null,
      checkInDate: allocation.checkInDate,
      checkOutDate: allocation.checkOutDate,
      totalRooms: allocation.totalRooms,
      rooms: (allocation.rooms ?? []).map(({ rateKey, ...room }) => room),
      totalPrice: allocation.totalPrice,
      currency: outcome.currency,
      bookingReference: allocation.bookingReference,
      status: allocation.status,
    };
  }

  private assertHotelBookable(
    bookingId: number,
    current: HotelAllocationEntity | null,
  ): void {
    if (this.isRebookable(current)) {
      return;
    }
    const status = current!.status;
    if (status === HotelAllocationStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Booking '${bookingId}' has a hotel booking attempt in progress (${current!.reason ?? "no details"})`,
      );
    }
    if (status === HotelAllocationStatus.MANUAL_CHECK) {
      throw new ConflictException(
        `Booking '${bookingId}' has a hotel booking awaiting a manual check with the supplier (${current!.reason ?? "no details"})`,
      );
    }
    throw new ConflictException(
      `Booking '${bookingId}' already has a hotel reservation in status '${status}' (${current!.bookingReference || "no reference"})`,
    );
  }

  /** Rate keys to book: from the request, else the rooms saved on the allocation. */
  private resolveRateKeys(
    dto: BookHotelRequestDto,
    bookingId: number,
    existing: HotelAllocationEntity | null,
  ): string[] {
    const allocatedRooms = existing?.rooms ?? [];
    const requested = dto.rateKeys?.length
      ? dto.rateKeys
      : dto.rateKey
        ? [dto.rateKey]
        : null;

    if (requested) {
      if (allocatedRooms.length > 0 && requested.length !== allocatedRooms.length) {
        throw new BadRequestException(
          `Booking '${bookingId}' is allocated ${allocatedRooms.length} room(s); send one rate key per room (got ${requested.length})`,
        );
      }
      return requested;
    }

    const stored = allocatedRooms.map((room) => room.rateKey);
    if (stored.length === 0 || stored.some((rateKey) => !rateKey)) {
      throw new BadRequestException(
        `No rate keys to book for booking '${bookingId}': send rateKeys, or re-run hotel allocation`,
      );
    }
    return stored as string[];
  }

  /** Allocation columns for the given rooms, priced with the platform fee. */
  private buildAllocationRow(
    flightId: number,
    booking: BookingEntity,
    rooms: Array<{
      check: HotelRateCheck;
      rateKey: string;
      price: number;
      buyingPrice: number;
      hotelName?: string;
      address?: string;
    }>,
    platformFeePercentage: number,
    content?: HotelContentDetails | null,
  ): Partial<HotelAllocationEntity> {
    const first = rooms[0];
    const price = rooms.reduce((sum, room) => sum + room.price, 0);
    const buyingPrice = rooms.reduce((sum, room) => sum + room.buyingPrice, 0);
    const pricing = this.calculatePricing(
      price,
      buyingPrice,
      platformFeePercentage,
      0,
      0,
    );

    return {
      cancelledFlightId: flightId,
      bookingId: booking.id,
      checkInDate: first.check.checkInDate,
      checkOutDate: first.check.checkOutDate,
      actualPrice: pricing.actualPrice,
      buyingPrice: pricing.buyingPrice,
      sellingPrice: pricing.sellingPrice,
      tax: pricing.tax,
      platformFeePercentage,
      platformFee: pricing.platformFee,
      totalPrice: pricing.totalPrice,
      earnings: pricing.earnings,
      discount: pricing.discount,
      hotelCode: first.check.hotelCode,
      hotelName: first.hotelName || first.check.hotelName,
      category: first.check.category,
      address:
        first.address || first.check.address || content?.address || null,
      // content === undefined: keep whatever profile the row already has
      ...(content !== undefined
        ? {
            contact: content?.contact ?? null,
            latitude: content?.latitude ?? null,
            longitude: content?.longitude ?? null,
            distanceFromAirportKm: content?.distanceFromAirportKm ?? null,
            imageUrl: content?.imageUrl ?? null,
            website: content?.website ?? null,
            amenities: content?.amenities ?? null,
          }
        : {}),
      rooms: rooms.map((room) => ({
        adults: room.check.adults,
        children: room.check.children,
        roomName: room.check.roomName,
        boardName: room.check.boardName,
        price: this.roundCurrency(room.price),
        rateKey: room.rateKey,
      })),
      totalRooms: rooms.length,
    };
  }

  private calculatePricing(
    actualPrice: number,
    buyingPrice: number,
    platformFeePercentage: number,
    commissionPercentage: number,
    tax: number,
  ): {
    totalPrice: number;
    actualPrice: number;
    buyingPrice: number;
    sellingPrice: number;
    tax: number;
    platformFee: number;
    totalCost: number;
    earnings: number;
    discount: number;
  } {
    const sellingPrice =
      actualPrice - actualPrice * (commissionPercentage / 100);
    const subTotal = sellingPrice + tax;
    const platformFee = subTotal * (platformFeePercentage / 100);
    const total = subTotal + platformFee;
    const earnings = total - buyingPrice;
    const discount = actualPrice - sellingPrice;

    return {
      totalPrice: this.roundCurrency(total),
      actualPrice: this.roundCurrency(actualPrice),
      buyingPrice: this.roundCurrency(buyingPrice),
      sellingPrice: this.roundCurrency(sellingPrice),
      tax: this.roundCurrency(tax),
      platformFee: this.roundCurrency(platformFee),
      totalCost: this.roundCurrency(total),
      earnings: this.roundCurrency(earnings),
      discount: this.roundCurrency(discount),
    };
  }
}
