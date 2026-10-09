import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Logger } from "winston";
import {
  CancelledFlightsRepository,
  isRebookableAllocation,
} from "./cancelled-flights.repository";
import { BookingEntity } from "./entities/booking.entity";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { randomUUID } from "crypto";
import { HotelAllocationEntity } from "./entities/hotel-allocation.entity";
import { HotelBookingAttemptEntity } from "./entities/hotel-booking-attempt.entity";
import { HotelBookingCandidateEntity } from "./entities/hotel-booking-candidate.entity";
import {
  FlightStatus,
  HotelAllocationStatus,
  HotelBookingAttemptStatus,
  HotelBookingFailureCode,
  TravelClass,
} from "./entities/enums";
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
  PnrBookingStatus,
} from "./dto/hotel-allocations.dto";
import {
  AllotmentLedger,
  LedgerClaim,
  RoomNeed,
  SelectedRate,
  buildCandidatePlan,
  buildSupplyPools,
  chooseRoomSplit,
  classRank,
  compareBookingPriority,
  selectCandidateRates,
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

interface AllocationRunContext {
  flight: CancelledFlightEntity;
  stay: StayDates;
  platformFeePercentage: number;
  requestId: string;
  requestLogger: Logger;
  runId: string;
}

interface BookingPlanningState {
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

  async startHotelAllocation(
    flightId: number,
    user: AuthenticatedRequest["user"],
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelAllocationsDto> {
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

    const runId = randomUUID();
    const run = await this.cancelledFlightsRepository.claimFlightAllocationRun(
      flightId,
      HotelAllocationService.ALLOCATION_RUN_STATUSES,
      config.hotelBooking.allocationRunLeaseMs,
      runId,
      requestLogger,
    );
    if (!run.claimed) {
      if (run.reason === "running") {
        throw new ConflictException(
          `Hotel allocation is already running for flight '${flightId}'`,
        );
      }
      if (run.reason === "missing") {
        throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
      }
      throw new BadRequestException(
        `Flight '${flightId}' is not eligible for hotel allocation in status '${run.status}'`,
      );
    }

    requestLogger.info("Hotel allocation run started in the background", {
      context: this.context,
      flightId,
      runId,
    });
    void this.executeAllocationRun(
      { flight, stay, platformFeePercentage, requestId, requestLogger, runId },
      bookings,
    );

    return this.getHotelAllocationStatus(flightId, user, requestLogger);
  }

  async getHotelAllocationStatus(
    flightId: number,
    user: AuthenticatedRequest["user"],
    requestLogger: Logger,
  ): Promise<HotelAllocationsDto> {
    const flight = await this.requireAirlineFlight(
      flightId,
      user,
      requestLogger,
    );
    const [bookings, rows, attempts, runState] = await Promise.all([
      this.cancelledFlightsRepository.findBookingsByFlightId(
        flightId,
        requestLogger,
      ),
      this.cancelledFlightsRepository.findAllocationsByFlightId(
        flightId,
        requestLogger,
      ),
      this.cancelledFlightsRepository.findAttemptsByFlightId(flightId),
      this.cancelledFlightsRepository.getFlightAllocationRunState(
        flightId,
        config.hotelBooking.allocationRunLeaseMs,
      ),
    ]);
    const platformFeePercentage = Number(
      flight.platformFeePercentage ??
        user.platformFeePercentage ??
        config.platformFeePercentage,
    );
    return this.buildAllocationSummary(
      flight,
      bookings,
      rows,
      attempts,
      runState,
      platformFeePercentage,
    );
  }

  private async executeAllocationRun(
    run: AllocationRunContext,
    bookings: BookingEntity[],
  ): Promise<void> {
    const { flight, runId, requestLogger } = run;
    const heartbeat = setInterval(
      () =>
        void this.cancelledFlightsRepository.touchFlightAllocationRun(
          flight.id,
          runId,
          requestLogger,
        ),
      Math.max(1000, Math.floor(config.hotelBooking.allocationRunLeaseMs / 5)),
    );
    heartbeat.unref();

    let runError: string | null = null;
    try {
      await this.cancelledFlightsRepository.recoverInterruptedAttempts(
        flight.id,
        runId,
        config.hotelBooking.staleBookingAttemptMs,
        requestLogger,
      );

      const ordered = [...bookings].sort(compareBookingPriority);
      await this.cancelledFlightsRepository.ensurePnrProcessingOrder(
        flight.id,
        ordered.map((booking, index) => ({
          bookingId: booking.id,
          processingOrder: index + 1,
          classPriority: classRank(booking.travelClass),
        })),
        {
          checkInDate: run.stay.checkInDate.toISOString(),
          checkOutDate: run.stay.checkOutDate.toISOString(),
          platformFeePercentage: run.platformFeePercentage,
        },
        requestLogger,
      );

      const rows = await this.cancelledFlightsRepository.findAllocationsByFlightId(
        flight.id,
        requestLogger,
      );
      const pendingIds = new Set(
        rows.filter((row) => isRebookableAllocation(row)).map((row) => row.bookingId),
      );
      const pending = bookings.filter((booking) => pendingIds.has(booking.id));

      requestLogger.info("Resolved bookings to process in this allocation run", {
        context: this.context,
        flightId: flight.id,
        runId,
        totalBookings: bookings.length,
        pending: pending.length,
      });

      if (pending.length > 0) {
        await this.planPendingBookings(run, pending, rows);
        await this.bookPlannedBookings(run, pending);
      }
    } catch (error: any) {
      runError = String(error?.message ?? error);
      requestLogger.error("Hotel allocation run failed", {
        context: this.context,
        flightId: flight.id,
        runId,
        error: runError,
        stack: error?.stack,
      });
    } finally {
      clearInterval(heartbeat);
      await this.cancelledFlightsRepository
        .completeFlightAllocationRun(
          flight.id,
          runId,
          run.platformFeePercentage,
          runError,
          requestLogger,
        )
        .catch((error: any) =>
          requestLogger.error("Could not complete the hotel allocation run", {
            context: this.context,
            flightId: flight.id,
            runId,
            error: error?.message,
          }),
        );
    }
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

  private async planPendingBookings(
    run: AllocationRunContext,
    pending: BookingEntity[],
    rows: HotelAllocationEntity[],
  ): Promise<void> {
    const { flight, stay, requestId, requestLogger } = run;
    const fresh = await this.cancelledFlightsRepository.findFreshPlanBookingIds(
      flight.id,
      config.hotelBooking.bookingPlanTtlMs,
    );
    const rowByBooking = new Map(rows.map((row) => [row.bookingId, row]));
    const needsPlan = pending.filter(
      (booking) =>
        !fresh.has(booking.id) ||
        rowByBooking.get(booking.id)?.status === HotelAllocationStatus.FAILED,
    );
    requestLogger.info("Resolved PNRs that need a new booking plan", {
      context: this.context,
      flightId: flight.id,
      pending: pending.length,
      reusingPlan: pending.length - needsPlan.length,
      needsPlan: needsPlan.length,
    });
    if (needsPlan.length === 0) {
      return;
    }

    const plans: Array<{ booking: BookingEntity; plan: RoomSplitPlan }> = [];
    for (const booking of needsPlan) {
      const split = this.resolveRoomSplitPlan(booking, requestLogger);
      if (!split.plan) {
        await this.cancelledFlightsRepository.markPnrFailed(
          booking.id,
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
      throw new Error(`Hotel availability search failed: ${error.message}`);
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

    await this.cancelledFlightsRepository.savePnrPlans(
      flight.id,
      randomUUID(),
      entries.map(({ booking, needs }) => ({
        bookingId: booking.id,
        roomPlan: needs.map((need) => ({
          adults: need.shape.adults,
          children: need.shape.children,
          roomsNeeded: need.roomsNeeded,
        })),
        candidates: buildCandidatePlan(hotels, needs, pools),
      })),
      requestLogger,
    );
  }

  private async bookPlannedBookings(
    run: AllocationRunContext,
    pending: BookingEntity[],
  ): Promise<void> {
    const { flight, requestLogger } = run;
    const [rows, attempts] = await Promise.all([
      this.cancelledFlightsRepository.findAllocationsByFlightId(
        flight.id,
        requestLogger,
      ),
      this.cancelledFlightsRepository.findAttemptsByFlightId(flight.id),
    ]);
    const rowByBooking = new Map(rows.map((row) => [row.bookingId, row]));
    const planIds = [
      ...new Set(rows.map((row) => row.planId).filter((id): id is string => !!id)),
    ];
    const candidates = await this.cancelledFlightsRepository.findCandidatesByPlans(
      flight.id,
      planIds,
    );

    const planning: BookingPlanningState = {
      ledger: this.buildPlanLedger(candidates, attempts),
      contentCache: new Map(),
    };

    const entries = pending
      .map((booking) => ({ booking, row: rowByBooking.get(booking.id) }))
      .filter(
        (entry): entry is { booking: BookingEntity; row: HotelAllocationEntity } =>
          !!entry.row?.planId &&
          entry.row.status !== HotelAllocationStatus.FAILED &&
          isRebookableAllocation(entry.row),
      )
      .map(({ booking, row }) => ({
        booking,
        row,
        candidates: candidates.filter(
          (c) => c.bookingId === booking.id && c.planId === row.planId,
        ),
        attempts: attempts.filter(
          (a) => a.bookingId === booking.id && a.planId === row.planId,
        ),
      }))
      .sort(
        (a, b) =>
          (a.row.processingOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.row.processingOrder ?? Number.MAX_SAFE_INTEGER),
      );

    const ranks = [
      ...new Set(
        entries.map((e) => e.row.classPriority ?? classRank(e.booking.travelClass)),
      ),
    ].sort((a, b) => b - a);
    const concurrency = Math.max(1, config.hotelBooking.concurrencyPerClass);
    for (const rank of ranks) {
      const stage = entries.filter(
        (e) => (e.row.classPriority ?? classRank(e.booking.travelClass)) === rank,
      );
      requestLogger.info("Booking hotels for cabin class stage", {
        context: this.context,
        flightId: flight.id,
        classRank: rank,
        bookings: stage.length,
      });
      await this.mapWithConcurrency(stage, concurrency, async (entry) => {
        await this.bookPlannedPnr(
          run,
          planning,
          entry.booking,
          entry.candidates,
          entry.attempts,
        );
        await this.cancelledFlightsRepository.touchFlightAllocationRun(
          flight.id,
          run.runId,
          requestLogger,
        );
      });
    }
  }

  private buildPlanLedger(
    candidates: HotelBookingCandidateEntity[],
    attempts: HotelBookingAttemptEntity[],
  ): AllotmentLedger {
    const snapshot = new Map<string, { allotment: number; planId: string }>();
    for (const candidate of [...candidates].sort((a, b) => a.id - b.id)) {
      for (const room of candidate.rooms) {
        for (const option of room.rateOptions) {
          snapshot.set(option.rateKey, {
            allotment: option.allotment,
            planId: candidate.planId,
          });
        }
      }
    }
    const remaining = new Map(
      [...snapshot].map(([rateKey, { allotment }]) => [rateKey, allotment]),
    );
    for (const attempt of attempts) {
      if (attempt.status === HotelBookingAttemptStatus.FAILED) {
        continue;
      }
      for (const rateKey of attempt.rateKeys) {
        if (snapshot.get(rateKey)?.planId === attempt.planId) {
          remaining.set(rateKey, (remaining.get(rateKey) ?? 0) - 1);
        }
      }
    }
    return new AllotmentLedger(remaining);
  }

  private async bookPlannedPnr(
    run: AllocationRunContext,
    planning: BookingPlanningState,
    booking: BookingEntity,
    candidates: HotelBookingCandidateEntity[],
    priorAttempts: HotelBookingAttemptEntity[],
  ): Promise<void> {
    const { requestLogger } = run;
    const definiteFailures = priorAttempts.filter(
      (a) =>
        a.status === HotelBookingAttemptStatus.FAILED &&
        a.failureCode !== HotelBookingFailureCode.INTERRUPTED_BEFORE_REQUEST,
    );
    const excludedRateKeys = new Set(definiteFailures.flatMap((a) => a.rateKeys));
    const maxAttempts = Math.max(1, config.hotelBooking.maxAttemptsPerBooking);
    let failures = definiteFailures.length;
    let lastFailure: string | null =
      definiteFailures[definiteFailures.length - 1]?.failureReason ?? null;

    try {
      for (;;) {
        if (failures >= maxAttempts) {
          await this.cancelledFlightsRepository.markPnrFailed(
            booking.id,
            `Gave up after ${failures} failed booking attempt(s); last failure: ${lastFailure}`,
          );
          return;
        }

        let selected: {
          candidate: HotelBookingCandidateEntity;
          picks: SelectedRate[];
          claim: LedgerClaim;
        } | null = null;
        for (const candidate of candidates) {
          const picks = selectCandidateRates(
            candidate,
            planning.ledger,
            excludedRateKeys,
          );
          const claim = picks
            ? planning.ledger.tryClaim(
                picks.map((pick) => ({
                  rateKey: pick.rateKey,
                  rooms: pick.roomsNeeded,
                })),
              )
            : null;
          if (picks && claim) {
            selected = { candidate, picks, claim };
            break;
          }
        }
        if (!selected) {
          await this.cancelledFlightsRepository.markPnrFailed(
            booking.id,
            lastFailure
              ? `No remaining hotel candidates could be booked; last failure: ${lastFailure}`
              : "No hotel near the airport has rooms left for this booking's room split",
          );
          return;
        }

        const { candidate, picks, claim } = selected;
        const outcome = await this.attemptHotelBooking({
          flight: run.flight,
          booking,
          stay: run.stay,
          rooms: picks.flatMap((pick) =>
            Array.from({ length: pick.roomsNeeded }, () => ({
              rateKey: pick.rateKey,
              shape: pick.shape,
            })),
          ),
          hotel: {
            hotelCode: candidate.hotelCode,
            hotelName: candidate.hotelName,
            category: candidate.category,
          },
          candidateId: candidate.id,
          planId: candidate.planId,
          runId: run.runId,
          platformFeePercentage: run.platformFeePercentage,
          requestId: run.requestId,
          requestLogger,
          contentCache: planning.contentCache,
        });

        if (outcome.kind === "confirmed" || outcome.kind === "unknown") {
          planning.ledger.commit(claim);
          return;
        }
        planning.ledger.release(claim);
        if (outcome.kind === "blocked") {
          return;
        }
        for (const pick of picks) {
          excludedRateKeys.add(pick.rateKey);
        }
        failures += 1;
        lastFailure = `${candidate.hotelName}: ${outcome.reason}`;
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

  private async attemptHotelBooking(input: {
    flight: CancelledFlightEntity;
    booking: BookingEntity;
    stay: { checkInDate: Date; checkOutDate: Date };
    rooms: Array<{ rateKey: string; shape?: RoomOccupancy }>;
    hotel?: { hotelCode: string; hotelName: string; category: string };
    candidateId?: number | null;
    planId?: string | null;
    runId?: string | null;
    paymentData?: unknown;
    platformFeePercentage: number;
    requestId: string;
    requestLogger: Logger;
    contentCache?: Map<string, Promise<HotelContentDetails | null>>;
  }): Promise<BookingAttemptOutcome> {
    const { flight, booking, rooms, requestId, requestLogger } = input;
    const rateKeys = rooms.map((room) => room.rateKey);

    let attemptId: number;
    try {
      const start = await this.cancelledFlightsRepository.startBookingAttempt(
        {
          cancelledFlightId: flight.id,
          bookingId: booking.id,
          candidateId: input.candidateId ?? null,
          planId: input.planId ?? null,
          runId: input.runId ?? null,
          rateKeys,
          provider: config.hotelProvider.name,
          providerRequestId: randomUUID(),
          hotelCode: input.hotel?.hotelCode ?? null,
          hotelName: input.hotel?.hotelName ?? null,
          category: input.hotel?.category ?? null,
          checkInDate: input.stay.checkInDate.toISOString(),
          checkOutDate: input.stay.checkOutDate.toISOString(),
        },
        requestLogger,
      );
      if (!start.started) {
        return { kind: "blocked", reason: start.reason };
      }
      attemptId = start.attempt.id;
    } catch (error: any) {
      return {
        kind: "blocked",
        reason: `Could not record the booking attempt: ${error?.message ?? error}`,
      };
    }

    const fail = async (
      code: HotelBookingFailureCode,
      reason: string,
      error?: unknown,
      responseReceived = false,
    ): Promise<BookingAttemptOutcome> => {
      await this.settleAttempt(
        attemptId,
        booking.id,
        {
          status: HotelBookingAttemptStatus.FAILED,
          failureCode: code,
          failureReason: reason,
          responseReceived,
        },
        undefined,
        requestLogger,
      );
      return { kind: "rejected", reason, error };
    };

    const checks: HotelRateCheck[] = [];
    for (const room of rooms) {
      let check: HotelRateCheck;
      try {
        check = await this.hotelProvider.checkRate(room.rateKey, requestId);
      } catch (error: any) {
        return fail(
          HotelBookingFailureCode.RATE_CHECK_FAILED,
          `Rate check failed: ${error?.message ?? error}`,
          error,
        );
      }
      if (
        room.shape &&
        (check.adults < room.shape.adults || check.children < room.shape.children)
      ) {
        return fail(
          HotelBookingFailureCode.RATE_MISMATCH,
          `Rate re-check returned a room for ${check.adults} adult(s) + ${check.children} child(ren); the party needs ${room.shape.adults} + ${room.shape.children}`,
        );
      }
      checks.push(check);
    }
    if (new Set(checks.map((check) => check.hotelCode)).size > 1) {
      return fail(
        HotelBookingFailureCode.MIXED_HOTELS,
        "All rooms of one booking must be in the same hotel",
        new BadRequestException(
          "All rooms of one booking must be in the same hotel",
        ),
      );
    }
    const hotelCode = checks[0].hotelCode;
    const hotelName = checks[0].hotelName || input.hotel?.hotelName || hotelCode;

    const sent = await this.cancelledFlightsRepository.markAttemptRequestSent(
      attemptId,
      booking.id,
      { hotelCode, hotelName, category: checks[0].category },
    );
    if (!sent) {
      return {
        kind: "blocked",
        reason: "Booking attempt was settled elsewhere before the supplier request",
      };
    }

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
          attemptId,
          hotelCode,
          room: index + 1,
          rooms: rateKeys.length,
        });
        const result = await this.hotelProvider.bookHotel(
          {
            firstName: booking.firstName,
            lastName: booking.lastName,
            bookingId: booking.id,
            pnr: booking.pnr,
            contactEmail: flight.airline?.contactEmail,
            contactPhone: booking.phone?.trim() || flight.airline?.contactPhone,
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
        return fail(
          HotelBookingFailureCode.SUPPLIER_REJECTED,
          `Booking at ${hotelName} failed: ${message}`,
          error,
          true,
        );
      }

      const unknownReference = outcomeUnknown
        ? (error as HotelBookingOutcomeUnknownError).supplierReference ?? null
        : null;
      const reason =
        `Needs manual check with the supplier: ${booked.length} of ${rateKeys.length} room(s) booked at ${hotelName}` +
        (references.length ? ` (refs: ${references.join(", ")})` : "") +
        (outcomeUnknown
          ? `; room ${booked.length + 1} outcome unknown${unknownReference ? ` (supplier ref ${unknownReference})` : ""}: ${message}`
          : `; room ${booked.length + 1} failed: ${message}`) +
        ". Do not rebook until reconciled.";
      requestLogger.error("Hotel booking outcome needs manual check", {
        context: this.context,
        flightId: flight.id,
        bookingId: booking.id,
        pnr: booking.pnr,
        attemptId,
        reason,
      });
      await this.settleAttempt(
        attemptId,
        booking.id,
        {
          status: HotelBookingAttemptStatus.MANUAL_CHECK,
          failureCode: outcomeUnknown
            ? HotelBookingFailureCode.OUTCOME_UNKNOWN
            : HotelBookingFailureCode.PARTIAL_BOOKING,
          failureReason: reason,
          providerBookingReference: references.length ? references.join(",") : null,
          providerIdempotencyKey: unknownReference,
          responseReceived: !outcomeUnknown,
        },
        undefined,
        requestLogger,
      );
      return { kind: "unknown", reason };
    }

    const references = booked.map((room) => room.result.bookingReference);
    if (
      !booked.every((room) => room.result.status === HotelAllocationStatus.CONFIRMED)
    ) {
      const reason = `Supplier accepted the booking at ${hotelName} without confirming it (refs: ${references.join(", ")}). Check with the supplier.`;
      await this.settleAttempt(
        attemptId,
        booking.id,
        {
          status: HotelBookingAttemptStatus.MANUAL_CHECK,
          failureCode: HotelBookingFailureCode.PROVIDER_UNCONFIRMED,
          failureReason: reason,
          providerBookingReference: references.join(","),
          responseReceived: true,
        },
        undefined,
        requestLogger,
      );
      return { kind: "unknown", reason };
    }

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

    try {
      const settled = await this.cancelledFlightsRepository.finishBookingAttempt(
        attemptId,
        booking.id,
        {
          status: HotelBookingAttemptStatus.SUCCESS,
          providerStatus: null,
          providerBookingReference: references.join(","),
          responseReceived: true,
        },
        {
          ...row,
          bookingReference: references.join(","),
          reason: this.confirmedReason(booking, row.hotelName ?? hotelName, row.category ?? ""),
        },
        requestLogger,
      );
      if (!settled.updated || !settled.allocation) {
        throw new Error("booking attempt was no longer open");
      }
      requestLogger.info("Hotel booked and confirmed for PNR", {
        context: this.context,
        flightId: flight.id,
        bookingId: booking.id,
        pnr: booking.pnr,
        attemptId,
        hotelCode,
        bookingReference: references.join(","),
      });
      await this.cancelledFlightsRepository
        .refreshFlightTotals(flight.id, requestLogger)
        .catch((error: any) =>
          requestLogger.error("Could not refresh flight totals after a confirmed booking", {
            context: this.context,
            flightId: flight.id,
            bookingId: booking.id,
            error: error?.message,
          }),
        );
      return {
        kind: "confirmed",
        allocation: settled.allocation,
        references,
        currency: checks[0].currency,
      };
    } catch (error: any) {
      const reason = `Hotel booked with the supplier (${references.join(", ")}) but saving it failed: ${error?.message}. Record it manually; do not rebook.`;
      requestLogger.error("Hotel booked but saving the allocation failed", {
        context: this.context,
        bookingId: booking.id,
        attemptId,
        references,
        error: error?.message,
      });
      await this.settleAttempt(
        attemptId,
        booking.id,
        {
          status: HotelBookingAttemptStatus.MANUAL_CHECK,
          failureCode: HotelBookingFailureCode.SAVE_FAILED,
          failureReason: reason,
          providerBookingReference: references.join(","),
          responseReceived: true,
        },
        undefined,
        requestLogger,
      );
      return { kind: "unknown", reason };
    }
  }

  private async settleAttempt(
    attemptId: number,
    bookingId: number,
    changes: Parameters<CancelledFlightsRepository["finishBookingAttempt"]>[2],
    success: Partial<HotelAllocationEntity> | undefined,
    requestLogger: Logger,
  ): Promise<void> {
    await this.cancelledFlightsRepository
      .finishBookingAttempt(attemptId, bookingId, changes, success, requestLogger)
      .catch((error: any) =>
        requestLogger.error("Could not record the hotel booking attempt outcome", {
          context: this.context,
          attemptId,
          bookingId,
          status: changes.status,
          error: error?.message,
        }),
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

  private toBookingStatus(
    row: HotelAllocationEntity | undefined,
    attemptCount: number,
    running: boolean,
  ): PnrBookingStatus {
    if (!row || isRebookableAllocation(row)) {
      if (row?.status === HotelAllocationStatus.FAILED) {
        return "FAILED";
      }
      return running && attemptCount > 0 ? "PENDING" : "NOT_STARTED";
    }
    switch (row.status) {
      case HotelAllocationStatus.CONFIRMED:
      case HotelAllocationStatus.COMPLETED:
        return "SUCCESS";
      case HotelAllocationStatus.MANUAL_CHECK:
        return "MANUAL_CHECK";
      case HotelAllocationStatus.IN_PROGRESS:
        return "PENDING";
      default:
        return "NOT_STARTED";
    }
  }

  private buildAllocationSummary(
    flight: CancelledFlightEntity,
    bookings: BookingEntity[],
    rows: HotelAllocationEntity[],
    attempts: HotelBookingAttemptEntity[],
    runState: { running: boolean; stale: boolean; error: string | null },
    platformFeePercentage: number,
  ): HotelAllocationsDto {
    const rowByBooking = new Map(rows.map((row) => [row.bookingId, row]));
    const attemptsByBooking = new Map<number, number>();
    for (const attempt of attempts) {
      attemptsByBooking.set(
        attempt.bookingId,
        (attemptsByBooking.get(attempt.bookingId) ?? 0) + 1,
      );
    }
    const results: HotelAllocationBookingResultDto[] = [...bookings]
      .sort(
        (a, b) =>
          (rowByBooking.get(a.id)?.processingOrder ?? Number.MAX_SAFE_INTEGER) -
            (rowByBooking.get(b.id)?.processingOrder ?? Number.MAX_SAFE_INTEGER) ||
          compareBookingPriority(a, b),
      )
      .map((booking) => {
        const row = rowByBooking.get(booking.id);
        const attemptCount = attemptsByBooking.get(booking.id) ?? 0;
        const bookingStatus = this.toBookingStatus(row, attemptCount, runState.running);
        const success = bookingStatus === "SUCCESS";
        const showHotel =
          !!row?.hotelCode &&
          (success || bookingStatus === "PENDING" || bookingStatus === "MANUAL_CHECK");
        return {
          bookingId: booking.id,
          pnr: booking.pnr,
          travelClass: booking.travelClass,
          processingOrder: row?.processingOrder ?? null,
          bookingStatus,
          hotel: showHotel
            ? {
                hotelCode: row!.hotelCode,
                hotelName: row!.hotelName,
                category: row!.category,
                address: success ? row!.address ?? null : null,
                checkInDate: success ? row!.checkInDate : null,
                checkOutDate: success ? row!.checkOutDate : null,
                totalRooms: success ? row!.totalRooms ?? 0 : 0,
                totalPrice: success ? Number(row!.totalPrice ?? 0) : 0,
                rooms: success
                  ? (row!.rooms ?? []).map(({ rateKey, ...room }) => room)
                  : [],
              }
            : null,
          providerBookingReference: success ? row!.bookingReference || null : null,
          attempts: attemptCount,
          reason: row?.reason ?? null,
        };
      });
    const count = (status: PnrBookingStatus) =>
      results.filter((result) => result.bookingStatus === status).length;
    const successfulPnrs = count("SUCCESS");

    return {
      cancelledFlightId: flight.id,
      status: flight.status,
      running: runState.running,
      lastRunError: runState.stale
        ? "The last allocation run stopped unexpectedly; run allocation again"
        : runState.error,
      totalPnrs: bookings.length,
      successfulPnrs,
      pendingPnrs: count("PENDING"),
      failedPnrs: count("FAILED"),
      manualCheckPnrs: count("MANUAL_CHECK"),
      notStartedPnrs: count("NOT_STARTED"),
      fullyBooked: bookings.length > 0 && successfulPnrs === bookings.length,
      results,
      totalRooms: Number(flight.totalHotelRooms ?? 0),
      totalActualPrice: Number(flight.totalActualPrice ?? 0),
      totalSellingPrice: Number(flight.totalSellingPrice ?? 0),
      totalDiscounts: Number(flight.totalDiscounts ?? 0),
      totalHotelTaxes: Number(flight.totalHotelTaxes ?? 0),
      platformFeePercentage,
      totalPlatformFee: Number(flight.totalPlatformFee ?? 0),
      totalPrice: Number(flight.totalPrice ?? 0),
      currency: flight.airline?.currency ?? "EUR",
    };
  }

  private static readonly HOTEL_BOOKABLE_FLIGHT_STATUSES =
    new Set<FlightStatus>([
      FlightStatus.ALLOCATED,
      FlightStatus.PAID,
      FlightStatus.PUBLISHED,
    ]);

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
    if (!isRebookableAllocation(current)) {
      throw new ConflictException(
        `Booking '${booking.id}' hotel booking is ${current!.status} (${current!.reason ?? current!.bookingReference ?? "no details"})`,
      );
    }
    const rateKeys = this.resolveRateKeys(dto, booking.id, current);
    const shapes = (current?.roomPlan ?? []).flatMap((room) =>
      Array.from({ length: room.roomsNeeded }, () => ({
        adults: room.adults,
        children: room.children,
      })),
    );

    const outcome = await this.attemptHotelBooking({
      flight,
      booking,
      stay: this.resolveStayDates(flight, requestLogger),
      rooms: rateKeys.map((rateKey, index) => ({
        rateKey,
        shape: shapes.length === rateKeys.length ? shapes[index] : undefined,
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
        `No rate keys to book for booking '${bookingId}': send rateKeys, or run hotel allocation again`,
      );
    }
    return stored as string[];
  }

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
