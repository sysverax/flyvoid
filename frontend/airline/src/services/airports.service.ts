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
  address?: string | null;
  postalCode?: string | null;
}

export const airportsService = {
  async getAirports(params?: {
    countryCode?: string;
    status?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    shorten?: boolean;
  }): Promise<AirportDTO[]> {
    try {
      const response = await apiClient.get(`/airports`, {
        params: {
          countryCode: params?.countryCode,
          status: params?.status,
          page: params?.page || 1,
          limit: params?.limit || 100,
          search: params?.search,
        },
      });
      const airports: AirportDTO[] = response.data?.data?.airports || [];
      return airports.length > 0 ? airports : [];
    } catch (error: any) {
      console.warn(
        "Could not fetch airline airports from API (using fallback list):",
        error?.response?.status || error?.message,
      );
      return [];
    }
  },

  // async getAirports(params?: {
  //   search?: string;
  //   page?: number;
  //   limit?: number;
  // }): Promise<AirportDTO[]> {
  //   let airlineId = 1;
  //   if (typeof window !== "undefined") {
  //     const userStr = sessionStorage.getItem("airline_current_user");
  //     if (userStr) {
  //       try {
  //         const u = JSON.parse(userStr);
  //         if (u.airlineId) airlineId = Number(u.airlineId);
  //       } catch (e) {}
  //     }
  //   }
  //   return this.getAirportsForAirline(airlineId, params);
  // },
};
