import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Logger } from "winston";
import { winstonInstance } from "../logger/logger.config";
import {
  CancelledFlightsRepository,
  HotelCandidate,
  isRebookableAllocation,
} from "./cancelled-flights.repository";
import { BookingEntity } from "./entities/booking.entity";
import { HotelContentService } from "./hotel-content.service";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { randomUUID } from "crypto";
import { HotelBookingEntity } from "./entities/hotel-booking.entity";
import {
  AllocationSuccess,
  HotelAllocationRecord,
  ProviderOrder,
  bookingReferenceOf,
  rateKeysOf,
  starsLabel,
  toProviderOrders,
} from "./hotel-allocation.record";
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
  HotelGroupBookingRestrictedError,
  HotelProvider,
  HotelRateCheck,
  RoomOccupancy,
} from "./hotel-providers/hotel-provider.interface";
import { AiService } from "../common/ai/ai.service";
import { AuthenticatedRequest } from "../auth/interfaces/authenticated-request.interface";
import { config } from "../config/config";
import { distanceKm } from "../common/utils/geo.util";
import { HOTEL_STARS_BY_CLASS } from "../common/constants/hotel-stars.constants";
import {
  HotelAllocationBookingResultDto,
  HotelAllocationProgressDto,
  HotelAllocationsDto,
  PnrBookingStatus,
} from "./dto/hotel-allocations.dto";
import {
  AllotmentLedger,
  LedgerClaim,
  RoomNeed,
  SelectedRate,
  buildCandidatePlan,
  buildOrderCandidatePlan,
  buildSupplyPools,
  chooseRoomSplit,
  classRank,
  combinationKey,
  compareBookingPriority,
  orderRatesFor,
  selectCandidateRates,
  shapeKey,
  StarRule,
  supplyTarget,
  toRoomNeeds,
} from "./hotel-allocation.planner";
import { BookHotelRequestDto } from "./dto/book-hotel-request.dto";
import { daysBetween } from "./stay-dates";

type AllocationStatus =
  | "RECOMMENDED"
  | "NO_SUITABLE_HOTEL"
  | "INVALID_PASSENGER_DATA"
  | "NO_AVAILABILITY";

interface RoomSplitPlan {
  preferred: RoomOccupancy[];
  fallbacks: RoomOccupancy[][];
}

/** The flight's saved stay: calendar dates (YYYY-MM-DD), check-out exclusive. */
interface StayDates {
  checkIn: string;
  checkOut: string;
}

interface AllocationRunContext {
  flight: CancelledFlightEntity;
  stay: StayDates;
  platformFeePercentage: number;
  requestId: string;
  requestLogger: Logger;
  runId: string;
  /** Caps new booking attempts per PNR in this pass (recovery pass: 1). */
  maxNewAttemptsPerPnr?: number;
  /** Started by a user: counts toward the retry limit if it reached the supplier. */
  userStarted?: boolean;
}

interface BookingPlanningState {
  ledger: AllotmentLedger;
  contentCache: Map<string, Promise<HotelContentDetails | null>>;
  /** Hotels the supplier refused as group bookings for these dates; not tried again. */
  restrictedHotels: Set<string>;
}

export type SupplierWebhookOutcome = "processed" | "ignored" | "retry";

type BookingAttemptOutcome =
  | {
      kind: "confirmed";
      allocation: HotelAllocationRecord;
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

/** Adds the distance to the airport when the supplier doesn't give one. */
const withAirportDistance = (
  content: HotelContentDetails | null,
  airport?: { latitude: unknown; longitude: unknown } | null,
): HotelContentDetails | null => {
  if (
    !content ||
    content.distanceFromAirportKm != null ||
    content.latitude == null ||
    content.longitude == null ||
    airport?.latitude == null ||
    airport?.longitude == null
  ) {
    return content;
  }
  return {
    ...content,
    distanceFromAirportKm: distanceKm(
      {
        latitude: Number(airport.latitude),
        longitude: Number(airport.longitude),
      },
      {
        latitude: Number(content.latitude),
        longitude: Number(content.longitude),
      },
    ),
  };
};

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
  "2_5": {
    preferred: [room(1, 3), room(1, 2)],
    fallbacks: [[room(1, 4), room(1, 1)]],
  },
  "2_6": {
    preferred: [room(1, 3), room(1, 3)],
    fallbacks: [[room(1, 4), room(1, 2)]],
  },
  "2_7": { preferred: [room(1, 4), room(1, 3)], fallbacks: [] },

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
  "3_5": {
    preferred: [room(2, 2), room(1, 3)],
    fallbacks: [[room(2, 1), room(1, 4)]],
  },
  "3_6": {
    preferred: [room(2, 3), room(1, 3)],
    fallbacks: [[room(1, 2), room(1, 2), room(1, 2)]],
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
  "4_5": {
    preferred: [room(2, 2), room(2, 3)],
    fallbacks: [[room(2, 1), room(1, 2), room(1, 2)]],
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
export class HotelAllocationService implements OnApplicationBootstrap {
  private readonly context = "HotelAllocationService";

  constructor(
    private readonly cancelledFlightsRepository: CancelledFlightsRepository,
    @Inject(HOTEL_PROVIDER) private readonly hotelProvider: HotelProvider,
    private readonly aiService: AiService,
    private readonly hotelContentService: HotelContentService,
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

  /** The passport country most PNRs share; used for the flight-wide hotel search. */
  private majorityResidency(
    bookings: Array<Pick<BookingEntity, "residency">>,
  ): string | null {
    const counts = new Map<string, number>();
    for (const { residency } of bookings) {
      counts.set(residency, (counts.get(residency) ?? 0) + 1);
    }
    return (
      [...counts].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0]?.[0] ?? null
    );
  }

  /** A travel class's minimum and preferred hotel stars; the minimum is never below HOTEL_SEARCH_MIN_RATE. */
  private starRule(travelClass: TravelClass): StarRule {
    const rule = HOTEL_STARS_BY_CLASS[travelClass];
    const min = Math.max(rule?.min ?? 0, config.hotelSearch.minRate);
    return { min, preferred: Math.max(rule?.preferred ?? 0, min) };
  }

  // Adults/children only, no ages - bookings never carry child ages, so an
  // ages-aware key never matches a real rate.
  private roomShapeKey(occupancy: {
    adults: number;
    children: number;
  }): string {
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

  /** Splits an order total over its rooms; the last room takes the rounding. */
  private splitAmount(total: number, parts: number): number[] {
    if (parts <= 1) return [total];
    const share = this.roundCurrency(total / parts);
    return Array.from({ length: parts }, (_, index) =>
      index < parts - 1
        ? share
        : this.roundCurrency(total - share * (parts - 1)),
    );
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
      const minRate = hotel.rates.reduce((acc, rate) => {
        const perRoom = rate.netPrice / (rate.rooms?.length ?? 1);
        return perRoom < acc ? perRoom : acc;
      }, Number.POSITIVE_INFINITY);

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
    if (this.hotelProvider.searchMultiRoomOrders && split.length > 1) {
      const order = orderRatesFor({ rates }, split).sort(
        (a, b) => a.netPrice - b.netPrice,
      )[0];
      if (!order) {
        return null;
      }
      const prices = this.splitAmount(order.netPrice, order.rooms!.length);
      return order.rooms!.map((room, index) => ({
        adults: room.adults,
        children: room.children,
        rateKey: order.rateKey,
        roomName: order.roomName,
        boardName: order.boardName,
        price: prices[index],
        currency: order.currency,
      }));
    }
    const buckets = new Map<string, AvailabilityRoomRate[]>();
    for (const rate of rates.filter((rate) => !rate.rooms)) {
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
  /** Hotel options for one PNR, searched with its room split and priced for all of its rooms. */
  async getHotelRecommendations(
    flightId: number,
    bookingId: number,
    query: { radius?: number; rooms?: RoomOccupancy[] },
    user: AuthenticatedRequest["user"],
    requestId: string,
    requestLogger: Logger,
  ) {
    const flight = await this.requireAirlineFlight(
      flightId,
      user,
      requestLogger,
    );
    if (!flight.departureAirport) {
      throw new NotFoundException(
        `Departure airport not found for flight '${flightId}'`,
      );
    }
    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestLogger,
    );
    const split = this.resolveRoomSplitPlan(booking, requestLogger);
    if (!split.plan) {
      throw new BadRequestException(split.reason);
    }
    const splitOptions = [split.plan.preferred, ...split.plan.fallbacks];
    if (
      query.rooms &&
      !this.validateSplit(booking.adults, booking.children, query.rooms)
    ) {
      throw new BadRequestException(
        `Rooms must hold exactly ${booking.adults} adult(s) and ${booking.children} child(ren), with at least one adult per room`,
      );
    }
    const rooms = query.rooms ?? split.plan.preferred;
    const radius = query.radius ?? config.hotelSearch.defaultRadius;
    const stay = this.resolveStayDates(flight, requestLogger);
    const stars = this.starRule(booking.travelClass);

    let hotels: AvailabilityHotel[] = [];
    try {
      hotels = this.mergeHotelRates(
        await this.searchSplits(
          flight,
          stay,
          [{ plan: { preferred: rooms, fallbacks: [] }, minStars: stars.min }],
          booking.residency,
          requestId,
          requestLogger,
          radius,
        ),
      );
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }

    const options = hotels
      .map((hotel) => {
        const selected = this.getBestRatesForHotelAndSplit(hotel.rates, rooms);
        if (!selected) return null;
        return {
          hotelCode: hotel.hotelCode,
          hotelName: hotel.hotelName,
          stars: hotel.stars,
          meetsMinimum: hotel.stars >= stars.min,
          address: hotel.address,
          totalPrice: this.roundCurrency(
            selected.reduce((sum, room) => sum + room.price, 0),
          ),
          currency: selected[0].currency,
          rooms: selected,
        };
      })
      .filter((option): option is NonNullable<typeof option> => !!option)
      .sort(
        (a, b) =>
          Number(b.meetsMinimum) - Number(a.meetsMinimum) ||
          Number(b.stars >= stars.preferred) -
            Number(a.stars >= stars.preferred) ||
          b.stars - a.stars ||
          a.totalPrice - b.totalPrice,
      )
      .slice(0, 20);

    requestLogger.info("Hotel options found for PNR", {
      context: this.context,
      flightId,
      bookingId,
      radius,
      rooms: rooms.map((room) => `${room.adults}+${room.children}`).join(","),
      options: options.length,
    });

    return {
      bookingId: booking.id,
      pnr: booking.pnr,
      adults: booking.adults,
      children: booking.children,
      radius,
      radiusUnit: config.hotelSearch.unit,
      minStars: stars.min,
      maxRadius: Math.max(
        config.hotelSearch.defaultRadius,
        config.hotelSearch.maxRadius,
      ),
      rooms,
      splitOptions: splitOptions.map((option, index) => ({
        rooms: option,
        recommended: index === 0,
      })),
      options,
    };
  }

  /** One entry per hotel, holding its per-room and multiroom order rates. */
  private mergeHotelRates(found: {
    hotels: AvailabilityHotel[];
    orderHotels: AvailabilityHotel[] | undefined;
  }): AvailabilityHotel[] {
    const byCode = new Map<string, AvailabilityHotel>();
    for (const hotel of [...found.hotels, ...(found.orderHotels ?? [])]) {
      const existing = byCode.get(hotel.hotelCode);
      byCode.set(
        hotel.hotelCode,
        existing
          ? { ...existing, rates: [...existing.rates, ...hotel.rates] }
          : hotel,
      );
    }
    return [...byCode.values()];
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

    const { checkIn, checkOut } = this.resolveStayDates(flight, requestLogger);

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
          currency: config.currency,
        },
        allocations: results,
      };
    }

    const demand = eligibleBookings.map((booking) => ({
      plan: splitPlansByBooking.get(booking.id)!,
      minStars: this.starRule(booking.travelClass).min,
    }));

    let hotels: AvailabilityHotel[] = [];
    try {
      hotels = this.mergeHotelRates(
        await this.searchSplits(
          flight,
          { checkIn, checkOut },
          demand,
          this.majorityResidency(eligibleBookings),
          requestId,
          requestLogger,
        ),
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
          {
            context: this.context,
            flightId,
            bookingId: booking.id,
            pnr: booking.pnr,
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
        ?.currency ?? config.currency;

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

  /**
   * A cancellation's platform fee: frozen at its first allocation run, so
   * later runs and manual bookings keep it; until then the airline's current fee.
   */
  private feeForFlight(
    flight: Pick<CancelledFlightEntity, "platformFeePercentage" | "platformFeeLockedAt">,
    user: AuthenticatedRequest["user"],
  ): number {
    return Number(
      flight.platformFeeLockedAt
        ? flight.platformFeePercentage
        : (user.platformFeePercentage ?? config.platformFeePercentage),
    );
  }

  /** User-started runs per flight: the first allocation plus one retry. */
  private static readonly MAX_USER_ALLOCATION_RUNS = 2;

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
    // The airline's current fee; the claim freezes it on the flight at its
    // first run, and later runs use the frozen fee instead.
    const airlineFeePercentage = Number(
      user.platformFeePercentage ?? config.platformFeePercentage,
    );
    requestLogger.info("Starting flight-level hotel allocation and booking", {
      context: this.context,
      flightId,
    });

    const flight = await this.requireAirlineFlight(
      flightId,
      user,
      requestLogger,
    );
    if (
      !HotelAllocationService.ALLOCATION_RUN_STATUSES.includes(flight.status)
    ) {
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

    if ((await this.getSupplierCheckState(flightId)).awaiting) {
      throw new BadRequestException(
        `Some bookings for flight '${flightId}' are still waiting for the supplier's status; retry once the check is done`,
      );
    }

    const runId = randomUUID();
    const run = await this.cancelledFlightsRepository.claimFlightAllocationRun(
      flightId,
      HotelAllocationService.ALLOCATION_RUN_STATUSES,
      config.hotelBooking.allocationRunLeaseMs,
      runId,
      requestLogger,
      HotelAllocationService.MAX_USER_ALLOCATION_RUNS,
      false,
      airlineFeePercentage,
    );
    if (!run.claimed) {
      if (run.reason === "limit") {
        throw new BadRequestException(
          `Remaining bookings for flight '${flightId}' were already retried once; no further retries are allowed`,
        );
      }
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

    const platformFeePercentage = run.platformFeePercentage;
    requestLogger.info("Hotel allocation run started in the background", {
      context: this.context,
      flightId,
      runId,
      platformFeePercentage,
      airlineFeePercentage,
    });
    void this.executeAllocationRun(
      {
        flight,
        stay,
        platformFeePercentage,
        requestId,
        requestLogger,
        runId,
        userStarted: true,
      },
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
    const [bookings, rows, attempts, runState, supplierCheck] =
      await Promise.all([
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
        this.getSupplierCheckState(flightId),
      ]);
    const platformFeePercentage = this.feeForFlight(flight, user);
    return this.buildAllocationSummary(
      flight,
      bookings,
      rows,
      attempts,
      runState,
      platformFeePercentage,
      supplierCheck,
    );
  }

  async getHotelAllocationProgress(
    flightId: number,
    user: AuthenticatedRequest["user"],
    requestLogger: Logger,
  ): Promise<HotelAllocationProgressDto> {
    const progress =
      await this.cancelledFlightsRepository.getAllocationProgress(
        flightId,
        config.hotelBooking.allocationRunLeaseMs,
      );
    if (!progress || progress.airlineId !== user.airlineId) {
      requestLogger.warn("Cancelled flight not found for airline", {
        context: this.context,
        flightId,
        airlineId: user.airlineId,
      });
      throw new NotFoundException(`Cancelled flight '${flightId}' not found`);
    }
    const { counts } = progress;
    const totalPnrs = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return {
      cancelledFlightId: flightId,
      status: progress.status,
      running: progress.running,
      lastRunError: progress.stale
        ? "The last allocation run stopped unexpectedly; run allocation again"
        : progress.error,
      totalPnrs,
      processedPnrs: counts.SUCCESS + counts.FAILED + counts.MANUAL_CHECK,
      successfulPnrs: counts.SUCCESS,
      pendingPnrs: counts.PENDING,
      failedPnrs: counts.FAILED,
      manualCheckPnrs: counts.MANUAL_CHECK,
      notStartedPnrs: counts.NOT_STARTED,
      fullyBooked: totalPnrs > 0 && counts.SUCCESS === totalPnrs,
    };
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
      await this.refreshMissingOrderInfo(
        flight.id,
        run.requestId,
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
        requestLogger,
      );

      const rows =
        await this.cancelledFlightsRepository.findAllocationsByFlightId(
          flight.id,
          requestLogger,
        );
      const pendingIds = new Set(
        rows
          .filter((row) => isRebookableAllocation(row))
          .map((row) => row.bookingId),
      );
      const pending = bookings.filter((booking) => pendingIds.has(booking.id));

      requestLogger.info(
        "Resolved bookings to process in this allocation run",
        {
          context: this.context,
          flightId: flight.id,
          runId,
          totalBookings: bookings.length,
          pending: pending.length,
        },
      );

      if (pending.length > 0) {
        await this.planPendingBookings(run, pending, rows);
        await this.bookPlannedBookings(run, pending);
      }

      await this.runRecoveryPass(run, bookings);
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
          run.userStarted === true,
        )
        .catch((error: any) =>
          requestLogger.error("Could not complete the hotel allocation run", {
            context: this.context,
            flightId: flight.id,
            runId,
            error: error?.message,
          }),
        );
      this.schedulePostRunCheck(flight.id, run.requestId, requestLogger);
    }
  }

  /**
   * Runs stopped by a backend stop/crash are finished once after startup,
   * when their lease has expired; this does not count as a user retry.
   */
  onApplicationBootstrap(): void {
    const timer = setTimeout(
      () => void this.resumeInterruptedRuns(),
      config.hotelBooking.allocationRunLeaseMs,
    );
    timer.unref();
    void this.resumeManualCheckChecks();
  }

  /**
   * Post-run checks are in-memory timers; after a restart they are scheduled
   * again for every flight that still has MANUAL_CHECK attempts. Flights
   * mid-run are skipped: their run schedules its own checks when it ends.
   */
  private async resumeManualCheckChecks(): Promise<void> {
    if (!this.hotelProvider.checkBookingStatus) return;
    const requestId = randomUUID();
    const requestLogger = winstonInstance.child({ requestId });
    try {
      const flightIds =
        await this.cancelledFlightsRepository.findFlightIdsWithManualCheckAttempts(
          config.hotelProvider.name,
        );
      for (const flightId of flightIds) {
        this.schedulePostRunCheck(flightId, requestId, requestLogger);
      }
      if (flightIds.length > 0) {
        requestLogger.info("Rescheduled MANUAL_CHECK post-run checks", {
          context: this.context,
          flightIds,
        });
      }
    } catch (error: any) {
      requestLogger.error("Could not reschedule MANUAL_CHECK post-run checks", {
        context: this.context,
        error: error?.message,
      });
    }
  }

  private async resumeInterruptedRuns(): Promise<void> {
    const requestId = randomUUID();
    const requestLogger = winstonInstance.child({ requestId });
    const leaseMs = config.hotelBooking.allocationRunLeaseMs;
    const flightIds = await this.cancelledFlightsRepository
      .findInterruptedRunFlightIds(leaseMs)
      .catch(() => [] as number[]);
    for (const flightId of flightIds) {
      try {
        const flight =
          await this.cancelledFlightsRepository.findFlightWithRelations(
            flightId,
            requestLogger,
          );
        if (!flight?.departureAirport) continue;
        const stay = this.resolveStayDates(flight, requestLogger);
        const bookings =
          await this.cancelledFlightsRepository.findBookingsByFlightId(
            flightId,
            requestLogger,
          );
        const runId = randomUUID();
        const claim =
          await this.cancelledFlightsRepository.claimFlightAllocationRun(
            flightId,
            [FlightStatus.HOTEL_ALLOCATION_IN_PROGRESS],
            leaseMs,
            runId,
            requestLogger,
          );
        if (!claim.claimed) continue;
        requestLogger.info("Resuming interrupted hotel allocation run", {
          context: this.context,
          flightId,
          runId,
        });
        await this.executeAllocationRun(
          {
            flight,
            stay,
            platformFeePercentage: Number(
              flight.platformFeePercentage ?? config.platformFeePercentage,
            ),
            requestId,
            requestLogger,
            runId,
          },
          bookings,
        );
      } catch (error: any) {
        requestLogger.error("Could not resume interrupted allocation run", {
          context: this.context,
          flightId,
          error: error?.message,
          stack: error?.stack,
        });
      }
    }
  }

  /**
   * MANUAL_CHECK bookings left after a run are checked again with the
   * supplier every postRunCheckIntervalMs, postRunCheckCount times (default:
   * every 5 min, twice). Still no final status after the last check: marked
   * FAILED (partial bookings stay MANUAL_CHECK).
   */
  private static postRunCheckCount(): number {
    return Math.max(1, config.hotelBooking.postRunCheckCount);
  }

  private schedulePostRunCheck(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
    check = 0,
  ): void {
    const dueAt = Date.now() + config.hotelBooking.postRunCheckIntervalMs;
    this.nextSupplierCheckAt.set(flightId, dueAt);
    const clearDue = () => {
      if (this.nextSupplierCheckAt.get(flightId) === dueAt) {
        this.nextSupplierCheckAt.delete(flightId);
      }
    };
    const timer = setTimeout(() => {
      const last = check === HotelAllocationService.postRunCheckCount() - 1;
      this.runPostRunCheck(flightId, requestId, requestLogger, last)
        .then((unresolved) => {
          if (unresolved !== null && unresolved > 0 && !last) {
            this.schedulePostRunCheck(
              flightId,
              requestId,
              requestLogger,
              check + 1,
            );
            return;
          }
          clearDue();
        })
        .catch((error: any) => {
          clearDue();
          requestLogger.error("Post-run MANUAL_CHECK check failed", {
            context: this.context,
            flightId,
            check: check + 1,
            error: error?.message,
          });
        });
    }, config.hotelBooking.postRunCheckIntervalMs);
    timer.unref();
  }

  private readonly nextSupplierCheckAt = new Map<number, number>();

  /** Post-run check under the flight's run lock; null when it could not be claimed. */
  private async runPostRunCheck(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
    lastCheck: boolean,
  ): Promise<number | null> {
    const open = await this.cancelledFlightsRepository.findManualCheckAttempts(
      flightId,
      config.hotelProvider.name,
    );
    if (open.length === 0) return 0;
    const flight =
      await this.cancelledFlightsRepository.findFlightWithRelations(
        flightId,
        requestLogger,
      );
    if (!flight) return null;
    const runId = randomUUID();
    const claim =
      await this.cancelledFlightsRepository.claimFlightAllocationRun(
        flightId,
        [FlightStatus.PASSENGERS_BOOKING_CONFIRMED, FlightStatus.ALLOCATED],
        config.hotelBooking.allocationRunLeaseMs,
        runId,
        requestLogger,
        undefined,
        true,
      );
    if (!claim.claimed) {
      requestLogger.info("Skipped post-run MANUAL_CHECK check", {
        context: this.context,
        flightId,
        reason: claim.reason,
        status: claim.status,
      });
      return null;
    }
    const heartbeat = setInterval(
      () =>
        void this.cancelledFlightsRepository.touchFlightAllocationRun(
          flightId,
          runId,
          requestLogger,
        ),
      Math.max(1000, Math.floor(config.hotelBooking.allocationRunLeaseMs / 5)),
    );
    heartbeat.unref();
    try {
      return await this.reconcileManualChecks(
        flightId,
        requestId,
        requestLogger,
        lastCheck,
      );
    } finally {
      clearInterval(heartbeat);
      await this.cancelledFlightsRepository.completeFlightAllocationRun(
        flightId,
        runId,
        Number(flight.platformFeePercentage ?? config.platformFeePercentage),
        undefined,
        requestLogger,
      );
    }
  }

  /**
   * Retry waits while a MANUAL_CHECK attempt with nothing booked is inside the
   * post-run check window. nextCheckAt falls back to an estimate when the
   * timer runs on another instance.
   */
  private async getSupplierCheckState(
    flightId: number,
  ): Promise<{ awaiting: boolean; nextCheckAt: Date | null }> {
    if (!this.hotelProvider.checkBookingStatus) {
      return { awaiting: false, nextCheckAt: null };
    }
    const intervalMs = config.hotelBooking.postRunCheckIntervalMs;
    const windowMs =
      HotelAllocationService.postRunCheckCount() * intervalMs +
      config.hotelBooking.allocationRunLeaseMs;
    const attempts =
      await this.cancelledFlightsRepository.findManualCheckAttempts(
        flightId,
        config.hotelProvider.name,
      );
    const waiting = attempts.filter(
      (attempt) =>
        Date.now() - new Date(attempt.updatedAt).getTime() < windowMs &&
        !toProviderOrders(attempt.rooms).some(
          (order) => order.status === "booked",
        ),
    );
    if (waiting.length === 0) {
      return { awaiting: false, nextCheckAt: null };
    }
    const estimated = Math.min(
      ...waiting.map(
        (attempt) => new Date(attempt.updatedAt).getTime() + intervalMs,
      ),
    );
    return {
      awaiting: true,
      nextCheckAt: new Date(this.nextSupplierCheckAt.get(flightId) ?? estimated),
    };
  }

  /**
   * End-of-run recovery: resolve MANUAL_CHECK attempts with the supplier, then
   * give FAILED PNRs one more booking attempt from a current recommendation
   * list.
   */
  private async runRecoveryPass(
    run: AllocationRunContext,
    bookings: BookingEntity[],
  ): Promise<void> {
    const { flight, requestLogger } = run;
    try {
      await this.reconcileManualChecks(flight.id, run.requestId, requestLogger);
      const rows =
        await this.cancelledFlightsRepository.findAllocationsByFlightId(
          flight.id,
          requestLogger,
        );
      const retryIds = new Set(
        rows
          .filter((row) => row.status === HotelAllocationStatus.FAILED)
          .map((row) => row.bookingId),
      );
      const retry = bookings.filter((booking) => retryIds.has(booking.id));
      requestLogger.info("Hotel allocation recovery pass", {
        context: this.context,
        flightId: flight.id,
        runId: run.runId,
        retrying: retry.length,
      });
      if (retry.length === 0) {
        return;
      }
      const recoveryRun = { ...run, maxNewAttemptsPerPnr: 1 };
      await this.planPendingBookings(recoveryRun, retry, rows);
      await this.bookPlannedBookings(recoveryRun, retry);
    } catch (error: any) {
      requestLogger.error("Hotel allocation recovery pass failed", {
        context: this.context,
        flightId: flight.id,
        runId: run.runId,
        error: error?.message,
        stack: error?.stack,
      });
    }
  }

  /**
   * Checks each MANUAL_CHECK attempt's open supplier orders and settles it
   * when the outcome is known. Partial bookings stay MANUAL_CHECK. On the
   * last check, an attempt with no final status is marked FAILED. Returns
   * how many attempts are still open.
   */
  private async reconcileManualChecks(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
    lastCheck = false,
  ): Promise<number> {
    if (!this.hotelProvider.checkBookingStatus) {
      return 0;
    }
    const attempts =
      await this.cancelledFlightsRepository.findManualCheckAttempts(
        flightId,
        config.hotelProvider.name,
      );
    let unresolved = 0;
    for (const attempt of attempts) {
      const attemptMeta = {
        context: this.context,
        flightId,
        attemptId: attempt.id,
        bookingId: attempt.bookingId,
        failureCode: attempt.failureCode,
      };
      const orders = toProviderOrders(attempt.rooms);
      try {
        let failureDetail: string | null = null;
        const openReferences = new Set(
          orders
            .filter((order) => order.status === "pending")
            .map((order) => order.reference),
        );
        for (const reference of openReferences) {
          const confirmed = await this.hotelProvider.checkBookingStatus(
            reference,
            requestId,
          );
          requestLogger.info("Checked MANUAL_CHECK order with the supplier", {
            ...attemptMeta,
            reference,
            confirmedState: confirmed.state,
            code: confirmed.code,
          });
          if (confirmed.state === "processing") continue;
          const failureReason =
            confirmed.state === "failed" ? (confirmed.code ?? "failed") : null;
          for (const order of orders) {
            if (order.reference !== reference) continue;
            order.status = confirmed.state;
            order.failureReason = failureReason;
          }
          failureDetail ??= failureReason;
        }
        // No recorded order means the booking call was never sent: the order is
        // recorded before it (providers with a status check), so nothing booked.
        await this.settleAttemptFromSupplier(
          attempt,
          orders,
          failureDetail ??
            (orders.length === 0 ? "no supplier order was created" : null),
          attemptMeta,
          requestId,
          requestLogger,
        );
      } catch (error: any) {
        // Status API errors leave the orders open for the next check.
        requestLogger.warn("Could not reconcile MANUAL_CHECK attempt", {
          ...attemptMeta,
          error: error?.message,
        });
      }
      // Same outcome rule as settleAttemptFromSupplier.
      const booked = orders.filter((o) => o.status === "booked").length;
      const open = orders.some((o) => o.status === "pending");
      if (open && booked === 0 && lastCheck) {
        await this.failUnansweredAttempt(attempt, orders, requestLogger);
      } else if (
        open ||
        (booked > 0 &&
          booked < Math.max(attempt.rooms?.length ?? 0, orders.length))
      ) {
        unresolved += 1;
      }
    }
    return unresolved;
  }

  /** Last post-run check got no final status: mark the attempt FAILED. */
  private async failUnansweredAttempt(
    attempt: HotelBookingEntity,
    orders: ProviderOrder[],
    requestLogger: Logger,
  ): Promise<void> {
    const hotelName =
      attempt.hotel?.name || attempt.hotel?.providerHotelId || "the hotel";
    const sentAt = (attempt.providerRequestSentAt ?? attempt.createdAt)
      .toISOString()
      .replace("T", " ")
      .slice(0, 16);
    const waitedMin =
      (HotelAllocationService.postRunCheckCount() *
        config.hotelBooking.postRunCheckIntervalMs) /
      60000;
    const reason =
      `Booking at ${hotelName} was sent to the supplier at ${sentAt} UTC, but no ` +
      `final status came back within ${waitedMin} minutes after the allocation run; ` +
      `marked as failed (refs: ${[...new Set(orders.map((o) => o.reference))].join(", ") || "none"}).`;
    const settled = await this.cancelledFlightsRepository.finishBookingAttempt(
      attempt.id,
      attempt.bookingId,
      {
        status: HotelBookingAttemptStatus.FAILED,
        failureCode: HotelBookingFailureCode.NO_FINAL_STATUS,
        failureReason: reason,
        providerOrders: orders,
        responseReceived: false,
      },
      undefined,
      requestLogger,
    );
    if (settled.updated) {
      await this.cancelledFlightsRepository.markPnrFailed(
        attempt.bookingId,
        reason,
        requestLogger,
      );
      requestLogger.warn(
        "MANUAL_CHECK booking marked failed: no final status",
        {
          context: this.context,
          flightId: attempt.cancelledFlightId,
          attemptId: attempt.id,
          bookingId: attempt.bookingId,
          reason,
        },
      );
    }
  }

  private resolveStayDates(
    flight: CancelledFlightEntity,
    requestLogger: Logger,
  ): StayDates {
    const { checkInDate: checkIn, checkOutDate: checkOut } = flight;
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      requestLogger.warn(
        `Invalid stay dates '${checkIn}' to '${checkOut}' for flight '${flight.id}'`,
        {
          context: this.context,
          flightId: flight.id,
        },
      );
      throw new BadRequestException(
        `Invalid stay dates '${checkIn}' to '${checkOut}' for flight '${flight.id}'`,
      );
    }
    requestLogger.info(
      `Using stay ${checkIn} to ${checkOut} (${daysBetween(checkIn, checkOut)} nights) for flight '${flight.id}'`,
      {
        context: this.context,
        flightId: flight.id,
      },
    );
    return { checkIn, checkOut };
  }

  /**
   * Availability for the PNRs' room splits, searched ring by ring (10 more each
   * time, up to maxRadius) until each split has enough rooms at hotels meeting
   * its PNRs' minimum stars; a given radius searches only that ring. Multi-room
   * splits are searched as whole orders (orderHotels) when the supplier supports it.
   */
  private async searchSplits(
    flight: CancelledFlightEntity,
    stay: { checkIn: string; checkOut: string },
    demand: Array<{ plan: RoomSplitPlan; minStars: number }>,
    residency: string | null,
    requestId: string,
    requestLogger: Logger,
    radius?: number,
  ): Promise<{
    hotels: AvailabilityHotel[];
    orderHotels: AvailabilityHotel[] | undefined;
  }> {
    const airport = {
      iataCode: flight.departureAirport.iataCode,
      latitude: Number(flight.departureAirport.latitude),
      longitude: Number(flight.departureAirport.longitude),
    };
    const multiRoomOrders = !!this.hotelProvider.searchMultiRoomOrders;

    // One list per room occupancy or multiroom combination: the highest minimum
    // stars among its PNRs, and the rooms (orders) their preferred splits need.
    type SearchList = {
      rooms: RoomOccupancy[];
      asOrder: boolean;
      minStars: number;
      needed: number;
    };
    const lists = new Map<string, SearchList>();
    const addList = (
      rooms: RoomOccupancy[],
      asOrder: boolean,
      minStars: number,
      needed: number,
    ) => {
      const key = asOrder
        ? `order:${combinationKey(rooms)}`
        : shapeKey(rooms[0]);
      const list = lists.get(key) ?? { rooms, asOrder, minStars, needed: 0 };
      list.minStars = Math.max(list.minStars, minStars);
      list.needed += needed;
      lists.set(key, list);
    };
    for (const { plan, minStars } of demand) {
      for (const split of [plan.preferred, ...plan.fallbacks]) {
        const needed = split === plan.preferred ? 1 : 0;
        if (multiRoomOrders && split.length > 1) {
          addList(split, true, minStars, needed);
        } else {
          for (const room of split) addList([room], false, minStars, needed);
        }
      }
    }

    const found = {
      hotels: new Map<string, AvailabilityHotel>(),
      orderHotels: new Map<string, AvailabilityHotel>(),
    };
    const keep = (
      into: Map<string, AvailabilityHotel>,
      hotels: AvailabilityHotel[],
      ring: number,
    ) => {
      for (const hotel of hotels) {
        const existing = into.get(hotel.hotelCode);
        if (!existing) {
          into.set(hotel.hotelCode, { ...hotel, radius: ring });
          continue;
        }
        const known = new Set(existing.rates.map((rate) => rate.rateKey));
        existing.rates.push(
          ...hotel.rates.filter((rate) => !known.has(rate.rateKey)),
        );
      }
    };
    // Rooms (orders for a combination) available at hotels meeting the list's minimum stars.
    const supply = (list: SearchList) => {
      let units = 0;
      const hotels = list.asOrder ? found.orderHotels : found.hotels;
      for (const hotel of hotels.values()) {
        if (hotel.stars < list.minStars) continue;
        const rates = list.asOrder
          ? orderRatesFor(hotel, list.rooms)
          : hotel.rates.filter(
              (rate) =>
                !rate.rooms && shapeKey(rate) === shapeKey(list.rooms[0]),
            );
        for (const rate of rates) {
          units += Math.floor((rate.allotment ?? 0) / list.rooms.length);
        }
      }
      return units;
    };
    const noHotels = (error: unknown): AvailabilityHotel[] => {
      if (error instanceof NotFoundException) return [];
      throw error;
    };

    const firstRing = radius ?? config.hotelSearch.defaultRadius;
    const lastRing =
      radius ?? Math.max(firstRing, config.hotelSearch.maxRadius);
    let short = [...lists.values()];
    for (
      let ring = firstRing;
      ring <= lastRing && short.length > 0;
      ring += 10
    ) {
      const occupancies = short
        .filter((l) => !l.asOrder)
        .map((l) => l.rooms[0]);
      const combinations = short.filter((l) => l.asOrder).map((l) => l.rooms);
      const [single, orders] = await Promise.all([
        occupancies.length
          ? this.hotelProvider
              .searchNearbyHotelsWithOccupancies(
                airport,
                stay.checkIn,
                stay.checkOut,
                occupancies,
                requestId,
                requestLogger,
                { residency, radius: ring },
              )
              .catch(noHotels)
          : [],
        combinations.length
          ? this.hotelProvider
              .searchMultiRoomOrders!(
                airport,
                stay.checkIn,
                stay.checkOut,
                combinations,
                requestId,
                requestLogger,
                { residency, radius: ring },
              )
              .catch(noHotels)
          : [],
      ]);
      keep(
        found.hotels,
        await this.hotelContentService.enrichSearchResults(
          single,
          requestId,
          requestLogger,
        ),
        ring,
      );
      keep(
        found.orderHotels,
        await this.hotelContentService.enrichSearchResults(
          orders,
          requestId,
          requestLogger,
        ),
        ring,
      );
      short = short.filter(
        (list) =>
          supply(list) <
          Math.max(
            1,
            supplyTarget(list.needed, config.hotelBooking.supplyBufferRatio),
          ),
      );
      if (short.length > 0 && ring + 10 <= lastRing) {
        requestLogger.info(
          "Widening hotel search: not enough rooms at hotels meeting the class minimum stars",
          {
            context: this.context,
            airportCode: airport.iataCode,
            radius: ring,
            shortLists: short.length,
          },
        );
      }
    }
    if (found.hotels.size + found.orderHotels.size === 0) {
      throw new NotFoundException(
        `No hotels found near airport ${airport.iataCode} for the requested occupancies`,
      );
    }
    return {
      hotels: [...found.hotels.values()],
      orderHotels: multiRoomOrders
        ? [...found.orderHotels.values()]
        : undefined,
    };
  }

  private async planPendingBookings(
    run: AllocationRunContext,
    pending: BookingEntity[],
    rows: HotelAllocationRecord[],
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
          requestLogger,
        );
        continue;
      }
      plans.push({ booking, plan: split.plan });
    }
    if (plans.length === 0) {
      return;
    }

    let hotels: AvailabilityHotel[];
    let orderHotels: AvailabilityHotel[] | undefined;
    try {
      ({ hotels, orderHotels } = await this.searchSplits(
        flight,
        stay,
        plans.map(({ booking, plan }) => ({
          plan,
          minStars: this.starRule(booking.travelClass).min,
        })),
        this.majorityResidency(plans.map(({ booking }) => booking)),
        requestId,
        requestLogger,
      ));
    } catch (error: any) {
      requestLogger.error("Hotel availability search failed", {
        context: this.context,
        flightId: flight.id,
        error: error.message,
      });
      throw new Error(`Hotel availability search failed: ${error.message}`);
    }

    const entries = plans.map(({ booking, plan }) => {
      const stars = this.starRule(booking.travelClass);
      const rooms = chooseRoomSplit(plan, hotels, orderHotels, stars.min);
      return {
        booking,
        stars,
        rooms,
        needs: toRoomNeeds(rooms),
        asOrder: !!orderHotels && rooms.length > 1,
      };
    });
    const demand = new Map<string, RoomNeed>();
    for (const { needs, asOrder } of entries) {
      if (asOrder) continue;
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
      config.hotelProvider.name,
      entries.map(({ booking, stars, rooms, needs, asOrder }) => ({
        bookingId: booking.id,
        roomPlan: needs.map((need) => ({
          adults: need.shape.adults,
          children: need.shape.children,
          roomsNeeded: need.roomsNeeded,
        })),
        candidates: asOrder
          ? buildOrderCandidatePlan(orderHotels!, rooms, stars)
          : buildCandidatePlan(hotels, needs, pools, stars),
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
      ...new Set(
        rows.map((row) => row.planId).filter((id): id is string => !!id),
      ),
    ];
    const candidates =
      await this.cancelledFlightsRepository.findCandidatesByPlans(
        flight.id,
        planIds,
      );

    const planning: BookingPlanningState = {
      ledger: this.buildPlanLedger(candidates, attempts),
      contentCache: new Map(),
      restrictedHotels: new Set(
        attempts
          .filter(
            (attempt) =>
              attempt.failureCode ===
              HotelBookingFailureCode.GROUP_BOOKING_RESTRICTED,
          )
          .map((attempt) => attempt.hotel?.providerHotelId ?? "")
          .filter(Boolean),
      ),
    };

    const entries = pending
      .map((booking) => ({ booking, row: rowByBooking.get(booking.id) }))
      .filter(
        (
          entry,
        ): entry is { booking: BookingEntity; row: HotelAllocationRecord } =>
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
          (a) =>
            a.bookingId === booking.id && a.candidate?.planId === row.planId,
        ),
      }))
      .sort(
        (a, b) =>
          (a.row.processingOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.row.processingOrder ?? Number.MAX_SAFE_INTEGER),
      );

    await this.reserveWalletFunds(run, entries);

    const ranks = [
      ...new Set(
        entries.map(
          (e) => e.row.classPriority ?? classRank(e.booking.travelClass),
        ),
      ),
    ].sort((a, b) => b - a);
    const concurrency = Math.max(1, config.hotelBooking.concurrencyPerClass);
    for (const rank of ranks) {
      const stage = entries.filter(
        (e) =>
          (e.row.classPriority ?? classRank(e.booking.travelClass)) === rank,
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

  /**
   * Locks the estimated cost of the PNRs about to be booked in the airline's
   * wallet: per PNR, its first candidate's price plus the platform fee.
   * Throws before anything is booked when the wallet cannot cover it.
   */
  private async reserveWalletFunds(
    run: AllocationRunContext,
    entries: Array<{ booking: BookingEntity; candidates: HotelCandidate[] }>,
  ): Promise<void> {
    const estimates = entries.flatMap(({ booking, candidates }) => {
      const first = [...candidates].sort(
        (a, b) => a.candidateOrder - b.candidateOrder,
      )[0];
      if (!first) return [];
      const price = Number(first.estimatedPrice);
      const pricing = this.calculatePricing(
        price,
        price,
        run.platformFeePercentage,
        0,
        0,
      );
      return [
        {
          bookingId: booking.id,
          pnr: booking.pnr,
          hotelName: first.hotelName,
          hotelCost: pricing.actualPrice,
          platformFee: pricing.platformFee,
          estimate: pricing.totalPrice,
        },
      ];
    });
    const withoutCandidate = entries
      .filter(({ candidates }) => candidates.length === 0)
      .map(({ booking }) => booking.id);
    const sum = (pick: (e: (typeof estimates)[number]) => number) =>
      this.roundCurrency(estimates.reduce((acc, e) => acc + pick(e), 0));
    run.requestLogger.info("Estimated wallet cost of PNRs to book", {
      context: this.context,
      flightId: run.flight.id,
      runId: run.runId,
      platformFeePercentage: run.platformFeePercentage,
      pnrs: estimates.length,
      hotelCost: sum((e) => e.hotelCost),
      platformFee: sum((e) => e.platformFee),
      totalEstimate: sum((e) => e.estimate),
      estimates,
      withoutCandidateBookingIds: withoutCandidate,
    });
    if (estimates.length === 0) return;
    await this.cancelledFlightsRepository.reserveWalletForRun(
      {
        cancelledFlightId: run.flight.id,
        runId: run.runId,
        items: estimates.map(({ bookingId, estimate }) => ({
          bookingId,
          amount: estimate,
        })),
      },
      run.requestLogger,
    );
  }

  private buildPlanLedger(
    candidates: HotelCandidate[],
    attempts: HotelBookingEntity[],
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
      for (const rateKey of rateKeysOf(attempt.rooms)) {
        if (snapshot.get(rateKey)?.planId === attempt.candidate?.planId) {
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
    candidates: HotelCandidate[],
    priorAttempts: HotelBookingEntity[],
  ): Promise<void> {
    const { requestLogger } = run;
    const definiteFailures = priorAttempts.filter(
      (a) =>
        a.status === HotelBookingAttemptStatus.FAILED &&
        a.failureCode !== HotelBookingFailureCode.INTERRUPTED_BEFORE_REQUEST,
    );
    const excludedRateKeys = new Set(
      definiteFailures.flatMap((a) => rateKeysOf(a.rooms)),
    );
    const maxAttempts =
      run.maxNewAttemptsPerPnr !== undefined
        ? definiteFailures.length + run.maxNewAttemptsPerPnr
        : Math.max(1, config.hotelBooking.maxAttemptsPerBooking);
    let failures = definiteFailures.length;
    let lastFailure: string | null =
      definiteFailures[definiteFailures.length - 1]?.failureReason ?? null;

    try {
      for (;;) {
        if (failures >= maxAttempts) {
          await this.cancelledFlightsRepository.markPnrFailed(
            booking.id,
            `Gave up after ${failures} failed booking attempt(s); last failure: ${lastFailure}`,
            requestLogger,
          );
          return;
        }

        let selected: {
          candidate: HotelCandidate;
          picks: SelectedRate[];
          claim: LedgerClaim;
        } | null = null;
        for (const candidate of candidates) {
          if (planning.restrictedHotels.has(candidate.hotelCode)) {
            continue;
          }
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
            requestLogger,
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
        if (outcome.error instanceof HotelGroupBookingRestrictedError) {
          planning.restrictedHotels.add(candidate.hotelCode);
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
    stay: StayDates;
    rooms: Array<{ rateKey: string; shape?: RoomOccupancy }>;
    hotel?: { hotelCode: string; hotelName: string; category: string };
    candidateId?: number | null;
    runId?: string | null;
    /** Everyone the booked rooms must hold. */
    party?: { adults: number; children: number };
    /** Called once the attempt is recorded, before any supplier call. */
    onAttemptStarted?: () => void;
    paymentData?: unknown;
    platformFeePercentage: number;
    requestId: string;
    requestLogger: Logger;
    contentCache?: Map<string, Promise<HotelContentDetails | null>>;
  }): Promise<BookingAttemptOutcome> {
    const { flight, booking, rooms, requestId, requestLogger } = input;

    let attemptId: number;
    try {
      const start = await this.cancelledFlightsRepository.startBookingAttempt(
        {
          cancelledFlightId: flight.id,
          bookingId: booking.id,
          candidateId: input.candidateId ?? null,
          runId: input.runId ?? null,
          rooms: rooms.map((room) => ({
            rateKey: room.rateKey,
            adults: room.shape?.adults ?? 0,
            children: room.shape?.children ?? 0,
          })),
          provider: config.hotelProvider.name,
          providerRequestId: randomUUID(),
          hotelCode: input.hotel?.hotelCode ?? null,
          hotelName: input.hotel?.hotelName ?? null,
          category: input.hotel?.category ?? null,
          checkInDate: input.stay.checkIn,
          checkOutDate: input.stay.checkOut,
          platformFeePercentage: input.platformFeePercentage,
        },
        requestLogger,
      );
      if (!start.started) {
        return { kind: "blocked", reason: start.reason };
      }
      attemptId = start.attempt.id;
      input.onAttemptStarted?.();
    } catch (error: any) {
      return {
        kind: "blocked",
        reason: `Could not record the booking attempt: ${error?.message ?? error}`,
      };
    }

    const orders: ProviderOrder[] = [];
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
          ...(orders.length ? { providerOrders: orders } : {}),
          responseReceived,
        },
        undefined,
        requestLogger,
      );
      return { kind: "rejected", reason, error };
    };

    // A multiroom rate books all of its rooms as one supplier order.
    const units: Array<{
      rateKey: string;
      check: HotelRateCheck;
      rooms: Array<{ adults: number; children: number }>;
    }> = [];
    for (let index = 0; index < rooms.length; ) {
      const room = rooms[index];
      let check: HotelRateCheck;
      try {
        check = await this.hotelProvider.checkRate(room.rateKey, requestId, {
          residency: booking.residency,
        });
      } catch (error: any) {
        return fail(
          HotelBookingFailureCode.RATE_CHECK_FAILED,
          `Rate check failed: ${error?.message ?? error}`,
          error,
        );
      }
      if (check.taxesAtProperty?.length) {
        const taxes = check.taxesAtProperty
          .map((tax) => `${tax.name} ${tax.amount} ${tax.currencyCode ?? ""}`)
          .join(", ");
        return fail(
          HotelBookingFailureCode.HOTEL_PAYABLE_TAXES,
          `Rate has taxes payable at the hotel (${taxes}); passengers must not pay the hotel`,
        );
      }
      const orderRooms = check.rooms ?? [
        { adults: check.adults, children: check.children },
      ];
      const covered = rooms.slice(index, index + orderRooms.length);
      if (
        covered.length !== orderRooms.length ||
        covered.some((entry) => entry.rateKey !== room.rateKey)
      ) {
        return fail(
          HotelBookingFailureCode.RATE_MISMATCH,
          `Rate re-check returned one order for ${orderRooms.length} room(s); the booking has ${covered.length} room(s) on that rate`,
        );
      }
      const shapes = covered.map((entry) => entry.shape);
      if (check.rooms) {
        if (
          shapes.every((shape): shape is RoomOccupancy => !!shape) &&
          combinationKey(shapes) !== combinationKey(check.rooms)
        ) {
          return fail(
            HotelBookingFailureCode.RATE_MISMATCH,
            `Rate re-check returned rooms for ${check.rooms.map((r) => `${r.adults}+${r.children}`).join(", ")}; the party needs ${shapes.map((s) => `${s!.adults}+${s!.children}`).join(", ")}`,
          );
        }
      } else if (
        room.shape &&
        (check.adults < room.shape.adults ||
          check.children < room.shape.children)
      ) {
        return fail(
          HotelBookingFailureCode.RATE_MISMATCH,
          `Rate re-check returned a room for ${check.adults} adult(s) + ${check.children} child(ren); the party needs ${room.shape.adults} + ${room.shape.children}`,
        );
      }
      units.push({
        rateKey: room.rateKey,
        check: {
          ...check,
          hotelName: check.hotelName || input.hotel?.hotelName || "",
          category: check.category || input.hotel?.category || "",
        },
        rooms: orderRooms,
      });
      index += orderRooms.length;
    }
    if (new Set(units.map((unit) => unit.check.hotelCode)).size > 1) {
      return fail(
        HotelBookingFailureCode.MIXED_HOTELS,
        "All rooms of one booking must be in the same hotel",
        new BadRequestException(
          "All rooms of one booking must be in the same hotel",
        ),
      );
    }
    if (input.party) {
      const booked = units.flatMap((unit) => unit.rooms);
      const adults = booked.reduce((sum, room) => sum + room.adults, 0);
      const children = booked.reduce((sum, room) => sum + room.children, 0);
      if (adults < input.party.adults || children < input.party.children) {
        const reason = `The selected rooms hold ${adults} adult(s) + ${children} child(ren); the party is ${input.party.adults} + ${input.party.children}`;
        return fail(
          HotelBookingFailureCode.RATE_MISMATCH,
          reason,
          new BadRequestException(reason),
        );
      }
    }
    const hotelCode = units[0].check.hotelCode;
    const hotelName =
      units[0].check.hotelName || input.hotel?.hotelName || hotelCode;

    // An order's taxes at the property are listed once, on its first room.
    let roomNo = 0;
    const plannedOrders = units.map((unit) => {
      const prices = this.splitAmount(
        Number(unit.check.netPrice),
        unit.rooms.length,
      );
      const buyingPrices = this.splitAmount(
        Number(unit.check.buyingPrice ?? unit.check.netPrice),
        unit.rooms.length,
      );
      return {
        ...unit,
        entries: unit.rooms.map((orderRoom, index) => ({
          room: ++roomNo,
          check: {
            ...unit.check,
            adults: orderRoom.adults,
            children: orderRoom.children,
            taxesAtProperty:
              index === 0 ? (unit.check.taxesAtProperty ?? []) : [],
          },
          price: prices[index],
          buyingPrice: buyingPrices[index],
        })),
      };
    });

    const sent = await this.cancelledFlightsRepository.markAttemptRequestSent(
      attemptId,
      booking.id,
      { hotelCode, hotelName, category: units[0].check.category },
    );
    if (!sent) {
      return {
        kind: "blocked",
        reason:
          "Booking attempt was settled elsewhere before the supplier request",
      };
    }

    const booked: Array<{
      check: HotelRateCheck;
      rateKey: string;
      price: number;
      buyingPrice: number;
      hotelName: string;
      address: string;
    }> = [];
    const results: HotelBookingResult[] = [];
    let current = plannedOrders[0];
    try {
      for (const unit of plannedOrders) {
        current = unit;
        requestLogger.info("Booking hotel room with supplier", {
          context: this.context,
          flightId: flight.id,
          bookingId: booking.id,
          attemptId,
          hotelCode,
          room: unit.entries.map((entry) => entry.room).join(","),
          rooms: rooms.length,
        });
        const result = await this.hotelProvider.bookHotel(
          {
            firstName: booking.firstName,
            lastName: booking.lastName,
            bookingId: booking.id,
            pnr: booking.pnr,
            contactEmail: flight.airline?.contactEmail,
            contactPhone: booking.phone?.trim() || flight.airline?.contactPhone,
            onSupplierOrderCreated: async (reference) => {
              const unitOrders: ProviderOrder[] = unit.entries.map(
                (entry) => ({
                  room: entry.room,
                  reference,
                  status: "pending",
                  rateKey: unit.rateKey,
                  roomName: entry.check.roomName,
                  boardName: entry.check.boardName,
                  adults: entry.check.adults,
                  children: entry.check.children,
                  price: entry.price,
                  buyingPrice: entry.buyingPrice,
                  taxesAtProperty: entry.check.taxesAtProperty ?? [],
                }),
              );
              const recorded =
                await this.cancelledFlightsRepository.recordProviderOrder(
                  attemptId,
                  unitOrders,
                );
              if (!recorded) {
                throw new Error(
                  "Booking attempt was settled elsewhere before the supplier request",
                );
              }
              orders.push(...unitOrders);
            },
          },
          unit.check.bookingKey ?? unit.rateKey,
          input.paymentData,
          requestId,
        );
        for (const order of orders) {
          if (unit.entries.some((entry) => entry.room === order.room)) {
            order.status = "booked";
            order.providerOrderId = result.supplierOrderId || null;
          }
        }
        const total = Number(
          unit.entries.length === 1
            ? (result.costPerRoom ?? result.price ?? unit.check.netPrice)
            : result.price,
        );
        const prices = this.splitAmount(total, unit.entries.length);
        const buyingPrices = this.splitAmount(
          Number(result.buyingPrice ?? total),
          unit.entries.length,
        );
        unit.entries.forEach((entry, index) =>
          booked.push({
            check: entry.check,
            rateKey: unit.rateKey,
            price: prices[index],
            buyingPrice: buyingPrices[index],
            hotelName: result.hotelName,
            address: result.hotelAddress,
          }),
        );
        results.push(result);
      }
    } catch (error: any) {
      const message = String(error?.message ?? error);
      const references = results.map((result) => result.bookingReference);
      const outcomeUnknown = error instanceof HotelBookingOutcomeUnknownError;
      if (!outcomeUnknown) {
        for (const order of orders) {
          if (current.entries.some((entry) => entry.room === order.room)) {
            order.status = "failed";
            order.failureReason = message;
          }
        }
      }

      if (!outcomeUnknown && booked.length === 0) {
        return fail(
          error instanceof HotelGroupBookingRestrictedError
            ? HotelBookingFailureCode.GROUP_BOOKING_RESTRICTED
            : HotelBookingFailureCode.SUPPLIER_REJECTED,
          `Booking at ${hotelName} failed: ${message}`,
          error,
          true,
        );
      }

      const unknownReference = outcomeUnknown
        ? ((error as HotelBookingOutcomeUnknownError).supplierReference ?? null)
        : null;
      const currentRooms = `room${current.entries.length > 1 ? "s" : ""} ${current.entries.map((entry) => entry.room).join(", ")}`;
      const reason =
        `Needs manual check with the supplier: ${booked.length} of ${rooms.length} room(s) booked at ${hotelName}` +
        (references.length ? ` (refs: ${references.join(", ")})` : "") +
        (outcomeUnknown
          ? `; ${currentRooms} outcome unknown${unknownReference ? ` (supplier ref ${unknownReference})` : ""}: ${message}`
          : `; ${currentRooms} failed: ${message}`) +
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
          providerOrders: orders,
          responseReceived: !outcomeUnknown,
        },
        undefined,
        requestLogger,
      );
      return { kind: "unknown", reason };
    }

    const references = results.map((result) => result.bookingReference);
    if (
      !results.every(
        (result) => result.status === HotelAllocationStatus.CONFIRMED,
      )
    ) {
      const reason = `Supplier accepted the booking at ${hotelName} without confirming it (refs: ${references.join(", ")}). Check with the supplier.`;
      await this.settleAttempt(
        attemptId,
        booking.id,
        {
          status: HotelBookingAttemptStatus.MANUAL_CHECK,
          failureCode: HotelBookingFailureCode.PROVIDER_UNCONFIRMED,
          failureReason: reason,
          providerOrders: orders,
          responseReceived: true,
        },
        undefined,
        requestLogger,
      );
      return { kind: "unknown", reason };
    }

    const content = withAirportDistance(
      await this.cachedHotelContent(
        hotelCode,
        input.contentCache,
        requestId,
        requestLogger,
      ),
      flight.departureAirport,
    );
    const row = this.buildAllocationRow(
      flight.id,
      booking,
      booked,
      input.platformFeePercentage,
      content,
    );

    try {
      const settled =
        await this.cancelledFlightsRepository.finishBookingAttempt(
          attemptId,
          booking.id,
          {
            status: HotelBookingAttemptStatus.SUCCESS,
            providerStatus: null,
            providerOrders: orders,
            responseReceived: true,
          },
          {
            ...row,
            bookingReference: references.join(","),
            reason: this.confirmedReason(
              booking,
              row.hotelName ?? hotelName,
              row.category ?? "",
            ),
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
          requestLogger.error(
            "Could not refresh flight totals after a confirmed booking",
            {
              context: this.context,
              flightId: flight.id,
              bookingId: booking.id,
              error: error?.message,
            },
          ),
        );
      this.scheduleOrderInfoRefresh(
        attemptId,
        references,
        requestId,
        requestLogger,
      );
      return {
        kind: "confirmed",
        allocation: settled.allocation,
        references,
        currency: units[0].check.currency,
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
          providerOrders: orders,
          responseReceived: true,
        },
        undefined,
        requestLogger,
      );
      return { kind: "unknown", reason };
    }
  }

  /**
   * Supplier booking status webhook. The payload is not signed, so the status is
   * always re-checked with the supplier before an open attempt is settled.
   */
  async handleSupplierBookingStatus(input: {
    provider: string;
    reference: string;
    reportedStatus: string;
    requestId: string;
    requestLogger: Logger;
  }): Promise<SupplierWebhookOutcome> {
    const { provider, reference, reportedStatus, requestId, requestLogger } =
      input;
    const meta = { context: this.context, provider, reference, reportedStatus };

    const attempt =
      await this.cancelledFlightsRepository.findAttemptBySupplierReference(
        provider,
        reference,
      );
    if (!attempt) {
      requestLogger.warn("Booking status webhook for an unknown order", meta);
      return "ignored";
    }
    const attemptMeta = {
      ...meta,
      attemptId: attempt.id,
      bookingId: attempt.bookingId,
      flightId: attempt.cancelledFlightId,
      attemptStatus: attempt.status,
    };

    if (
      attempt.status === HotelBookingAttemptStatus.SUCCESS ||
      attempt.status === HotelBookingAttemptStatus.FAILED
    ) {
      const knownStatus = toProviderOrders(attempt.rooms).find(
        (order) => order.reference === reference,
      )?.status;
      const contradicts =
        (reportedStatus === "completed" && knownStatus === "failed") ||
        (reportedStatus === "failed" && knownStatus === "booked");
      if (contradicts) {
        requestLogger.error(
          "Booking status webhook contradicts a settled attempt; check with the supplier",
          { ...attemptMeta, knownStatus },
        );
      } else {
        requestLogger.info(
          "Booking status webhook for a settled attempt",
          attemptMeta,
        );
      }
      return "ignored";
    }

    if (
      attempt.status === HotelBookingAttemptStatus.PENDING &&
      !(await this.cancelledFlightsRepository.isAttemptStale(
        attempt.id,
        config.hotelBooking.staleBookingAttemptMs,
      ))
    ) {
      requestLogger.info(
        "Booking status webhook arrived while the booking is still in progress; asking for a retry",
        attemptMeta,
      );
      return "retry";
    }

    if (!this.hotelProvider.checkBookingStatus) {
      requestLogger.error(
        "Cannot confirm booking status webhook: the configured hotel provider differs",
        { ...attemptMeta, configuredProvider: config.hotelProvider.name },
      );
      return "retry";
    }

    const confirmed = await this.hotelProvider.checkBookingStatus(
      reference,
      requestId,
    );
    requestLogger.info("Confirmed booking status with the supplier", {
      ...attemptMeta,
      confirmedState: confirmed.state,
      code: confirmed.code,
    });
    if (confirmed.state === "processing") {
      return "retry";
    }
    if ((confirmed.state === "booked") !== (reportedStatus === "completed")) {
      requestLogger.warn(
        "Supplier status differs from the webhook; using the supplier status",
        { ...attemptMeta, confirmedState: confirmed.state },
      );
    }

    const orders = toProviderOrders(attempt.rooms);
    const orderRooms = orders.filter((entry) => entry.reference === reference);
    if (orderRooms.length === 0) return "ignored";
    const failureReason =
      confirmed.state === "failed" ? (confirmed.code ?? "failed") : null;
    for (const order of orderRooms) {
      order.status = confirmed.state;
      order.failureReason = failureReason;
    }

    return this.settleAttemptFromSupplier(
      attempt,
      orders,
      failureReason,
      attemptMeta,
      requestId,
      requestLogger,
    );
  }

  /**
   * Settles an open attempt from its supplier orders: all booked confirms it,
   * none booked fails it, a mix stays MANUAL_CHECK as a partial booking.
   */
  private async settleAttemptFromSupplier(
    attempt: HotelBookingEntity,
    orders: ProviderOrder[],
    failureDetail: string | null | undefined,
    attemptMeta: Record<string, unknown>,
    requestId: string,
    requestLogger: Logger,
  ): Promise<SupplierWebhookOutcome> {
    const totalRooms = Math.max(attempt.rooms?.length ?? 0, orders.length);
    const booked = orders.filter((entry) => entry.status === "booked");
    const pending = orders.filter((entry) => entry.status === "pending");
    const hotelName =
      attempt.hotel?.name || attempt.hotel?.providerHotelId || "";

    if (pending.length > 0) {
      await this.cancelledFlightsRepository.updateOpenAttemptOrders(
        attempt.id,
        attempt.bookingId,
        orders,
        {},
      );
      return "processed";
    }

    if (booked.length > 0 && booked.length === totalRooms) {
      return this.confirmAttemptFromWebhook(
        attempt,
        orders,
        requestId,
        requestLogger,
      );
    }

    if (booked.length === 0) {
      const reason = `Booking at ${hotelName} failed: supplier reported ${failureDetail}`;
      const settled =
        await this.cancelledFlightsRepository.finishBookingAttempt(
          attempt.id,
          attempt.bookingId,
          {
            status: HotelBookingAttemptStatus.FAILED,
            failureCode: HotelBookingFailureCode.SUPPLIER_REJECTED,
            failureReason: reason,
            providerOrders: orders,
            responseReceived: true,
          },
          undefined,
          requestLogger,
        );
      if (settled.updated) {
        await this.cancelledFlightsRepository.markPnrFailed(
          attempt.bookingId,
          reason,
          requestLogger,
        );
        requestLogger.info(
          "Hotel booking failed per supplier status",
          attemptMeta,
        );
      }
      return "processed";
    }

    const failedRooms = orders
      .filter((entry) => entry.status === "failed")
      .map((entry) => `room ${entry.room} (${entry.failureReason})`);
    const reason =
      `Partially booked: ${booked.length} of ${totalRooms} room(s) booked at ${hotelName} ` +
      `(refs: ${[...new Set(booked.map((entry) => entry.reference))].join(", ")})` +
      (failedRooms.length ? `; failed: ${failedRooms.join(", ")}` : "") +
      ". Do not rebook until reconciled.";
    await this.cancelledFlightsRepository.updateOpenAttemptOrders(
      attempt.id,
      attempt.bookingId,
      orders,
      {
        failureCode: HotelBookingFailureCode.PARTIAL_BOOKING,
        failureReason: reason,
      },
    );
    requestLogger.warn("Hotel booking partially booked per supplier status", {
      ...attemptMeta,
      reason,
    });
    return "processed";
  }

  private async confirmAttemptFromWebhook(
    attempt: HotelBookingEntity,
    orders: ProviderOrder[],
    requestId: string,
    requestLogger: Logger,
  ): Promise<SupplierWebhookOutcome> {
    const booking = await this.cancelledFlightsRepository.findBookingById(
      attempt.bookingId,
      requestLogger,
    );
    if (!booking) {
      requestLogger.error(
        "Booking for a confirmed supplier order no longer exists",
        {
          context: this.context,
          attemptId: attempt.id,
          bookingId: attempt.bookingId,
        },
      );
      return "ignored";
    }
    const platformFeePercentage = Number(
      attempt.platformFeePercentage ?? config.platformFeePercentage,
    );
    const hotelCode = attempt.hotel?.providerHotelId ?? "";
    const sorted = [...orders].sort((a, b) => a.room - b.room);
    const rooms = sorted.map((order) => ({
      check: {
        hotelCode,
        hotelName: attempt.hotel?.name ?? "",
        category: starsLabel(attempt.hotel?.starRating),
        address: null,
        checkInDate: attempt.checkInDate ?? "",
        checkOutDate: attempt.checkOutDate ?? "",
        roomName: order.roomName,
        boardName: order.boardName,
        adults: order.adults,
        children: order.children,
        netPrice: order.price,
        buyingPrice: order.buyingPrice,
        currency: attempt.currency ?? config.currency,
        cancellationPolicies: [],
        rateComments: null,
        priceChanged: false,
        taxesAtProperty: order.taxesAtProperty,
      } satisfies HotelRateCheck,
      rateKey: order.rateKey,
      price: order.price,
      buyingPrice: order.buyingPrice,
    }));
    const content = await this.cachedHotelContent(
      hotelCode,
      undefined,
      requestId,
      requestLogger,
    );
    const row = this.buildAllocationRow(
      attempt.cancelledFlightId,
      booking,
      rooms,
      platformFeePercentage,
      content,
    );
    const references = [...new Set(sorted.map((order) => order.reference))];

    const settled = await this.cancelledFlightsRepository.finishBookingAttempt(
      attempt.id,
      booking.id,
      {
        status: HotelBookingAttemptStatus.SUCCESS,
        failureCode: null,
        failureReason: null,
        providerStatus: null,
        providerOrders: orders,
        responseReceived: true,
      },
      {
        ...row,
        bookingReference: references.join(","),
        reason: this.confirmedReason(
          booking,
          row.hotelName ?? "",
          row.category ?? "",
        ),
      },
      requestLogger,
    );
    if (!settled.updated) {
      return "ignored";
    }
    await this.cancelledFlightsRepository.refreshFlightTotals(
      attempt.cancelledFlightId,
      requestLogger,
    );
    const promoted =
      await this.cancelledFlightsRepository.promoteFlightAfterLateConfirmation(
        attempt.cancelledFlightId,
      );
    requestLogger.info("Hotel booking confirmed per supplier status", {
      context: this.context,
      attemptId: attempt.id,
      bookingId: booking.id,
      pnr: booking.pnr,
      flightId: attempt.cancelledFlightId,
      bookingReference: references.join(","),
      flightPromoted: promoted,
    });
    this.scheduleOrderInfoRefresh(
      attempt.id,
      references,
      requestId,
      requestLogger,
    );
    return "processed";
  }

  private scheduleOrderInfoRefresh(
    attemptId: number,
    references: string[],
    requestId: string,
    requestLogger: Logger,
  ): void {
    if (!this.hotelProvider.getOrderInfo) {
      return;
    }
    setTimeout(
      () =>
        void this.refreshOrderInfo(
          attemptId,
          references,
          requestId,
          requestLogger,
        ),
      config.hotelBooking.orderInfoDelayMs,
    ).unref();
  }

  private async refreshMissingOrderInfo(
    flightId: number,
    requestId: string,
    requestLogger: Logger,
  ): Promise<void> {
    if (!this.hotelProvider.getOrderInfo) {
      return;
    }
    const attempts =
      await this.cancelledFlightsRepository.findSuccessAttemptsMissingOrderInfo(
        flightId,
        config.hotelBooking.orderInfoDelayMs,
      );
    for (const attempt of attempts) {
      await this.refreshOrderInfo(
        attempt.id,
        bookingReferenceOf(attempt.rooms).split(",").filter(Boolean),
        requestId,
        requestLogger,
      );
    }
  }

  private async refreshOrderInfo(
    attemptId: number,
    references: string[],
    requestId: string,
    requestLogger: Logger,
  ): Promise<void> {
    try {
      const info = await this.hotelProvider.getOrderInfo?.(
        references,
        requestId,
      );
      if (!info) {
        return;
      }
      await this.cancelledFlightsRepository.saveAttemptOrderInfo(
        attemptId,
        info.status,
        info.orders,
      );
      requestLogger.info("Saved supplier order info for confirmed booking", {
        context: this.context,
        attemptId,
        providerStatus: info.status,
        orders: info.orders.length,
      });
    } catch (error: any) {
      requestLogger.warn("Could not refresh supplier order info", {
        context: this.context,
        attemptId,
        error: error?.message,
      });
    }
  }

  private async settleAttempt(
    attemptId: number,
    bookingId: number,
    changes: Parameters<CancelledFlightsRepository["finishBookingAttempt"]>[2],
    success: AllocationSuccess | undefined,
    requestLogger: Logger,
  ): Promise<void> {
    await this.cancelledFlightsRepository
      .finishBookingAttempt(
        attemptId,
        bookingId,
        changes,
        success,
        requestLogger,
      )
      .catch((error: any) =>
        requestLogger.error(
          "Could not record the hotel booking attempt outcome",
          {
            context: this.context,
            attemptId,
            bookingId,
            status: changes.status,
            error: error?.message,
          },
        ),
      );
  }

  private cachedHotelContent(
    hotelCode: string,
    cache: Map<string, Promise<HotelContentDetails | null>> | undefined,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelContentDetails | null> {
    const load = () =>
      this.hotelContentService
        .getHotelDetails(hotelCode, requestId, requestLogger)
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
    const { min } = this.starRule(booking.travelClass);
    return (
      `Booked ${hotelName}${category ? ` (${category})` : ""} for ${booking.travelClass} class` +
      ((parseInt(category, 10) || 0) < min
        ? `, below the ${min}-star minimum for this class`
        : "") +
      (specialNotes.length
        ? `; special request (${specialNotes.join(", ")}) recorded but not verifiable from hotel data - confirm with the hotel directly.`
        : ".")
    );
  }

  private toBookingStatus(
    row: HotelAllocationRecord | undefined,
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
    rows: HotelAllocationRecord[],
    attempts: HotelBookingEntity[],
    runState: { running: boolean; stale: boolean; error: string | null },
    platformFeePercentage: number,
    supplierCheck: { awaiting: boolean; nextCheckAt: Date | null },
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
            (rowByBooking.get(b.id)?.processingOrder ??
              Number.MAX_SAFE_INTEGER) || compareBookingPriority(a, b),
      )
      .map((booking) => {
        const row = rowByBooking.get(booking.id);
        const attemptCount = attemptsByBooking.get(booking.id) ?? 0;
        const bookingStatus = this.toBookingStatus(
          row,
          attemptCount,
          runState.running,
        );
        const success = bookingStatus === "SUCCESS";
        const showHotel =
          !!row?.hotelCode &&
          (success ||
            bookingStatus === "PENDING" ||
            bookingStatus === "MANUAL_CHECK");
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
                address: success ? (row!.address ?? null) : null,
                checkInDate: success ? row!.checkInDate : null,
                checkOutDate: success ? row!.checkOutDate : null,
                totalRooms: success ? (row!.totalRooms ?? 0) : 0,
                totalPrice: success ? Number(row!.totalPrice ?? 0) : 0,
                rooms: success
                  ? (row!.rooms ?? []).map(
                      ({ rateKey, buyingPrice, ...room }) => room,
                    )
                  : [],
              }
            : null,
          providerBookingReference: success
            ? row!.bookingReference || null
            : null,
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
      canRetry:
        Number(flight.hotelAllocationRuns ?? 0) <
        HotelAllocationService.MAX_USER_ALLOCATION_RUNS,
      awaitingSupplierCheck: supplierCheck.awaiting,
      nextSupplierCheckAt: supplierCheck.nextCheckAt?.toISOString() ?? null,
      results,
      totalRooms: Number(flight.totalHotelRooms ?? 0),
      totalActualPrice: Number(flight.totalActualPrice ?? 0),
      totalSellingPrice: Number(flight.totalSellingPrice ?? 0),
      totalDiscounts: Number(flight.totalDiscounts ?? 0),
      totalHotelTaxes: Number(flight.totalHotelTaxes ?? 0),
      platformFeePercentage,
      totalPlatformFee: Number(flight.totalPlatformFee ?? 0),
      totalPrice: Number(flight.totalPrice ?? 0),
      currency: config.currency,
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
    const flight =
      await this.cancelledFlightsRepository.findFlightWithRelations(
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
    const booking = await this.requireBookingForFlight(
      bookingId,
      flightId,
      requestLogger,
    );
    requestLogger.info("Checking rate with hotel supplier", {
      context: this.context,
      flightId,
      bookingId,
    });
    const { buyingPrice, bookingKey, ...check } =
      await this.hotelProvider.checkRate(rateKey, requestId, {
        residency: booking.residency,
      });
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
    // A PNR the allocation run could not place can be booked before the flight is fully allocated.
    const failedInRun =
      flight.status === FlightStatus.PASSENGERS_BOOKING_CONFIRMED &&
      current?.status === HotelAllocationStatus.FAILED;
    if (
      !HotelAllocationService.HOTEL_BOOKABLE_FLIGHT_STATUSES.has(
        flight.status,
      ) &&
      !failedInRun
    ) {
      throw new BadRequestException(
        `Flight '${flightId}' is not ready for hotel booking in status '${flight.status}'; allocate hotels first`,
      );
    }
    const rateKeys = this.resolveRateKeys(dto, booking.id, current);
    if (
      dto.rooms &&
      (dto.rooms.length !== rateKeys.length ||
        !this.validateSplit(booking.adults, booking.children, dto.rooms))
    ) {
      throw new BadRequestException(
        `rooms must give one room per rate key and hold exactly ${booking.adults} adult(s) and ${booking.children} child(ren)`,
      );
    }
    const shapes =
      dto.rooms ??
      (current?.roomPlan ?? []).flatMap((room) =>
        Array.from({ length: room.roomsNeeded }, () => ({
          adults: room.adults,
          children: room.children,
        })),
      );

    // Reply once the attempt is recorded (PNR IN_PROGRESS); the supplier booking continues in the background.
    let attemptStarted!: () => void;
    const started = new Promise<null>((resolve) => {
      attemptStarted = () => resolve(null);
    });
    const outcome = this.attemptHotelBooking({
      flight,
      booking,
      stay: this.resolveStayDates(flight, requestLogger),
      rooms: rateKeys.map((rateKey, index) => ({
        rateKey,
        shape: shapes.length === rateKeys.length ? shapes[index] : undefined,
      })),
      party: { adults: booking.adults, children: booking.children },
      paymentData: dto.paymentData,
      platformFeePercentage: this.feeForFlight(flight, user),
      requestId,
      requestLogger,
      onAttemptStarted: attemptStarted,
    });

    const early = await Promise.race([started, outcome]);
    if (early?.kind === "blocked") {
      throw new ConflictException(early.reason);
    }
    void outcome
      .then((result) =>
        this.finishManualBooking(
          result,
          flightId,
          booking.id,
          current?.status === HotelAllocationStatus.FAILED,
          requestId,
          requestLogger,
        ),
      )
      .catch((error: any) =>
        requestLogger.error("Background hotel booking failed", {
          context: this.context,
          flightId,
          bookingId: booking.id,
          error: error?.message,
          stack: error?.stack,
        }),
      );

    return {
      bookingId: booking.id,
      pnr: booking.pnr,
      status: HotelAllocationStatus.IN_PROGRESS,
    };
  }

  /** Follow-up once a background manual booking has an outcome. */
  private async finishManualBooking(
    outcome: BookingAttemptOutcome,
    flightId: number,
    bookingId: number,
    wasFailed: boolean,
    requestId: string,
    requestLogger: Logger,
  ): Promise<void> {
    requestLogger.info("Manual hotel booking finished", {
      context: this.context,
      flightId,
      bookingId,
      outcome: outcome.kind,
      ...(outcome.kind === "confirmed" ? {} : { reason: outcome.reason }),
    });
    if (outcome.kind === "confirmed") {
      await this.cancelledFlightsRepository.promoteFlightAfterLateConfirmation(
        flightId,
      );
    } else if (outcome.kind === "unknown") {
      this.schedulePostRunCheck(flightId, requestId, requestLogger);
    } else if (outcome.kind === "rejected" && wasFailed) {
      // Keep a PNR the allocation run failed as FAILED, so it can be tried again.
      await this.cancelledFlightsRepository.markPnrFailed(
        bookingId,
        outcome.reason,
        requestLogger,
      );
    }
  }

  private resolveRateKeys(
    dto: BookHotelRequestDto,
    bookingId: number,
    existing: HotelAllocationRecord | null,
  ): string[] {
    const allocatedRooms = existing?.rooms ?? [];
    const requested = dto.rateKeys?.length
      ? dto.rateKeys
      : dto.rateKey
        ? [dto.rateKey]
        : null;

    if (requested) {
      if (
        allocatedRooms.length > 0 &&
        requested.length !== allocatedRooms.length
      ) {
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
  ): AllocationSuccess {
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
      hotelName: content?.name || first.hotelName || first.check.hotelName,
      category: content?.starRating
        ? `${content.starRating} STARS`
        : first.check.category,
      address: first.address || first.check.address || content?.address || null,
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
            hotelPolicies: content?.policies ?? null,
          }
        : {}),
      rooms: rooms.map((room) => ({
        adults: room.check.adults,
        children: room.check.children,
        roomName: room.check.roomName,
        boardName: room.check.boardName,
        price: this.roundCurrency(room.price),
        buyingPrice: this.roundCurrency(room.buyingPrice),
        rateKey: room.rateKey,
        taxesAtProperty: room.check.taxesAtProperty ?? [],
      })),
      totalRooms: rooms.length,
      currency: first.check.currency || config.currency,
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
