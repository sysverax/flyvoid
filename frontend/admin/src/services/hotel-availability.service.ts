import { apiClient, extractErrorMessage } from "../lib/api-client";

export interface HotelAvailabilityRoom {
  adults: number;
  /** One age (0–17) per child. */
  childrenAges: number[];
}

export interface HotelAvailabilityTax {
  name: string;
  amount: number;
  currency: string | null;
}

export interface HotelAvailabilityOption {
  roomType: string;
  mealPlan: string;
  maxGuests: number | null;
  /** Supplier price per night, all rooms. */
  pricePerNight: number;
  /** Supplier price for the whole stay, all rooms. */
  totalPrice: number;
  currency: string;
  taxesIncluded: HotelAvailabilityTax[];
  /** Not in the price; the guest pays these at the hotel. */
  taxesAtProperty: HotelAvailabilityTax[];
  cancellation: { freeUntil: string | null; penaltyAmount: number | null };
  roomsAvailable: number | null;
  features: string[];
}

export interface HotelAvailabilityHotel {
  /** RateHawk HID; null for other suppliers. */
  hid: number | null;
  hotelCode: string;
  name: string;
  stars: number;
  address: string | null;
  distanceKm: number | null;
  currency: string;
  lowestPricePerNight: number;
  lowestTotalPrice: number;
  freeCancellationUntil: string | null;
  options: HotelAvailabilityOption[];
}

export interface HotelAvailabilityResult {
  provider: { id: number; code: string; name: string };
  airport: { id: number; code: string; name: string };
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  rooms: HotelAvailabilityRoom[];
  radius: number;
  radiusUnit: string;
  residency: string;
  searchedAt: string;
  hotels: HotelAvailabilityHotel[];
}

export interface HotelAvailabilitySearch {
  providerId: number;
  airportId: number;
  /** YYYY-MM-DD at the hotel. */
  checkInDate: string;
  checkOutDate: string;
  rooms: HotelAvailabilityRoom[];
  /** km, 1–70. */
  radius: number;
  /** ISO 3166-1 alpha-2. */
  residency: string;
}

export const hotelAvailabilityService = {
  /** GET /hotel-availability: one live supplier search. */
  async search(params: HotelAvailabilitySearch): Promise<HotelAvailabilityResult> {
    try {
      const { data } = await apiClient.get("/hotel-availability", {
        params: { ...params, rooms: JSON.stringify(params.rooms) },
        // Supplier searches can take a while.
        timeout: 120_000,
      });
      return data.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, "Failed to search hotel availability."));
    }
  },
};
