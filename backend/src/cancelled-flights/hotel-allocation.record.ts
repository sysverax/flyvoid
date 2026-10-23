import { BookingEntity } from "./entities/booking.entity";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import {
  HotelAllocationStatus,
  HotelBookingAttemptStatus,
  HotelBookingPaymentStatus,
} from "./entities/enums";
import { HotelBookingEntity } from "./entities/hotel-booking.entity";
import { HotelContact } from "./entities/hotel.entity";
import {
  HotelBookingRoomEntity,
  HotelBookingRoomStatus,
} from "./entities/hotel-booking-room.entity";
import type {
  HotelPolicies,
  TaxAtProperty,
} from "./hotel-providers/hotel-provider.interface";

const NOT_BOOKED_STATUSES = [
  HotelAllocationStatus.DRAFT,
  HotelAllocationStatus.FAILED,
];

/**
 * SQL condition for a PNR's live (non-failed) hotel booking, for PNRs that
 * have a hotel. Expects the aliases `hotelBooking` and `booking`.
 */
export const LIVE_HOTEL_BOOKING_CONDITION = `hotelBooking.status <> '${HotelBookingAttemptStatus.FAILED}' AND booking.allocation_status NOT IN (${NOT_BOOKED_STATUSES.map((status) => `'${status}'`).join(", ")})`;

export interface HotelAllocationRoom {
  adults: number;
  children: number;
  roomName: string;
  boardName: string;
  price: number;
  buyingPrice?: number;
  rateKey?: string;
  taxesAtProperty?: TaxAtProperty[];
}

/**
 * A PNR's hotel allocation as one flat record: the PNR's allocation state plus
 * the hotel booking it shows (its confirmed booking, or the one in progress),
 * that booking's hotel and rooms. `id` is the hotel booking id (0 when none).
 */
export interface HotelAllocationRecord {
  id: number;
  cancelledFlightId: number;
  bookingId: number;
  status: HotelAllocationStatus;
  reason: string | null;
  bookingReference: string;
  processingOrder: number | null;
  classPriority: number | null;
  planId: string | null;
  plannedAt: Date | null;
  roomPlan: BookingEntity["roomPlan"];
  checkInDate: string;
  checkOutDate: string;
  hotelCode: string;
  hotelName: string;
  category: string;
  address: string | null;
  contact: HotelContact | null;
  latitude: number | null;
  longitude: number | null;
  distanceFromAirportKm: number | null;
  imageUrl: string | null;
  website: string | null;
  amenities: string[] | null;
  hotelPolicies: HotelPolicies | null;
  rooms: HotelAllocationRoom[];
  totalRooms: number;
  currency: string | null;
  actualPrice: number;
  buyingPrice: number;
  sellingPrice: number;
  tax: number;
  discount: number;
  platformFeePercentage: number;
  platformFee: number;
  totalPrice: number;
  earnings: number;
  paymentStatus: HotelBookingPaymentStatus;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  booking: BookingEntity;
  cancelledFlight?: CancelledFlightEntity;
}

/** An allocation record loaded together with its cancelled flight. */
export type HotelBookingRecord = HotelAllocationRecord & {
  cancelledFlight: CancelledFlightEntity;
};

/** The fields a confirmed booking writes (hotel profile, stay, rooms, money). */
export type AllocationSuccess = Partial<
  Omit<
    HotelAllocationRecord,
    "id" | "booking" | "cancelledFlight" | "createdAt" | "updatedAt"
  >
>;

/** A room's supplier order while it is being booked; rooms of a multiroom order share its reference. */
export interface ProviderOrder {
  room: number;
  reference: string;
  status: HotelBookingRoomStatus;
  rateKey: string;
  roomName: string;
  boardName: string;
  adults: number;
  children: number;
  price: number;
  buyingPrice: number;
  taxesAtProperty: TaxAtProperty[];
  providerOrderId?: string | null;
  failureReason?: string | null;
}

const byRoomNo = (rooms: HotelBookingRoomEntity[] | undefined) =>
  [...(rooms ?? [])].sort((a, b) => a.roomNo - b.roomNo);

/** A booking's rate keys, in room order. */
export function rateKeysOf(rooms: HotelBookingRoomEntity[] | undefined): string[] {
  return byRoomNo(rooms)
    .map((room) => room.rateKey ?? "")
    .filter(Boolean);
}

/** A booking's distinct supplier order references, comma-separated in room order. */
export function bookingReferenceOf(
  rooms: HotelBookingRoomEntity[] | undefined,
): string {
  return [
    ...new Set(
      byRoomNo(rooms)
        .map((room) => room.partnerOrderId ?? "")
        .filter(Boolean),
    ),
  ].join(",");
}

export function toProviderOrders(
  rooms: HotelBookingRoomEntity[] | undefined,
): ProviderOrder[] {
  return byRoomNo(rooms)
    .filter((room) => room.partnerOrderId)
    .map((room) => ({
      room: room.roomNo,
      reference: room.partnerOrderId ?? "",
      status: room.status,
      rateKey: room.rateKey ?? "",
      roomName: room.roomName,
      boardName: room.boardName,
      adults: room.adults,
      children: room.children,
      price: Number(room.price),
      buyingPrice: Number(room.buyingPrice),
      taxesAtProperty: room.taxesAtProperty ?? [],
      providerOrderId: room.providerOrderId ?? null,
      failureReason: room.failureReason ?? null,
    }));
}

/** Display category for a star rating ("4 STARS"); "Unrated" when unknown. */
export const starsLabel = (stars: number | null | undefined): string =>
  stars && stars > 0 ? `${stars} STARS` : "Unrated";

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Builds a PNR's allocation record; `hotelBooking` needs its hotel, rooms and candidate loaded. */
export function toAllocationRecord(
  pnr: BookingEntity,
  hotelBooking?: HotelBookingEntity | null,
): HotelAllocationRecord {
  const hb = hotelBooking ?? null;
  const hotel = hb?.hotel ?? null;
  const rooms = [...(hb?.rooms ?? [])]
    .filter((room) => room.status !== "failed")
    .sort((a, b) => a.roomNo - b.roomNo)
    .map((room) => ({
      adults: room.adults,
      children: room.children,
      roomName: room.roomName,
      boardName: room.boardName,
      price: num(room.price),
      buyingPrice: num(room.buyingPrice),
      rateKey: room.rateKey ?? undefined,
      taxesAtProperty: room.taxesAtProperty ?? [],
    }));
  const actualPrice = num(hb?.actualPrice);
  return {
    id: hb?.id ?? 0,
    cancelledFlightId: pnr.cancelledFlightId,
    bookingId: pnr.id,
    status: pnr.allocationStatus ?? HotelAllocationStatus.DRAFT,
    reason: pnr.allocationReason ?? null,
    bookingReference: bookingReferenceOf(hb?.rooms),
    processingOrder: pnr.processingOrder ?? null,
    classPriority: pnr.classPriority ?? null,
    planId: pnr.planId ?? null,
    plannedAt: pnr.plannedAt ?? null,
    roomPlan: pnr.roomPlan ?? null,
    checkInDate: hb?.checkInDate ?? "",
    checkOutDate: hb?.checkOutDate ?? "",
    hotelCode: hotel?.providerHotelId ?? "",
    hotelName: hotel?.name ?? "",
    category: hotel ? starsLabel(hotel.starRating) : "",
    address: hotel?.address ?? null,
    contact: hotel?.contact ?? null,
    latitude: hotel?.latitude ?? null,
    longitude: hotel?.longitude ?? null,
    distanceFromAirportKm:
      hb?.candidate?.distanceFromAirportKm != null
        ? num(hb.candidate.distanceFromAirportKm)
        : null,
    imageUrl: hotel?.imageUrl ?? null,
    website: hotel?.website ?? null,
    amenities: hotel?.amenities ?? null,
    hotelPolicies: hotel?.policies ?? null,
    rooms,
    totalRooms: rooms.length,
    currency: hb?.currency ?? null,
    actualPrice,
    buyingPrice: num(hb?.buyingPrice),
    sellingPrice: actualPrice,
    tax: 0,
    discount: 0,
    platformFeePercentage: num(hb?.platformFeePercentage),
    platformFee: num(hb?.platformFee),
    totalPrice: num(hb?.totalPrice),
    earnings: num(hb?.earnings),
    paymentStatus: hb?.paymentStatus ?? HotelBookingPaymentStatus.PENDING,
    paidAt: hb?.paidAt ?? null,
    createdAt: hb?.createdAt ?? pnr.createdAt,
    updatedAt: hb?.updatedAt ?? pnr.updatedAt,
    booking: pnr,
    cancelledFlight: hb?.cancelledFlight ?? pnr.cancelledFlight,
  };
}
