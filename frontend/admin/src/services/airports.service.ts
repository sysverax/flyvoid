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
  type: "INTERNATIONAL" | "DOMESTIC" | "UTC";
  address: string | null;
  postalCode: string;
}

export interface CreateAirportRequest {
  name: string;
  iataCode: string;
  icaoCode: string;
  countryCode: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isActive: boolean;
  type: "INTERNATIONAL" | "DOMESTIC" | "UTC";
  address?: string;
  postalCode: string;
}

export interface UpdateAirportRequest {
  name?: string;
  iataCode?: string;
  icaoCode?: string;
  countryCode?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isActive?: boolean;
  type?: "INTERNATIONAL" | "DOMESTIC" | "UTC";
  address?: string;
  postalCode?: string;
}

export interface UpdateAirlineAirportsRequest {
  assignAirportIds: number[];
  disableAirportIds: number[];
}

export interface UpdateAirlineAirportsResponse {
  airlineId: number;
  assignedAirportIds: number[];
  disabledAirportIds: number[];
  activeAirportIds: number[];
  totalActiveAirports: number;
}

export const airportsService = {
  async getAirports(params: {
    search?: string;
    countryCode?: string;
    status?: boolean;
    page: number;
    limit: number;
  }): Promise<{ airports: AirportDTO[]; total: number; currentPage: number; totalPages: number; limit: number }> {
    try {
      const { data } = await apiClient.get("/airports", { params });
      return {
        airports: data.data.airports || [],
        total: data.data.total || 0,
        currentPage: data.data.currentPage || 1,
        totalPages: data.data.totalPages || 0,
        limit: data.data.limit || params.limit,
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch airports."));
    }
  },

  async createAirport(payload: CreateAirportRequest): Promise<any> {
    try {
      const { data } = await apiClient.post("/airports", payload);
      return data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to create airport."));
    }
  },

  async updateAirport(
    airportId: number,
    payload: UpdateAirportRequest
  ): Promise<any> {
    try {
      const { data } = await apiClient.patch(`/airports/${airportId}`, payload);
      return data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to update airport."));
    }
  },

  async updateAirlineAirports(
    airlineId: number,
    payload: UpdateAirlineAirportsRequest
  ): Promise<any> {
    try {
      const { data } = await apiClient.patch(
        `/airports/airlines/${airlineId}/assignments`,
        payload
      );
      return data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to update airline airport assignments.")
      );
    }
  },
};
