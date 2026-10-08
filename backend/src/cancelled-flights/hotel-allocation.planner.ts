import {
  AvailabilityHotel,
  AvailabilityRoomRate,
  RoomOccupancy,
} from "./hotel-providers/hotel-provider.interface";

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

export function chooseRoomSplit(
  plan: RoomSplitPlan,
  hotels: AvailabilityHotel[],
): RoomOccupancy[] {
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
  return ranked[0]?.rooms ?? plan.preferred;
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
  private readonly remaining = new Map<string, number>();
  private nextClaimId = 1;

  constructor(hotels: AvailabilityHotel[]) {
    for (const hotel of hotels) {
      for (const rate of hotel.rates) {
        if (rate.allotment !== null) {
          this.remaining.set(rate.rateKey, Math.max(0, rate.allotment));
        }
      }
    }
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

export interface CandidatePick {
  rate: AvailabilityRoomRate;
  shape: RoomOccupancy;
  roomsNeeded: number;
}

export interface BookingCandidate {
  hotel: AvailabilityHotel;
  picks: CandidatePick[];
  tier: "pool" | "overflow";
  totalPrice: number;
}

export function rankCandidates(
  hotels: AvailabilityHotel[],
  needs: RoomNeed[],
  ledger: AllotmentLedger,
  pools: Map<string, ShapePool>,
  excludedRateKeys: ReadonlySet<string> = new Set(),
): BookingCandidate[] {
  const candidates: BookingCandidate[] = [];
  for (const hotel of hotels) {
    const used = new Map<string, number>();
    const picks: CandidatePick[] = [];
    let inPool = true;
    for (const need of needs) {
      const pool = pools.get(shapeKey(need.shape));
      const rate = hotel.rates
        .filter(
          (r) =>
            r.allotment !== null &&
            !excludedRateKeys.has(r.rateKey) &&
            isCoveringFit(r, need.shape) &&
            ledger.available(r.rateKey) - (used.get(r.rateKey) ?? 0) >=
              need.roomsNeeded,
        )
        .sort(
          (a, b) =>
            Number(pool?.rateKeys.has(b.rateKey) ?? false) -
              Number(pool?.rateKeys.has(a.rateKey) ?? false) ||
            Number(isExactFit(b, need.shape)) - Number(isExactFit(a, need.shape)) ||
            oversize(a, need.shape) - oversize(b, need.shape) ||
            a.netPrice - b.netPrice ||
            a.rateKey.localeCompare(b.rateKey),
        )[0];
      if (!rate) {
        picks.length = 0;
        break;
      }
      used.set(rate.rateKey, (used.get(rate.rateKey) ?? 0) + need.roomsNeeded);
      if (!pool?.rateKeys.has(rate.rateKey)) {
        inPool = false;
      }
      picks.push({ rate, shape: need.shape, roomsNeeded: need.roomsNeeded });
    }
    if (picks.length !== needs.length || picks.length === 0) {
      continue;
    }
    candidates.push({
      hotel,
      picks,
      tier: inPool ? "pool" : "overflow",
      totalPrice: picks.reduce(
        (sum, pick) => sum + pick.rate.netPrice * pick.roomsNeeded,
        0,
      ),
    });
  }
  return candidates.sort(
    (a, b) =>
      Number(a.tier === "overflow") - Number(b.tier === "overflow") ||
      b.hotel.stars - a.hotel.stars ||
      a.totalPrice - b.totalPrice ||
      a.hotel.hotelCode.localeCompare(b.hotel.hotelCode),
  );
}
