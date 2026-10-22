import { apiClient, extractErrorMessage } from "../lib/api-client";

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
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

      const { data } = await apiClient.get("/admin/users", { params });
      const { users, total } = data.data;

      const items = users.map((u: any) => ({
        ...u,
        accessControls: u.accessControls || [],
      }));

      return { users: items, total };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch admin users."));
    }
  },

  async getUserById(id: number): Promise<User> {
    try {
      const { data } = await apiClient.get(`/admin/users/${id}`);
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch admin user details."));
    }
  },

  async inviteUser(user: Omit<User, "id" | "role" | "lastLoginAt" | "createdAt" | "updatedAt">): Promise<{ user: User; message: string; temporaryPassword?: string }> {
    try {
      const { data } = await apiClient.post("/admin/users", {
        ...user,
        email: user.email.toLowerCase().trim(),
        role: "STAFF",
      });

      const { admin, temporaryPassword } = data.data;

      return {
        user: { ...admin, accessControls: user.accessControls },
        temporaryPassword,
        message: data.message || "Admin user invited successfully",
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to invite admin user."));
    }
  },

  async updateUser(
    id: number,
    user: Omit<User, "id" | "role" | "lastLoginAt" | "createdAt" | "updatedAt">
  ): Promise<{ user: User; message: string }> {
    try {
      const { data } = await apiClient.patch(`/admin/users/${id}`, {
        ...user,
        email: user.email.toLowerCase().trim(),
        role: "STAFF",
      });

      const updated = data.data;

      return {
        user: { ...updated, accessControls: user.accessControls },
        message: data.message || "Admin user updated successfully",
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to update admin user."));
    }
  },

  async deleteUser(id: number): Promise<string> {
    try {
      const { data } = await apiClient.delete(`/admin/users/${id}`);
      return data.message || "Admin user deleted successfully";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to delete admin user."));
    }
  },
};
