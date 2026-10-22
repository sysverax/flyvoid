import {
  AvailabilityHotel,
  AvailabilityRoomRate,
  RoomOccupancy,
} from "./hotel-providers/hotel-provider.interface";
import {
  CandidateRateOption,
  CandidateRoomPlan,
} from "./entities/hotel-allocation-option.entity";
import { HotelBookingAttemptStatus } from "./entities/enums";

export const CLASS_RANK: Record<string, number> = {
  first_class: 3,
  business: 2,
  premium_economy: 1,
  economy: 0,
};

export const classRank = (travelClass: string): number =>
  CLASS_RANK[travelClass] ?? 0;

export interface RoomNeed {
  shape: RoomOccupancy;
  roomsNeeded: number;
}

export interface RoomSplitPlan {
  preferred: RoomOccupancy[];
  fallbacks: RoomOccupancy[][];
}

export interface PrioritizedBooking {
  id: number;
  pnr: string;
  travelClass: string;
  children: number;
  specialNotes?: string[] | null;
}

export const shapeKey = (occupancy: {
  adults: number;
  children: number;
}): string => `${occupancy.adults}_${occupancy.children}`;

/** Order-insensitive key of a room combination ("2_0+2_0+1_0"). */
export const combinationKey = (rooms: RoomOccupancy[]): string =>
  rooms.map(shapeKey).sort().join("+");

/** Order rates of a hotel that book exactly these rooms and have allotment for all of them. */
export const orderRatesFor = (
  hotel: Pick<AvailabilityHotel, "rates">,
  rooms: RoomOccupancy[],
) =>
  hotel.rates.filter(
    (rate) =>
      !!rate.rooms &&
      combinationKey(rate.rooms) === combinationKey(rooms) &&
      rate.allotment !== null &&
      rate.allotment >= rooms.length,
  );

const isExactFit = (rate: AvailabilityRoomRate, shape: RoomOccupancy) =>
  rate.adults === shape.adults && rate.children === shape.children;

const isCoveringFit = (rate: AvailabilityRoomRate, shape: RoomOccupancy) =>
  rate.adults >= shape.adults && rate.children >= shape.children;

const oversize = (rate: AvailabilityRoomRate, shape: RoomOccupancy) =>
  rate.adults + rate.children - (shape.adults + shape.children);

const hasAllotment = (rate: AvailabilityRoomRate) =>
  rate.allotment !== null && rate.allotment > 0;

export function compareBookingPriority(
  a: PrioritizedBooking,
  b: PrioritizedBooking,
): number {
  return (
    classRank(b.travelClass) - classRank(a.travelClass) ||
    Number((b.specialNotes?.length ?? 0) > 0) -
      Number((a.specialNotes?.length ?? 0) > 0) ||
    Number(b.children > 0) - Number(a.children > 0) ||
    a.pnr.localeCompare(b.pnr) ||
    a.id - b.id
  );
}

export function toRoomNeeds(rooms: RoomOccupancy[]): RoomNeed[] {
  const needs = new Map<string, RoomNeed>();
  for (const room of rooms) {
    const key = shapeKey(room);
    const need = needs.get(key);
    if (need) {
      need.roomsNeeded += 1;
    } else {
      needs.set(key, {
        shape: { adults: room.adults, children: room.children },
        roomsNeeded: 1,
      });
    }
  }
  return [...needs.values()];
}

/** Minimum stars a travel class accepts, and the stars it prefers. */
export interface StarRule {
  min: number;
  preferred: number;
}

/** Hotels meeting the class minimum first, then the nearest search ring, then the preferred stars. */
const byQuality = (stars: StarRule, hotels: AvailabilityHotel[]) => {
  const radiusOf = new Map(hotels.map((h) => [h.hotelCode, h.radius ?? 0]));
  return (
    a: { hotelCode: string; stars: number },
    b: { hotelCode: string; stars: number },
  ): number =>
    Number(b.stars >= stars.min) - Number(a.stars >= stars.min) ||
    radiusOf.get(a.hotelCode)! - radiusOf.get(b.hotelCode)! ||
    Number(b.stars >= stars.preferred) - Number(a.stars >= stars.preferred);
};

/** Picks the split to book, preferring splits that hotels with at least minStars can cover. */
export function chooseRoomSplit(
  plan: RoomSplitPlan,
  hotels: AvailabilityHotel[],
  orderHotels?: AvailabilityHotel[],
  minStars = 0,
): RoomOccupancy[] {
  const qualified = (list: AvailabilityHotel[]) =>
    list.filter((hotel) => hotel.stars >= minStars);
  return (
    rankRoomSplits(
      plan,
      qualified(hotels),
      orderHotels && qualified(orderHotels),
    ) ??
    rankRoomSplits(plan, hotels, orderHotels) ??
    plan.preferred
  );
}

function rankRoomSplits(
  plan: RoomSplitPlan,
  hotels: AvailabilityHotel[],
  orderHotels?: AvailabilityHotel[],
): RoomOccupancy[] | undefined {
  const hotelsByShape = new Map<string, Set<string>>();
  const cheapestByShape = new Map<string, number>();
  for (const hotel of hotels) {
    for (const rate of hotel.rates) {
      if (!hasAllotment(rate)) {
        continue;
      }
      const key = shapeKey(rate);
      if (!hotelsByShape.has(key)) {
        hotelsByShape.set(key, new Set());
      }
      hotelsByShape.get(key)!.add(hotel.hotelCode);
      cheapestByShape.set(
        key,
        Math.min(cheapestByShape.get(key) ?? Number.POSITIVE_INFINITY, rate.netPrice),
      );
    }
  }

  const ranked = [plan.preferred, ...plan.fallbacks]
    .map((rooms) => {
      const needs = toRoomNeeds(rooms);
      if (orderHotels && rooms.length > 1) {
        const prices = orderHotels.flatMap((hotel) =>
          orderRatesFor(hotel, rooms).map((rate) => rate.netPrice),
        );
        return {
          rooms,
          coverable: prices.length > 0,
          oneHotel: prices.length > 0,
          estimatedPrice: prices.length
            ? Math.min(...prices)
            : Number.POSITIVE_INFINITY,
          distinctShapes: needs.length,
          roomCount: rooms.length,
        };
      }
      const perShape = needs.map(
        (need) => hotelsByShape.get(shapeKey(need.shape)) ?? new Set<string>(),
      );
      const coverable = perShape.every((set) => set.size > 0);
      const shared = coverable
        ? perShape.reduce((a, b) => new Set([...a].filter((h) => b.has(h))))
        : new Set<string>();
      const estimatedPrice = coverable
        ? rooms.reduce(
            (sum, room) => sum + (cheapestByShape.get(shapeKey(room)) ?? 0),
            0,
          )
        : Number.POSITIVE_INFINITY;
      return {
        rooms,
        coverable,
        oneHotel: shared.size > 0,
        estimatedPrice,
        distinctShapes: needs.length,
        roomCount: rooms.length,
      };
    })
    .filter((candidate) => candidate.coverable)
    .sort(
      (a, b) =>
        Number(b.oneHotel) - Number(a.oneHotel) ||
        a.estimatedPrice - b.estimatedPrice ||
        a.distinctShapes - b.distinctShapes ||
        a.roomCount - b.roomCount,
    );
  return ranked[0]?.rooms;
}

export const supplyTarget = (demand: number, bufferRatio: number): number =>
  Math.ceil(demand * bufferRatio);

export interface ShapePool {
  shapeKey: string;
  shape: RoomOccupancy;
  demand: number;
  target: number;
  poolAllotment: number;
  totalAllotment: number;
  rateKeys: Set<string>;
  hotelCodes: Set<string>;
}

export function buildSupplyPools(
  hotels: AvailabilityHotel[],
  demand: Map<string, RoomNeed>,
  bufferRatio: number,
): Map<string, ShapePool> {
  const pools = new Map<string, ShapePool>();
  for (const [key, { shape, roomsNeeded }] of demand) {
    const usable: Array<{
      hotel: AvailabilityHotel;
      rate: AvailabilityRoomRate;
      exact: boolean;
    }> = [];
    for (const hotel of hotels) {
      for (const rate of hotel.rates) {
        if (hasAllotment(rate) && isCoveringFit(rate, shape)) {
          usable.push({ hotel, rate, exact: isExactFit(rate, shape) });
        }
      }
    }
    usable.sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        b.hotel.stars - a.hotel.stars ||
        oversize(a.rate, shape) - oversize(b.rate, shape) ||
        a.rate.netPrice - b.rate.netPrice ||
        a.rate.rateKey.localeCompare(b.rate.rateKey),
    );

    const target = supplyTarget(roomsNeeded, bufferRatio);
    const pool: ShapePool = {
      shapeKey: key,
      shape,
      demand: roomsNeeded,
      target,
      poolAllotment: 0,
      totalAllotment: usable.reduce((sum, u) => sum + (u.rate.allotment ?? 0), 0),
      rateKeys: new Set(),
      hotelCodes: new Set(),
    };
    for (const { hotel, rate } of usable) {
      if (pool.poolAllotment >= target) {
        break;
      }
      pool.rateKeys.add(rate.rateKey);
      pool.hotelCodes.add(hotel.hotelCode);
      pool.poolAllotment += rate.allotment ?? 0;
    }
    pools.set(key, pool);
  }
  return pools;
}

export interface LedgerClaim {
  readonly id: number;
  readonly items: ReadonlyArray<{ rateKey: string; rooms: number }>;
  state: "held" | "committed" | "released";
}

export class AllotmentLedger {
  private readonly remaining: Map<string, number>;
  private nextClaimId = 1;

  constructor(remaining: Map<string, number>) {
    this.remaining = new Map(
      [...remaining].map(([rateKey, rooms]) => [rateKey, Math.max(0, rooms)]),
    );
  }

  static fromHotels(hotels: AvailabilityHotel[]): AllotmentLedger {
    const remaining = new Map<string, number>();
    for (const hotel of hotels) {
      for (const rate of hotel.rates) {
        if (rate.allotment !== null) {
          remaining.set(rate.rateKey, rate.allotment);
        }
      }
    }
    return new AllotmentLedger(remaining);
  }

  available(rateKey: string): number {
    return this.remaining.get(rateKey) ?? 0;
  }

  tryClaim(items: Array<{ rateKey: string; rooms: number }>): LedgerClaim | null {
    const totals = new Map<string, number>();
    for (const { rateKey, rooms } of items) {
      totals.set(rateKey, (totals.get(rateKey) ?? 0) + rooms);
    }
    for (const [rateKey, rooms] of totals) {
      if (this.available(rateKey) < rooms) {
        return null;
      }
    }
    for (const [rateKey, rooms] of totals) {
      this.remaining.set(rateKey, this.available(rateKey) - rooms);
    }
    return {
      id: this.nextClaimId++,
      items: [...totals].map(([rateKey, rooms]) => ({ rateKey, rooms })),
      state: "held",
    };
  }

  release(claim: LedgerClaim): void {
    if (claim.state !== "held") {
      return;
    }
    for (const { rateKey, rooms } of claim.items) {
      if (this.remaining.has(rateKey)) {
        this.remaining.set(rateKey, this.available(rateKey) + rooms);
      }
    }
    claim.state = "released";
  }

  commit(claim: LedgerClaim): void {
    if (claim.state === "held") {
      claim.state = "committed";
    }
  }
}

export interface PlannedCandidate {
  hotelCode: string;
  hotelName: string;
  category: string;
  stars: number;
  tier: "pool" | "overflow";
  estimatedPrice: number;
  currency: string | null;
  rooms: CandidateRoomPlan[];
}

export interface SelectedRate {
  rateKey: string;
  roomsNeeded: number;
  shape: RoomOccupancy;
  netPrice: number;
  inPool: boolean;
}

export function selectCandidateRates(
  candidate: { rooms: CandidateRoomPlan[] },
  ledger: AllotmentLedger,
  excludedRateKeys: ReadonlySet<string> = new Set(),
): SelectedRate[] | null {
  if (candidate.rooms[0]?.rateOptions.some((o) => o.orderRooms)) {
    return selectOrderRate(candidate, ledger, excludedRateKeys);
  }
  const used = new Map<string, number>();
  const picks: SelectedRate[] = [];
  for (const room of candidate.rooms) {
    const option = room.rateOptions.find(
      (o) =>
        !excludedRateKeys.has(o.rateKey) &&
        ledger.available(o.rateKey) - (used.get(o.rateKey) ?? 0) >=
          room.roomsNeeded,
    );
    if (!option) {
      return null;
    }
    used.set(option.rateKey, (used.get(option.rateKey) ?? 0) + room.roomsNeeded);
    picks.push({
      rateKey: option.rateKey,
      roomsNeeded: room.roomsNeeded,
      shape: { adults: room.adults, children: room.children },
      netPrice: option.netPrice,
      inPool: option.inPool,
    });
  }
  return picks.length > 0 ? picks : null;
}

/** One multiroom order rate for every room plan of the candidate, with allotment for all its rooms. */
function selectOrderRate(
  candidate: { rooms: CandidateRoomPlan[] },
  ledger: AllotmentLedger,
  excludedRateKeys: ReadonlySet<string>,
): SelectedRate[] | null {
  const totalRooms = candidate.rooms.reduce(
    (sum, room) => sum + room.roomsNeeded,
    0,
  );
  const option = candidate.rooms[0].rateOptions.find(
    (o) =>
      o.orderRooms === totalRooms &&
      !excludedRateKeys.has(o.rateKey) &&
      ledger.available(o.rateKey) >= totalRooms &&
      candidate.rooms.every((room) =>
        room.rateOptions.some((other) => other.rateKey === o.rateKey),
      ),
  );
  if (!option) {
    return null;
  }
  return candidate.rooms.map((room) => ({
    rateKey: option.rateKey,
    roomsNeeded: room.roomsNeeded,
    shape: { adults: room.adults, children: room.children },
    netPrice: option.netPrice,
    inPool: option.inPool,
  }));
}

/** Candidates for a PNR booked as one multiroom order; estimatedPrice is the order total. */
export function buildOrderCandidatePlan(
  orderHotels: AvailabilityHotel[],
  rooms: RoomOccupancy[],
  stars: StarRule,
): PlannedCandidate[] {
  const needs = toRoomNeeds(rooms);
  const candidates: PlannedCandidate[] = [];
  for (const hotel of orderHotels) {
    const rates = orderRatesFor(hotel, rooms).sort(
      (a, b) => a.netPrice - b.netPrice || a.rateKey.localeCompare(b.rateKey),
    );
    if (rates.length === 0) {
      continue;
    }
    const rateOptions: CandidateRateOption[] = rates.map((r) => ({
      rateKey: r.rateKey,
      adults: r.adults,
      children: r.children,
      netPrice: r.netPrice,
      allotment: r.allotment ?? 0,
      inPool: true,
      orderRooms: rooms.length,
    }));
    candidates.push({
      hotelCode: hotel.hotelCode,
      hotelName: hotel.hotelName,
      category: hotel.category,
      stars: hotel.stars,
      tier: "pool",
      estimatedPrice: rates[0].netPrice,
      currency: rates[0].currency,
      rooms: needs.map((need) => ({
        adults: need.shape.adults,
        children: need.shape.children,
        roomsNeeded: need.roomsNeeded,
        rateOptions,
      })),
    });
  }
  const quality = byQuality(stars, orderHotels);
  return candidates.sort(
    (a, b) =>
      quality(a, b) ||
      b.stars - a.stars ||
      a.estimatedPrice - b.estimatedPrice ||
      a.hotelCode.localeCompare(b.hotelCode),
  );
}

export function buildCandidatePlan(
  hotels: AvailabilityHotel[],
  needs: RoomNeed[],
  pools: Map<string, ShapePool>,
  stars: StarRule,
): PlannedCandidate[] {
  const candidates: PlannedCandidate[] = [];
  for (const hotel of hotels) {
    const rooms: CandidateRoomPlan[] = needs.map((need) => {
      const pool = pools.get(shapeKey(need.shape));
      const rateOptions: CandidateRateOption[] = hotel.rates
        .filter((r) => hasAllotment(r) && isCoveringFit(r, need.shape))
        .sort(
          (a, b) =>
            Number(pool?.rateKeys.has(b.rateKey) ?? false) -
              Number(pool?.rateKeys.has(a.rateKey) ?? false) ||
            Number(isExactFit(b, need.shape)) - Number(isExactFit(a, need.shape)) ||
            oversize(a, need.shape) - oversize(b, need.shape) ||
            a.netPrice - b.netPrice ||
            a.rateKey.localeCompare(b.rateKey),
        )
        .map((r) => ({
          rateKey: r.rateKey,
          adults: r.adults,
          children: r.children,
          netPrice: r.netPrice,
          allotment: r.allotment ?? 0,
          inPool: pool?.rateKeys.has(r.rateKey) ?? false,
        }));
      return {
        adults: need.shape.adults,
        children: need.shape.children,
        roomsNeeded: need.roomsNeeded,
        rateOptions,
      };
    });
    const snapshot = new AllotmentLedger(
      new Map(
        rooms.flatMap((room) =>
          room.rateOptions.map((o) => [o.rateKey, o.allotment] as const),
        ),
      ),
    );
    const picks = selectCandidateRates({ rooms }, snapshot);
    if (!picks) {
      continue;
    }
    candidates.push({
      hotelCode: hotel.hotelCode,
      hotelName: hotel.hotelName,
      category: hotel.category,
      stars: hotel.stars,
      tier: picks.every((pick) => pick.inPool) ? "pool" : "overflow",
      estimatedPrice: picks.reduce(
        (sum, pick) => sum + pick.netPrice * pick.roomsNeeded,
        0,
      ),
      currency:
        hotel.rates.find((r) => r.rateKey === picks[0].rateKey)?.currency ?? null,
      rooms,
    });
  }
  const quality = byQuality(stars, hotels);
  return candidates.sort(
    (a, b) =>
      quality(a, b) ||
      Number(a.tier === "overflow") - Number(b.tier === "overflow") ||
      b.stars - a.stars ||
      a.estimatedPrice - b.estimatedPrice ||
      a.hotelCode.localeCompare(b.hotelCode),
  );
}

export function resolveEffectiveAttempt<
  T extends { status: HotelBookingAttemptStatus; attemptOrder: number },
>(attempts: T[]): T | null {
  const latest = (status: HotelBookingAttemptStatus) =>
    attempts
      .filter((attempt) => attempt.status === status)
      .sort((a, b) => b.attemptOrder - a.attemptOrder)[0] ?? null;
  return (
    latest(HotelBookingAttemptStatus.SUCCESS) ??
    latest(HotelBookingAttemptStatus.MANUAL_CHECK) ??
    latest(HotelBookingAttemptStatus.PENDING)
  );
}
