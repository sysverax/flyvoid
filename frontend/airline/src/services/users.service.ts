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

      const items = users.map((u: any) => {
        let accessControls = u.accessControls || [];
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(`airline_user_access_controls_${u.id}`);
          if (stored) {
            try {
              accessControls = JSON.parse(stored);
            } catch { }
          }
        }
        return { ...u, accessControls };
      });

      return { users: items, total };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch airline users."));
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

      if (typeof window !== "undefined" && invitedUser?.id) {
        localStorage.setItem(`airline_user_access_controls_${invitedUser.id}`, JSON.stringify(user.accessControls));
      }

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

      if (typeof window !== "undefined" && updated?.id) {
        localStorage.setItem(`airline_user_access_controls_${updated.id}`, JSON.stringify(user.accessControls));
      }

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
      if (typeof window !== "undefined") {
        localStorage.removeItem(`airline_user_access_controls_${id}`);
      }
      return data.message || "Airline user deleted successfully";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to delete airline user."));
    }
  },
};
