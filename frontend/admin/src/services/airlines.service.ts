import { apiClient, extractErrorMessage } from "../lib/api-client";

export interface AirlineUserDTO {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  isActive: boolean;
}

export interface AirlineDTO {
  id: number;
  name: string;
  code: string;
  countryCode: string;
  companyRegistrationNumber: string;
  website?: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  logo?: string;
  currency: string;
  address: string;
  isActive: boolean;
  isSuspended: boolean;
  adminUser: AirlineUserDTO;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAirlineRequest {
  name: string;
  code: string;
  countryCode: string;
  companyRegistrationNumber: string;
  website?: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  logo?: string;
  currency: string;
  address: string;
  isActive: boolean;
  isSuspended: boolean;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminJobTitle: string;
}

export const airlinesService = {
  async getAirlines(params: {
    search?: string;
    isActive?: boolean;
    isSuspended?: boolean;
    page: number;
    limit: number;
  }): Promise<{ airlines: AirlineDTO[]; total: number }> {
    try {
      const { data } = await apiClient.get("/airline", { params });
      return {
        airlines: data.data.airlines || [],
        total: data.data.total || 0,
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch airlines."));
    }
  },

  async getAirlineDetail(airlineId: number): Promise<AirlineDTO> {
    try {
      const { data } = await apiClient.get(`/airline/${airlineId}`);
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch airline details."));
    }
  },

  async updateAirline(
    airlineId: number,
    payload: Partial<UpdateAirlineRequest>
  ): Promise<any> {
    try {
      const { data } = await apiClient.patch(`/airline/${airlineId}`, payload);
      return data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to update airline."));
    }
  },
};
