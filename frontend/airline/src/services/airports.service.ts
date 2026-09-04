import { apiClient, extractErrorMessage } from "../lib/api-client";

export interface AirportDTO {
  id: number;
  name: string;
  iataCode: string;
  icaoCode: string;
  countryCode: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isActive: boolean;
  type: string;
  isAssigned?: boolean;
  address?: string | null;
  postalCode?: string | null;
}

export const FALLBACK_AIRPORTS: AirportDTO[] = [
  { id: 1, name: "Los Angeles International", iataCode: "LAX", icaoCode: "KLAX", countryCode: "US", city: "Los Angeles", latitude: 33.9416, longitude: -118.4085, timezone: "GMT-8", isActive: true, type: "INTERNATIONAL", isAssigned: true },
  { id: 2, name: "John F. Kennedy International", iataCode: "JFK", icaoCode: "KJFK", countryCode: "US", city: "New York", latitude: 40.6413, longitude: -73.7781, timezone: "GMT-5", isActive: true, type: "INTERNATIONAL", isAssigned: true },
  { id: 3, name: "London Heathrow", iataCode: "LHR", icaoCode: "EGLL", countryCode: "GB", city: "London", latitude: 51.4700, longitude: -0.4543, timezone: "GMT+0", isActive: true, type: "INTERNATIONAL", isAssigned: true },
  { id: 4, name: "Tokyo Haneda", iataCode: "HND", icaoCode: "RJTT", countryCode: "JP", city: "Tokyo", latitude: 35.5494, longitude: 139.7798, timezone: "GMT+9", isActive: true, type: "INTERNATIONAL", isAssigned: true },
  { id: 5, name: "Charles de Gaulle", iataCode: "CDG", icaoCode: "LFPG", countryCode: "FR", city: "Paris", latitude: 49.0097, longitude: 2.5479, timezone: "GMT+1", isActive: true, type: "INTERNATIONAL", isAssigned: true },
  { id: 6, name: "Changi Airport", iataCode: "SIN", icaoCode: "WSSS", countryCode: "SG", city: "Singapore", latitude: 1.3644, longitude: 103.9915, timezone: "GMT+8", isActive: true, type: "INTERNATIONAL", isAssigned: true },
  { id: 7, name: "Frankfurt Airport", iataCode: "FRA", icaoCode: "EDDF", countryCode: "DE", city: "Frankfurt", latitude: 50.0379, longitude: 8.5622, timezone: "GMT+1", isActive: true, type: "INTERNATIONAL", isAssigned: true },
];

export const airportsService = {
  async getAirportsForAirline(
    airlineId: number,
    params?: {
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<AirportDTO[]> {
    try {
      const response = await apiClient.get(
        `/airports/airlines/${airlineId}/airports`,
        {
          params: {
            page: params?.page || 1,
            limit: params?.limit || 100,
            search: params?.search,
          },
        }
      );
      const airports: AirportDTO[] = response.data?.data?.airports || [];
      const assigned = airports.filter((a) => a.isAssigned !== false);
      return assigned.length > 0 ? assigned : (airports.length > 0 ? airports : FALLBACK_AIRPORTS);
    } catch (error: any) {
      console.warn("Could not fetch airline airports from API (using fallback list):", error?.response?.status || error?.message);
      return FALLBACK_AIRPORTS;
    }
  },

  async getAirports(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<AirportDTO[]> {
    let airlineId = 1;
    if (typeof window !== "undefined") {
      const userStr = sessionStorage.getItem("airline_current_user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.airlineId) airlineId = Number(u.airlineId);
        } catch (e) {}
      }
    }
    return this.getAirportsForAirline(airlineId, params);
  },
};
