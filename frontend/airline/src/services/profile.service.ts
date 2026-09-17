import { apiClient, extractErrorMessage } from "@/src/lib/api-client";

export interface AirlineUserProfile {
  id: number;
  airlineId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface UpdateAirlineUserProfilePayload {
  firstName?: string;
  lastName?: string;
}

export interface AirlineOrgProfile {
  id: number;
  name: string;
  code: string;
  countryCode?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export const profileService = {
  async getUserProfile(): Promise<AirlineUserProfile> {
    try {
      const response = await apiClient.get("/airline/users/profile");
      return response.data?.data || response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch user profile"));
    }
  },

  async updateUserProfile(
    payload: UpdateAirlineUserProfilePayload
  ): Promise<AirlineUserProfile> {
    try {
      const response = await apiClient.patch("/airline/users/profile", payload);
      return response.data?.data || response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to update profile"));
    }
  },

  async getAirlineProfile(): Promise<AirlineOrgProfile> {
    try {
      const response = await apiClient.get("/airline/profile");
      return response.data?.data || response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch airline organization profile"));
    }
  },
};
