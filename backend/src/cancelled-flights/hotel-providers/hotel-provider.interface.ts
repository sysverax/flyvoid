import { Logger } from "winston";

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

export interface HotelContentDetails {
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
  ): Promise<HotelCandidate[]>;

  getHotelContentDetails(
    hotelCode: string,
    requestId: string,
    requestLogger: Logger,
  ): Promise<HotelContentDetails | null>;
}
