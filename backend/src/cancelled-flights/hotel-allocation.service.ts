import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Logger } from "winston";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";
import { BookingEntity } from "./entities/booking.entity";
import { FlightStatus, HotelAllocationStatus, TravelClass } from "./entities/enums";
import {
  AvailabilityHotel,
  AvailabilityRoomRate,
  HOTEL_PROVIDER,
  HotelContentDetails,
  HotelProvider,
  RoomOccupancy,
} from "./hotel-providers/hotel-provider.interface";
import { AiService } from "../common/ai/ai.service";
import { AuthenticatedRequest } from "../auth/interfaces/authenticated-request.interface";
import { config } from "../config/config";
import { HotelAllocationsDto } from "./dto/hotel-allocations.dto";

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

  // Cheapest exact-fit rate; if none, the smallest room with enough
  // capacity (e.g. a double for a lone adult) as a last resort.
  private pickRateForShape(
    hotel: AvailabilityHotel,
    shape: RoomOccupancy,
    roomsNeeded: number,
    allotmentLedger: Map<string, number>,
  ): AvailabilityRoomRate | undefined {
    const hasCapacity = (rate: AvailabilityRoomRate) =>
      (allotmentLedger.get(rate.rateKey) ?? rate.allotment ?? 0) >= roomsNeeded;

    const exact = hotel.rates
      .filter(
        (rate) =>
          rate.adults === shape.adults &&
          rate.children === shape.children &&
          hasCapacity(rate),
      )
      .sort((a, b) => a.netPrice - b.netPrice)[0];
    if (exact) {
      return exact;
    }

    return hotel.rates
      .filter(
        (rate) =>
          rate.adults >= shape.adults &&
          rate.children >= shape.children &&
          hasCapacity(rate),
      )
      .sort((a, b) => {
        const oversizeA = a.adults + a.children - (shape.adults + shape.children);
        const oversizeB = b.adults + b.children - (shape.adults + shape.children);
        return oversizeA - oversizeB || a.netPrice - b.netPrice;
      })[0];
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

    requestLogger.info(`Querying Hotelbeds API for nearby hotels...`, {
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
      `Received ${candidateHotels.length} candidate hotels from Hotelbeds`,
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
    requestLogger.info("Starting flight-level hotel allocation process", {
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
        `Flight '${flightId}' is not eligible for hotel allocation in status '${flight.status}'`,
        {
          context: this.context,
          flightId,
          status: flight.status,
        },
      );
      throw new BadRequestException(
        `Flight '${flightId}' is not eligible for hotel allocation in status '${flight.status}'`,
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
      `Loaded bookings for hotel allocation for flight '${flightId}'`,
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
      throw new BadRequestException(
        `No eligible bookings with valid room split plans found for flight '${flightId}'`,
      );
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

      // surface the real error rather than masking it
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
    requestLogger.debug("Hotels found for flight", {
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
    });

    // AI places every occupancy group; the code below re-verifies each hard rule.
    const rateByKey = new Map<
      string,
      { hotel: AvailabilityHotel; rate: AvailabilityRoomRate }
    >();
    for (const hotel of hotels) {
      for (const rate of hotel.rates) {
        rateByKey.set(rate.rateKey, { hotel, rate });
      }
    }

    const pgMeta = new Map<
      string,
      { booking: BookingEntity; shape: RoomOccupancy; roomsNeeded: number }
    >();
    // Only what the allocator needs; names/board/price come from the real rates.
    type HotelOption = {
      hotelId: string;
      category: string;
      stars: number;
      rateKey: string;
      adults: number;
      children: number;
      allotment: number | null;
    };
    const occupancyGroups: Array<{
      passengerGroupId: string;
      sameHotelGroup: string;
      travelClass: string;
      specialNotes: string[];
      adults: number;
      children: number;
      roomsNeeded: number;
      shapeKey: string;
    }> = [];

    // Per-shape catalog (built once, not per group): cheapest rate per hotel,
    // capped, rateKeys aliased - keeps the AI request under the token limit.
    const MAX_HOTELS_PER_SHAPE = 8;
    const rateKeyByAlias = new Map<string, string>();
    const aliasByRateKey = new Map<string, string>();
    const aliasForRateKey = (rateKey: string): string => {
      let alias = aliasByRateKey.get(rateKey);
      if (!alias) {
        alias = `r${aliasByRateKey.size}`;
        aliasByRateKey.set(rateKey, alias);
        rateKeyByAlias.set(alias, rateKey);
      }
      return alias;
    };
    const roomOptionsByShape = new Map<string, HotelOption[]>();
    const buildRoomOptions = (shapeKey: string): HotelOption[] => {
      const cheapestPerHotel = new Map<
        string,
        { hotel: AvailabilityHotel; rate: AvailabilityRoomRate }
      >();
      for (const hotel of hotels) {
        for (const rate of hotel.rates) {
          if (
            rate.allotment === null ||
            rate.allotment <= 0 ||
            this.roomShapeKey(rate) !== shapeKey
          ) {
            continue;
          }
          const current = cheapestPerHotel.get(hotel.hotelCode);
          if (!current || rate.netPrice < current.rate.netPrice) {
            cheapestPerHotel.set(hotel.hotelCode, { hotel, rate });
          }
        }
      }
      return Array.from(cheapestPerHotel.values())
        .sort(
          (a, b) =>
            b.hotel.stars - a.hotel.stars || a.rate.netPrice - b.rate.netPrice,
        )
        .slice(0, MAX_HOTELS_PER_SHAPE)
        .map(({ hotel, rate }) => ({
          hotelId: `hb-${hotel.hotelCode}`,
          category: hotel.category,
          stars: hotel.stars,
          rateKey: aliasForRateKey(rate.rateKey),
          adults: rate.adults,
          children: rate.children,
          allotment: rate.allotment,
        }));
    };

    const optionsForShape = (room: RoomOccupancy): HotelOption[] => {
      const shapeKey = this.roomShapeKey(room);
      if (!roomOptionsByShape.has(shapeKey)) {
        roomOptionsByShape.set(shapeKey, buildRoomOptions(shapeKey));
      }
      return roomOptionsByShape.get(shapeKey)!;
    };

    // Cheapest rate for a shape, uncapped - only for comparing split prices,
    // not for the AI shortlist (which caps to MAX_HOTELS_PER_SHAPE above).
    const cheapestPriceByShape = new Map<string, number>();
    const cheapestPriceForShape = (shape: RoomOccupancy): number => {
      const shapeKey = this.roomShapeKey(shape);
      const cached = cheapestPriceByShape.get(shapeKey);
      if (cached !== undefined) {
        return cached;
      }
      let cheapest = Number.POSITIVE_INFINITY;
      for (const hotel of hotels) {
        for (const rate of hotel.rates) {
          if (
            rate.allotment === null ||
            rate.allotment <= 0 ||
            rate.adults !== shape.adults ||
            rate.children !== shape.children
          ) {
            continue;
          }
          if (rate.netPrice < cheapest) {
            cheapest = rate.netPrice;
          }
        }
      }
      cheapestPriceByShape.set(shapeKey, cheapest);
      return cheapest;
    };

    for (const booking of eligibleBookings) {
      const splitPlan = splitPlansByBooking.get(booking.id)!;

      // Rank splits (preferred + fallbacks): every shape available, then one
      // hotel covers all, then the cheapest total estimated price, then
      // fewest distinct shapes/rooms as a final tiebreaker.
      const chosenSplit =
        [splitPlan.preferred, ...splitPlan.fallbacks]
          .map((rooms) => {
            const byShape = new Map<string, RoomOccupancy>();
            for (const room of rooms) {
              byShape.set(this.roomShapeKey(room), room);
            }
            const perShapeHotels = [...byShape.values()].map(
              (room) => new Set(optionsForShape(room).map((o) => o.hotelId)),
            );
            const coverable = perShapeHotels.every((s) => s.size > 0);
            const sharedHotels = coverable
              ? perShapeHotels.reduce(
                  (a, b) => new Set([...a].filter((h) => b.has(h))),
                )
              : new Set<string>();
            const estimatedPrice = coverable
              ? rooms.reduce(
                  (sum, room) => sum + cheapestPriceForShape(room),
                  0,
                )
              : Number.POSITIVE_INFINITY;
            return {
              rooms,
              coverable,
              oneHotel: sharedHotels.size > 0,
              estimatedPrice,
              distinctShapes: byShape.size,
              roomCount: rooms.length,
            };
          })
          .filter((c) => c.coverable)
          .sort(
            (a, b) =>
              Number(b.oneHotel) - Number(a.oneHotel) ||
              a.estimatedPrice - b.estimatedPrice ||
              a.distinctShapes - b.distinctShapes ||
              a.roomCount - b.roomCount,
          )[0]?.rooms ?? splitPlan.preferred;

      const shapeCounts = new Map<
        string,
        { shape: RoomOccupancy; count: number }
      >();
      for (const room of chosenSplit) {
        const shapeKey = this.roomShapeKey(room);
        const current = shapeCounts.get(shapeKey);
        if (current) {
          current.count += 1;
        } else {
          shapeCounts.set(shapeKey, { shape: room, count: 1 });
        }
      }

      for (const [shapeKey, { shape, count }] of shapeCounts) {
        // booking.id, not pnr - pnr has no unique constraint and a
        // collision would merge two bookings; pnr stays in the string only
        // for readable logs.
        const passengerGroupId = `${booking.id}:${booking.pnr}#${shape.adults}a${shape.children}c`;
        const sameHotelGroup = `${booking.id}:${booking.pnr}`;
        optionsForShape(shape);

        occupancyGroups.push({
          passengerGroupId,
          sameHotelGroup,
          travelClass: booking.travelClass,
          specialNotes: booking.specialNotes ?? [],
          adults: shape.adults,
          children: shape.children,
          roomsNeeded: count,
          shapeKey,
        });
        pgMeta.set(passengerGroupId, { booking, shape, roomsNeeded: count });
      }
    }

    // Pre-flight supply check: fail fast if a shape has no chance of being
    // covered (exact or oversized rooms), before spending an AI call.
    // Conservative estimate, not exact bin-packing - the ledger-accurate
    // verifier/rescue below still do the real per-booking accounting.
    const demandByShape = new Map<
      string,
      { shape: RoomOccupancy; rooms: number }
    >();
    for (const group of occupancyGroups) {
      const current = demandByShape.get(group.shapeKey);
      if (current) {
        current.rooms += group.roomsNeeded;
      } else {
        demandByShape.set(group.shapeKey, {
          shape: { adults: group.adults, children: group.children },
          rooms: group.roomsNeeded,
        });
      }
    }

    // A room can count toward more than one shape's estimate here -
    // deliberate: over-estimating supply can waste an AI call but never
    // wrongly aborts a viable flight. A "claim once" version was tried and
    // reverted: order-dependent, so it could give the only 3-adult room to
    // a 1-adult shape and falsely report the 3-adult shape as short.
    const totalAllotmentWhere = (
      predicate: (rate: AvailabilityRoomRate) => boolean,
    ): number =>
      hotels.reduce(
        (sum, hotel) =>
          sum +
          hotel.rates
            .filter(
              (rate) =>
                rate.allotment !== null && rate.allotment > 0 && predicate(rate),
            )
            .reduce((roomSum, rate) => roomSum + (rate.allotment ?? 0), 0),
        0,
      );

    const shortages: Array<{
      shapeKey: string;
      shape: RoomOccupancy;
      roomsNeeded: number;
      roomsAvailable: number;
    }> = [];
    for (const [shapeKey, { shape, rooms }] of demandByShape) {
      const exactSupply = totalAllotmentWhere(
        (rate) => rate.adults === shape.adults && rate.children === shape.children,
      );
      if (exactSupply >= rooms) {
        continue;
      }
      const coveringSupply = totalAllotmentWhere(
        (rate) => rate.adults >= shape.adults && rate.children >= shape.children,
      );
      if (coveringSupply < rooms) {
        shortages.push({ shapeKey, shape, roomsNeeded: rooms, roomsAvailable: coveringSupply });
      }
    }

    if (shortages.length > 0) {
      const affectedPnrs = Array.from(
        new Set(
          occupancyGroups
            .filter((group) =>
              shortages.some((shortage) => shortage.shapeKey === group.shapeKey),
            )
            .map((group) => pgMeta.get(group.passengerGroupId)?.booking.pnr)
            .filter((pnr): pnr is string => Boolean(pnr)),
        ),
      );
      const shortageDetails = shortages.map((shortage) => ({
        occupancy: `${shortage.shape.adults} adult(s), ${shortage.shape.children} child(ren)`,
        roomsNeeded: shortage.roomsNeeded,
        roomsAvailable: shortage.roomsAvailable,
      }));
      requestLogger.warn(
        `Insufficient hotel room supply for flight '${flightId}' - aborting before the AI allocation call`,
        {
          context: this.context,
          flightId,
          shortages: shortageDetails,
          affectedPnrs,
        },
      );
      throw new BadRequestException({
        message:
          `Hotel allocation aborted: not enough hotel rooms near the airport to cover ` +
          `${shortages.length} occupancy shape(s) for ${affectedPnrs.length} booking(s). ` +
          `No AI call was made. Widen the search radius or add hotel supply and retry.`,
        shortages: shortageDetails,
        affectedPnrs,
      });
    }

    // Drop shapes with no candidates: an empty list makes the model bail on
    // every group. Those groups stay in pgMeta and fail the verifier/rescue.
    const roomOptions = Object.fromEntries(
      [...roomOptionsByShape].filter(([, options]) => options.length > 0),
    );
    const placeableGroups = occupancyGroups.filter(
      (group) => (roomOptions[group.shapeKey]?.length ?? 0) > 0,
    );

    // Batch the AI call to stay under the token limit: pack bookings into
    // batches by token budget, never splitting one booking's rooms across
    // batches (they all need the same hotel). One call for a small flight,
    // several in parallel for a large one.
    const estimateJsonTokens = (value: unknown): number =>
      Math.ceil(JSON.stringify(value).length / 4);

    const groupsByBooking = new Map<string, typeof placeableGroups>();
    for (const group of placeableGroups) {
      const list = groupsByBooking.get(group.sameHotelGroup);
      if (list) {
        list.push(group);
      } else {
        groupsByBooking.set(group.sameHotelGroup, [group]);
      }
    }

    type AiBatch = {
      groups: typeof placeableGroups;
      shapeKeys: Set<string>;
      tokens: number;
    };
    // The estimate below covers only roomOptions+groups; system prompt +
    // response schema add ~450 fixed tokens per call, so reserve for them.
    const promptOverheadTokens = 500;
    const maxInputTokens = Math.max(
      500,
      config.ai.maxInputTokensPerCall - promptOverheadTokens,
    );
    const batches: AiBatch[] = [];
    let currentBatch: AiBatch = { groups: [], shapeKeys: new Set(), tokens: 0 };

    const tokensToAdd = (
      batch: AiBatch,
      bookingGroups: typeof placeableGroups,
      shapeKeys: string[],
    ): number => {
      const newShapeKeys = shapeKeys.filter((key) => !batch.shapeKeys.has(key));
      return (
        estimateJsonTokens(bookingGroups) +
        newShapeKeys.reduce((sum, key) => sum + estimateJsonTokens(roomOptions[key]), 0)
      );
    };

    for (const bookingGroups of groupsByBooking.values()) {
      const shapeKeys = Array.from(new Set(bookingGroups.map((g) => g.shapeKey)));
      let addedTokens = tokensToAdd(currentBatch, bookingGroups, shapeKeys);

      // Can't split one booking across batches (same-hotel rule), so log
      // when it alone exceeds budget - it still goes out as one oversized call.
      if (addedTokens > maxInputTokens) {
        requestLogger.warn(
          `Booking ${bookingGroups[0]?.sameHotelGroup} alone exceeds the AI token budget (${addedTokens} > ${maxInputTokens}) - sending as a single oversized batch`,
          { context: this.context, flightId },
        );
      }

      if (
        currentBatch.groups.length > 0 &&
        currentBatch.tokens + addedTokens > maxInputTokens
      ) {
        batches.push(currentBatch);
        currentBatch = { groups: [], shapeKeys: new Set(), tokens: 0 };
        // Recompute: the discount above was against the batch we just closed.
        addedTokens = tokensToAdd(currentBatch, bookingGroups, shapeKeys);
      }

      currentBatch.groups.push(...bookingGroups);
      for (const key of shapeKeys) {
        currentBatch.shapeKeys.add(key);
      }
      currentBatch.tokens += addedTokens;
    }
    if (currentBatch.groups.length > 0) {
      batches.push(currentBatch);
    }

    requestLogger.info("Split AI hotel allocation into batches", {
      context: this.context,
      flightId,
      batchCount: batches.length,
      totalGroups: placeableGroups.length,
      dataTokenBudget: maxInputTokens,
      configuredMaxInputTokens: config.ai.maxInputTokensPerCall,
    });

    const AI_BATCH_CONCURRENCY = 3;
    const batchResults = await this.mapWithConcurrency(
      batches,
      AI_BATCH_CONCURRENCY,
      async (batch) => {
        const batchRoomOptions = Object.fromEntries(
          Array.from(batch.shapeKeys).map((key) => [key, roomOptions[key]]),
        );
        try {
          return await this.aiService.allocateHotelGroups(
            { roomOptions: batchRoomOptions, groups: batch.groups },
            requestId,
          );
        } catch (error: any) {
          // A failed batch doesn't abort the flight - its groups fall
          // through to the deterministic rescue pass below instead.
          requestLogger.error(
            `AI hotel allocation batch failed, falling back to deterministic rescue for its bookings: ${error.message}`,
            { context: this.context, flightId },
          );
          return {
            assignments: [],
            unresolved: batch.groups.map((group) => ({
              passengerGroupId: group.passengerGroupId,
              reason: `AI allocation call failed: ${error.message}`,
            })),
          };
        }
      },
    );

    const aiAllocation = {
      assignments: batchResults.flatMap((result) => result.assignments),
      unresolved: batchResults.flatMap((result) => result.unresolved),
    };

    requestLogger.debug("AI hotel allocation response received", {
      context: this.context,
      flightId,
      assignmentCount: aiAllocation.assignments.length,
      unresolvedCount: aiAllocation.unresolved.length,
      assignments: aiAllocation.assignments,
    });
    if (aiAllocation.unresolved.length > 0) {
      requestLogger.warn("AI allocator left some passenger groups unresolved", {
        context: this.context,
        flightId,
        unresolved: aiAllocation.unresolved,
      });
    }

    // passengerGroupId -> real rateKey (translated from the alias sent to the AI)
    const rateKeyByPg = new Map<string, string>();
    for (const assignment of aiAllocation.assignments) {
      if (
        assignment &&
        typeof assignment.passengerGroupId === "string" &&
        typeof assignment.rateKey === "string"
      ) {
        rateKeyByPg.set(
          assignment.passengerGroupId,
          rateKeyByAlias.get(assignment.rateKey) ?? assignment.rateKey,
        );
      }
    }

    const unresolvedByPg = new Map<string, string>();
    for (const item of aiAllocation.unresolved) {
      if (item && typeof item.passengerGroupId === "string") {
        unresolvedByPg.set(
          item.passengerGroupId,
          String(item.reason ?? "Marked unresolved by allocator"),
        );
      }
    }

    // Hard-rule verifier: capacity, single hotel per booking, and a running
    // allotment ledger across the whole batch (never trust the model's count).
    const allotmentLedger = new Map<string, number>();
    for (const { rate } of rateByKey.values()) {
      if (rate.allotment !== null) {
        allotmentLedger.set(rate.rateKey, rate.allotment);
      }
    }

    // Concurrent batches can both claim the same scarce rateKey; process
    // higher classes first so they win contested inventory over economy,
    // not whichever booking happens to sit earlier in the list. `results`
    // (and the rescue loop below, which walks it in order) inherits this.
    const classRank: Record<string, number> = {
      first_class: 3,
      business: 2,
      premium_economy: 1,
      economy: 0,
    };
    const bookingsByPriority = [...eligibleBookings].sort(
      (a, b) => (classRank[b.travelClass] ?? 0) - (classRank[a.travelClass] ?? 0),
    );

    for (const booking of bookingsByPriority) {
      const passengerGroupIds = Array.from(pgMeta.entries())
        .filter(([, meta]) => meta.booking.id === booking.id)
        .map(([id]) => id);

      const bookingRooms: Array<{
        adults: number;
        children: number;
        rateKey: string;
        roomName: string;
        boardName: string;
        price: number;
        currency: string;
      }> = [];
      let hotelRef: {
        hotelCode: string;
        hotelName: string;
        category: string;
        stars: number;
      } | null = null;
      let failReason: string | null = null;
      // Trial only, committed below on success - otherwise a later group
      // failing would leave an earlier group's decrement stuck for good.
      const trialDecrements = new Map<string, number>();

      for (const passengerGroupId of passengerGroupIds) {
        const meta = pgMeta.get(passengerGroupId)!;

        if (unresolvedByPg.has(passengerGroupId)) {
          failReason = unresolvedByPg.get(passengerGroupId)!;
          break;
        }

        const rateKey = rateKeyByPg.get(passengerGroupId);
        if (!rateKey) {
          failReason = "Allocator returned no assignment for this group";
          break;
        }

        const entry = rateByKey.get(rateKey);
        if (!entry) {
          failReason = `Assigned rateKey '${rateKey}' is not in the shortlist`;
          break;
        }

        if (entry.rate.allotment === null) {
          failReason = `Assigned rateKey '${rateKey}' has no allotment and is unavailable`;
          break;
        }

        if (
          entry.rate.adults !== meta.shape.adults ||
          entry.rate.children !== meta.shape.children
        ) {
          failReason =
            "Assigned room capacity does not match the group's occupancy";
          break;
        }

        if (hotelRef && hotelRef.hotelCode !== entry.hotel.hotelCode) {
          failReason = "Allocator split one booking across multiple hotels";
          break;
        }
        hotelRef = {
          hotelCode: entry.hotel.hotelCode,
          hotelName: entry.hotel.hotelName,
          category: entry.hotel.category,
          stars: entry.hotel.stars,
        };

        if (allotmentLedger.has(rateKey)) {
          const alreadyTrialed = trialDecrements.get(rateKey) ?? 0;
          const remaining = allotmentLedger.get(rateKey)! - alreadyTrialed;
          if (remaining < meta.roomsNeeded) {
            failReason = `Allotment exceeded for rateKey '${rateKey}'`;
            break;
          }
          trialDecrements.set(rateKey, alreadyTrialed + meta.roomsNeeded);
        }

        for (let index = 0; index < meta.roomsNeeded; index += 1) {
          bookingRooms.push({
            adults: meta.shape.adults,
            children: meta.shape.children,
            rateKey: entry.rate.rateKey,
            roomName: entry.rate.roomName,
            boardName: entry.rate.boardName,
            price: this.roundCurrency(entry.rate.netPrice),
            currency: entry.rate.currency,
          });
        }
      }

      if (failReason || !hotelRef || bookingRooms.length === 0) {
        requestLogger.warn(
          "Booking failed hard-rule verification after AI allocation",
          {
            context: this.context,
            flightId,
            bookingId: booking.id,
            pnr: booking.pnr,
            reason: failReason ?? "No hotel assignment produced by allocator",
          },
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
          reason: failReason ?? "No hotel assignment produced by allocator",
        });
      } else {
        // Booking fully verified - commit the trial decrements for real.
        for (const [rateKey, amount] of trialDecrements) {
          allotmentLedger.set(rateKey, allotmentLedger.get(rateKey)! - amount);
        }
        const specialNotes = booking.specialNotes ?? [];
        const reason =
          `Best available ${hotelRef.category} option for ${booking.travelClass} class` +
          (specialNotes.length
            ? `; special request (${specialNotes.join(
                ", ",
              )}) recorded but not verifiable from hotel data - confirm with the hotel directly.`
            : ".");

        const bookingTotalPrice = this.roundCurrency(
          bookingRooms.reduce((sum, room) => sum + room.price, 0),
        );
        requestLogger.debug("Booking allocated to hotel", {
          context: this.context,
          flightId,
          bookingId: booking.id,
          pnr: booking.pnr,
          hotelName: hotelRef.hotelName,
          hotelCategory: hotelRef.category,
          roomCount: bookingRooms.length,
          totalPrice: bookingTotalPrice,
        });
        results.push({
          bookingId: booking.id,
          pnr: booking.pnr,
          class: booking.travelClass,
          passengers: {
            adults: booking.adults,
            children: booking.children,
          },
          hotel: hotelRef,
          rooms: bookingRooms,
          totalPrice: bookingTotalPrice,
          allocationStatus: "RECOMMENDED",
          reason,
        });
      }
    }

    // Deterministic rescue: the AI sometimes splits a booking across hotels or
    // drops a group. Place any still-failed booking's rooms at one hotel that
    // has capacity + remaining allotment for every shape it needs.
    const wantsHighStars = (travelClass: string): boolean =>
      travelClass === "first_class" || travelClass === "business";
    for (let index = 0; index < results.length; index += 1) {
      const item = results[index];
      if (item.allocationStatus === "RECOMMENDED") {
        continue;
      }
      const booking = eligibleBookings.find((b) => b.id === item.bookingId);
      const needs = booking
        ? Array.from(pgMeta.values()).filter((m) => m.booking.id === booking.id)
        : [];
      if (!booking || needs.length === 0) {
        continue;
      }

      const orderedHotels = [...hotels].sort((a, b) =>
        wantsHighStars(booking.travelClass)
          ? b.stars - a.stars
          : a.stars - b.stars,
      );

      let picked:
        | {
            hotel: AvailabilityHotel;
            picks: Array<{
              rate: AvailabilityRoomRate;
              roomsNeeded: number;
              shape: RoomOccupancy;
            }>;
          }
        | undefined;
      for (const hotel of orderedHotels) {
        const picks: Array<{
          rate: AvailabilityRoomRate;
          roomsNeeded: number;
          shape: RoomOccupancy;
        }> = [];
        // Cloned per hotel: two different shape needs can widen to the same
        // oversized rate, so decrement a local copy as each is tentatively
        // filled to avoid double-booking the last unit.
        const trialLedger = new Map(allotmentLedger);
        for (const meta of needs) {
          const rate = this.pickRateForShape(
            hotel,
            meta.shape,
            meta.roomsNeeded,
            trialLedger,
          );
          if (!rate) {
            break;
          }
          trialLedger.set(
            rate.rateKey,
            (trialLedger.get(rate.rateKey) ?? rate.allotment ?? 0) -
              meta.roomsNeeded,
          );
          picks.push({ rate, roomsNeeded: meta.roomsNeeded, shape: meta.shape });
        }
        if (picks.length === needs.length) {
          picked = { hotel, picks };
          break;
        }
      }
      if (!picked) {
        continue;
      }

      const rescueRooms = picked.picks.flatMap(({ rate, roomsNeeded, shape }) => {
        allotmentLedger.set(
          rate.rateKey,
          (allotmentLedger.get(rate.rateKey) ?? rate.allotment ?? 0) -
            roomsNeeded,
        );
        // Party's real size (shape), not the room's capacity (rate) -
        // widening can pick an oversized room; verifier does the same.
        return Array.from({ length: roomsNeeded }, () => ({
          adults: shape.adults,
          children: shape.children,
          rateKey: rate.rateKey,
          roomName: rate.roomName,
          boardName: rate.boardName,
          price: this.roundCurrency(rate.netPrice),
          currency: rate.currency,
        }));
      });
      results[index] = {
        bookingId: booking.id,
        pnr: booking.pnr,
        class: booking.travelClass,
        passengers: { adults: booking.adults, children: booking.children },
        hotel: {
          hotelCode: picked.hotel.hotelCode,
          hotelName: picked.hotel.hotelName,
          category: picked.hotel.category,
          stars: picked.hotel.stars,
        },
        rooms: rescueRooms,
        totalPrice: this.roundCurrency(
          rescueRooms.reduce((sum, room) => sum + room.price, 0),
        ),
        allocationStatus: "RECOMMENDED",
        reason: `Assigned to ${picked.hotel.hotelName} (${picked.hotel.category}) - one hotel covering all rooms for ${booking.travelClass} class.`,
      };
    }

    // Hard class-priority pass: AI/rescue only treat class as guidance, so a
    // lower class can end up in a better hotel. Group RECOMMENDED bookings
    // whose room-shape composition matches exactly, then re-zip the hotels
    // already assigned within that group (sorted by stars) to the bookings
    // (sorted by class rank) - a same-supply reshuffle, not a full solve, so
    // it can't promote to a hotel no matching booking was ever assigned.
    const shapeSignature = (item: BookingRecommendationResult): string | null => {
      if (!item.rooms || item.rooms.length === 0) {
        return null;
      }
      const counts = new Map<string, number>();
      for (const r of item.rooms) {
        const key = `${r.adults}_${r.children}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([shape, count]) => `${shape}x${count}`)
        .join("|");
    };
    const rebalanceGroups = new Map<string, number[]>();
    results.forEach((item, index) => {
      if (item.allocationStatus !== "RECOMMENDED") {
        return;
      }
      const signature = shapeSignature(item);
      if (!signature) {
        return;
      }
      const list = rebalanceGroups.get(signature);
      if (list) {
        list.push(index);
      } else {
        rebalanceGroups.set(signature, [index]);
      }
    });

    for (const indices of rebalanceGroups.values()) {
      if (indices.length < 2) {
        continue;
      }
      const byPriority = [...indices].sort(
        (a, b) => (classRank[results[b].class] ?? 0) - (classRank[results[a].class] ?? 0),
      );
      const byStars = [...indices].sort(
        (a, b) =>
          (results[b].hotel?.stars ?? 0) - (results[a].hotel?.stars ?? 0) ||
          (results[a].totalPrice ?? 0) - (results[b].totalPrice ?? 0),
      );
      const assignments = byStars.map((idx) => ({
        hotel: results[idx].hotel!,
        rooms: results[idx].rooms!,
        totalPrice: results[idx].totalPrice!,
      }));
      byPriority.forEach((idx, position) => {
        const assignment = assignments[position];
        const booking = eligibleBookings.find((b) => b.id === results[idx].bookingId)!;
        const specialNotes = booking.specialNotes ?? [];
        results[idx] = {
          ...results[idx],
          hotel: assignment.hotel,
          rooms: assignment.rooms,
          totalPrice: assignment.totalPrice,
          reason:
            `Best available ${assignment.hotel.category} option for ${booking.travelClass} class` +
            (specialNotes.length
              ? `; special request (${specialNotes.join(", ")}) recorded but not verifiable from hotel data - confirm with the hotel directly.`
              : "."),
        };
      });
    }

    const allocated = results.filter(
      (item) => item.allocationStatus === "RECOMMENDED",
    );
    const failed = results.length - allocated.length;

    // All-or-nothing: a partial save left the flight unable to retry
    // (needs PASSENGERS_BOOKING_CONFIRMED) or pay (needs ALLOCATED) - a dead
    // end for one bad PNR. Throw instead so the flight stays retriable.
    if (failed > 0) {
      const failures = results
        .filter((item) => item.allocationStatus !== "RECOMMENDED")
        .map((item) => ({
          bookingId: item.bookingId,
          pnr: item.pnr,
          status: item.allocationStatus,
          reason: item.reason ?? null,
        }));
      requestLogger.warn(
        `Hotel allocation incomplete for flight '${flightId}': ${failed}/${results.length} bookings unallocated - nothing saved`,
        { context: this.context, flightId, failures },
      );
      // HttpExceptionFilter only forwards message/errors, not a plain
      // `failures` field - array message is its known convention: first
      // element becomes the headline, the array becomes `errors`.
      const headline = `Hotel allocation failed: ${failed} of ${results.length} bookings could not be allocated. No allocations were saved.`;
      throw new BadRequestException({
        message: [
          headline,
          ...failures.map((f) => `${f.pnr}: ${f.reason ?? "No hotel assignment"}`),
        ],
        failures,
      });
    }

    const totalRooms = allocated.reduce(
      (sum, item) => sum + (item.rooms?.length ?? 0),
      0,
    );
    const currency =
      allocated.find((item) => item.rooms?.[0]?.currency)?.rooms?.[0]
        ?.currency ?? "EUR";

    requestLogger.info("Completed flight-level hotel recommendation process", {
      context: this.context,
      requestId,
      flightId,
      allocatedBookings: allocated.length,
      failedBookings: failed,
    });

    // Booked the hotel recommendations using the allocated results and hotel partner APIs
    // For now avoid the booking step and only provide recommendations(consider as booked)

    // Best-effort hotel content lookup, once per allocated hotel (not per booking).
    const allocatedHotelCodes = Array.from(
      new Set(
        results
          .map((item) => item.hotel?.hotelCode)
          .filter((code): code is string => !!code),
      ),
    );
    const contentByHotelCode = new Map<string, HotelContentDetails>();

    for (const hotelCode of allocatedHotelCodes) {
      const content = await this.hotelProvider.getHotelContentDetails(
        hotelCode,
        requestId,
        requestLogger,
      );
      if (content) {
        contentByHotelCode.set(hotelCode, content);
      }
    }

    // create hotel bookings in db
    // step 1 - Format the data for hotel bookings in the database
    const hotelBookings = results.map((item, index) => {
      const price = item?.totalPrice || 0;
      const pricing = this.calculatePricing(
        price,
        price,
        platformFeePercentage,
        0,
        0,
      );
      const content = item.hotel?.hotelCode
        ? contentByHotelCode.get(item.hotel.hotelCode)
        : undefined;
      return {
        cancelledFlightId: flightId,
        bookingId: item.bookingId,
        checkInDate: checkInDateObj.toISOString(),
        checkOutDate: checkOutDateObj.toISOString(),
        actualPrice: pricing.actualPrice,
        buyingPrice: pricing.buyingPrice,
        sellingPrice: pricing.sellingPrice,
        tax: pricing.tax,
        platformFeePercentage: platformFeePercentage,
        platformFee: pricing.platformFee,
        totalPrice: pricing.totalPrice,
        earnings: pricing.earnings,
        discount: pricing.discount,
        hotelCode: item.hotel?.hotelCode || "temp",
        hotelName: item.hotel?.hotelName || "temp",
        category: item.hotel?.category || "temp",
        address: content?.address ?? null,
        contact: content?.contact ?? null,
        latitude: content?.latitude ?? null,
        longitude: content?.longitude ?? null,
        distanceFromAirportKm: content?.distanceFromAirportKm ?? null,
        imageUrl: content?.imageUrl ?? null,
        website: content?.website ?? null,
        amenities: content?.amenities ?? null,
        rooms: item.rooms?.map((room) => ({
          adults: room.adults,
          children: room.children,
          roomName: room.roomName,
          boardName: room.boardName,
          price: room.price,
        })),
        totalRooms: item.rooms?.length ?? 0,
        // "status" is the real column - "allocationStatus" was silently
        // dropped by TypeORM, leaving every row stuck at the DRAFT default.
        status: HotelAllocationStatus.CONFIRMED,
        currency: "USD",
        bookingReference: `temp-${item.bookingId}-${index}`,
        reason: item.reason ?? null,
      };
    });

    // step 2 - Save the formatted hotel bookings to the database
    // No filter needed: every entry here is a successful allocation, since
    // the all-or-nothing gate above already rejected the batch otherwise.
    const rawTotals = hotelBookings.reduce(
        (acc, item) => {
          acc.totalActualPrice += item.actualPrice ?? 0;
          acc.totalBuyingPrice += item.buyingPrice ?? 0;
          acc.totalSellingPrice += item.sellingPrice ?? 0;
          acc.totalDiscounts += item.discount ?? 0;
          acc.totalHotelTaxes += item.tax ?? 0;
          acc.totalPlatformFee += item.platformFee ?? 0;
          acc.totalPriceForAll += item.totalPrice ?? 0;
          acc.totalEarnings += item.earnings ?? 0;
          acc.totalHotelRooms += item.totalRooms ?? 0;
          return acc;
        },
        {
          totalActualPrice: 0,
          totalBuyingPrice: 0,
          totalSellingPrice: 0,
          totalDiscounts: 0,
          totalHotelTaxes: 0,
          totalPlatformFee: 0,
          totalPriceForAll: 0,
          totalHotelRooms: 0,
          totalEarnings: 0,
        },
      );

    const totalActualPrice = this.roundCurrency(rawTotals.totalActualPrice);
    const totalBuyingPrice = this.roundCurrency(rawTotals.totalBuyingPrice);
    const totalSellingPrice = this.roundCurrency(rawTotals.totalSellingPrice);
    const totalDiscounts = this.roundCurrency(rawTotals.totalDiscounts);
    const totalHotelTaxes = this.roundCurrency(rawTotals.totalHotelTaxes);
    const totalPlatformFee = this.roundCurrency(rawTotals.totalPlatformFee);
    const totalPriceForAll = this.roundCurrency(rawTotals.totalPriceForAll);
    const totalEarnings = this.roundCurrency(rawTotals.totalEarnings);
    const totalHotelRooms = this.roundCurrency(rawTotals.totalHotelRooms);

    // failed === 0 is guaranteed here (the all-or-nothing throw above),
    // so this save always represents a fully-successful allocation.
    await this.cancelledFlightsRepository.saveHotelAllocations(
      flightId,
      {
        hotelBookings,
        totalActualPrice,
        totalBuyingPrice,
        totalSellingPrice,
        totalDiscounts,
        totalHotelTaxes,
        platformFeePercentage,
        totalPlatformFee,
        totalPrice: totalPriceForAll,
        totalHotelRooms,
        totalEarnings,
        status: FlightStatus.ALLOCATED,
      },
      requestLogger,
    );

    return {
      cancelledFlightId: flight.id,
      status: FlightStatus.ALLOCATED,
      totalBookings: bookings.length,
      allocatedBookings: allocated.length,
      failedBookings: failed,
      totalRooms: totalHotelRooms,
      totalActualPrice,
      totalSellingPrice,
      totalDiscounts,
      totalHotelTaxes,
      platformFeePercentage,
      totalPlatformFee,
      currency,
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
