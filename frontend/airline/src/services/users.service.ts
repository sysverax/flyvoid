import { apiClient, extractErrorMessage } from "../lib/api-client";

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  accessControls: Array<{ asset: string; access: string[] }>;
}

export const usersService = {
  async getUsers(page: number, limit: number, search?: string, isActive?: boolean): Promise<{ users: User[]; total: number }> {
    try {
      const params: any = { page, limit };
      if (search) params.search = search;
      if (isActive !== undefined) params.isActive = isActive;

      const { data } = await apiClient.get("/airline/users", { params });
      const { users = [], total = 0 } = data.data || {};

      const items = users.map((u: any) => ({
        ...u,
        accessControls: u.accessControls || [],
      }));

      return { users: items, total };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch airline users."));
    }
  },

  async getUserById(id: number): Promise<User> {
    try {
      const { data } = await apiClient.get(`/airline/users/${id}`);
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch airline user details."));
    }
  },

  async inviteUser(user: Omit<User, "id" | "role" | "lastLoginAt" | "createdAt" | "updatedAt">): Promise<{ user: User; message: string; temporaryPassword?: string }> {
    try {
      const { data } = await apiClient.post("/airline/users", {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email.toLowerCase().trim(),
        jobTitle: user.jobTitle || "Airline Staff",
        isActive: user.isActive,
        accessControls: user.accessControls || [],
      });

      const invitedUser = data.data?.user || data.data || {};
      const temporaryPassword = data.data?.temporaryPassword;

      return {
        user: { ...invitedUser, accessControls: user.accessControls },
        temporaryPassword,
        message: data.message || "Airline user invited successfully",
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to invite airline user."));
    }
  },

  async updateUser(
    id: number,
    user: Omit<User, "id" | "role" | "lastLoginAt" | "createdAt" | "updatedAt">
  ): Promise<{ user: User; message: string }> {
    try {
      const { data } = await apiClient.patch(`/airline/users/${id}`, {
        firstName: user.firstName,
        lastName: user.lastName,
        jobTitle: user.jobTitle || "Airline Staff",
        isActive: user.isActive,
        accessControls: user.accessControls || [],
      });

      const updated = data.data || {};

      return {
        user: { ...updated, accessControls: user.accessControls },
        message: data.message || "Airline user updated successfully",
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to update airline user."));
    }
  },

  async deleteUser(id: number): Promise<string> {
    try {
      const { data } = await apiClient.delete(`/airline/users/${id}`);
      return data.message || "Airline user deleted successfully";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to delete airline user."));
    }
  },
};
