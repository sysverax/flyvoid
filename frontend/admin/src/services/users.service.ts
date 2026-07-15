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
  async getUsers(page: number, limit: number): Promise<{ users: User[]; total: number }> {
    try {
      const { data } = await apiClient.get("/admin/users", { params: { page, limit } });
      const { users, total } = data.data;

      const items = users.map((u: any) => {
        let accessControls = u.accessControls || [];
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(`user_access_controls_${u.id}`);
          if (stored) {
            try {
              accessControls = JSON.parse(stored);
            } catch {}
          }
        }
        return { ...u, accessControls };
      });

      return { users: items, total };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch admin users."));
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

      if (typeof window !== "undefined") {
        localStorage.setItem(`user_access_controls_${admin.id}`, JSON.stringify(user.accessControls));
      }

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

      if (typeof window !== "undefined") {
        localStorage.setItem(`user_access_controls_${updated.id}`, JSON.stringify(user.accessControls));
      }

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
      if (typeof window !== "undefined") {
        localStorage.removeItem(`user_access_controls_${id}`);
      }
      return data.message || "Admin user deleted successfully";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to delete admin user."));
    }
  },
};
