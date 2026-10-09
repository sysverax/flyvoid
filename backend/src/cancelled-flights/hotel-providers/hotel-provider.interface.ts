import { Logger } from "winston";
import { HotelAllocationStatus } from "../entities/enums";

export interface HotelCandidate {
  id: string;
  name: string;
  address: string;
  stars: number;
  amenities: string[];
  pricePerNight: number;
  description: string;
  rateKey?: string | null;
}

export interface RoomOccupancy {
  adults: number;
  children: number;
  childrenAges?: number[];
}

export interface AvailabilityRoomRate {
  hotelCode: string;
  hotelName: string;
  category: string;
  roomCode: string | null;
  roomName: string;
  boardCode: string | null;
  boardName: string;
  rateKey: string;
  rateType: string | null;
  netPrice: number;
  /** What the supplier actually charges us, when it differs from netPrice. */
  buyingPrice?: number;
  currency: string;
  allotment: number | null;
  adults: number;
  children: number;
  childrenAges: number[];
  cancellationPolicies: Array<{ amount: number; from: string }>;
  rateComments: string | null;
  paymentType: string | null;
}

export interface AvailabilityHotel {
  hotelCode: string;
  hotelName: string;
  category: string;
  address: string;
  stars: number;
  rates: AvailabilityRoomRate[];
}

export interface TaxAtProperty {
  name: string;
  amount: number;
  currencyCode: string | null;
}

export interface HotelPolicies {
  checkInTime: string | null;
  checkOutTime: string | null;
  extraInfo: string | null;
  items: Array<{ category: string; details: string[] }>;
  raw?: Record<string, unknown> | null;
}

export interface HotelContentDetails {
  policies?: HotelPolicies | null;
  name?: string | null;
  starRating?: number | null;
  address: string | null;
  contact: {
    phones: Array<{ phoneNumber: string; phoneType: string }>;
    email: string | null;
  };
  latitude: number | null;
  longitude: number | null;
  distanceFromAirportKm: number | null;
  imageUrl: string | null;
  website: string | null;
  amenities: string[];
}

export interface HotelBookingRequest {
  firstName: string;
  lastName: string;
  bookingId: number;
  pnr: string;
  /** Booking contact (the airline's); suppliers that don't need it ignore it. */
  contactEmail?: string;
  contactPhone?: string;
}

/** Supplier-neutral result of re-validating a rate before booking. */
export interface HotelRateCheck {
  hotelCode: string;
  hotelName: string;
  category: string;
  address: string | null;
  checkInDate: string;
  checkOutDate: string;
  roomName: string;
  boardName: string;
  adults: number;
  children: number;
  netPrice: number;
  /** What the supplier actually charges us, when it differs from netPrice. */
  buyingPrice?: number;
  currency: string;
  cancellationPolicies: Array<{ amount: number; from: string }>;
  rateComments: string | null;
  /** True when the supplier re-priced the rate since search. */
  priceChanged: boolean;
  /** Key to pass to bookHotel instead of the search rate key (carries the validated rate). */
  bookingKey?: string;
  /** Taxes not included in the price; collected by the hotel from the guest. */
  taxesAtProperty?: TaxAtProperty[];
}

export interface HotelBookingResult {
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
}

/**
 * Thrown by a provider when a booking request may or may not have created a
 * reservation (lost response, timeout while the supplier is still working).
 * Callers must not retry blindly; check with the supplier first.
 */
export class HotelBookingOutcomeUnknownError extends Error {
  constructor(
    message: string,
    /** The reference to look the booking up by at the supplier, if any. */
    readonly supplierReference?: string,
  ) {
    super(message);
    this.name = "HotelBookingOutcomeUnknownError";
  }
}

/** DI token for the active hotel supplier adapter (see hotel-providers/<supplier>/). */
export const HOTEL_PROVIDER = Symbol("HOTEL_PROVIDER");

// Contract every hotel supplier adapter implements — HotelAllocationService depends only on this.
export interface HotelProvider {
  searchNearbyHotelsWithOccupancies(
    airport: { iataCode: string; latitude: number; longitude: number },
    checkInDate: string,
    checkOutDate: string,
    occupancies: RoomOccupancy[],
    requestId: string,
    requestLogger: Logger,
  ): Promise<AvailabilityHotel[]>;

  searchNearbyHotels(
    airport: { iataCode: string; latitude: number; longitude: number },
    checkInDate: string,
    checkOutDate: string,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelCandidate[]>;

  getHotelContentDetails(
    hotelCode: string,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelContentDetails | null>;

  /** Re-validates a rate (availability, price, cancellation) before booking. */
  checkRate(rateKey: string, requestId: string): Promise<HotelRateCheck>;

  /** Live reservation of a checked rate for one passenger booking. */
  bookHotel(
    bookingData: HotelBookingRequest,
    rateKey: string,
    paymentData: any,
    requestId: string,
  ): Promise<HotelBookingResult>;

  /** Latest supplier order details for confirmed bookings (by our booking references). */
  getOrderInfo?(
    bookingReferences: string[],
    requestId: string,
  ): Promise<{ status: string | null; orders: unknown[] } | null>;
}
