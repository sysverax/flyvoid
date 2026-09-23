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

let mockUsers: User[] = [
  {
    id: 101,
    firstName: "Sarah",
    lastName: "Jenkins",
    email: "sarah.j@skyjet.com",
    role: "AIRLINE_STAFF",
    isActive: true,
    lastLoginAt: "2026-09-20T10:30:00.000Z",
    createdAt: "2026-01-15T08:00:00.000Z",
    updatedAt: "2026-09-20T10:30:00.000Z",
    accessControls: [
      { asset: "DASHBOARD", access: ["VIEW", "EDIT", "EXPORT"] },
      { asset: "CANCELLED_FLIGHTS", access: ["VIEW", "EDIT", "EXPORT"] },
    ],
  },
  {
    id: 102,
    firstName: "Michael",
    lastName: "Chang",
    email: "m.chang@skyjet.com",
    role: "AIRLINE_STAFF",
    isActive: true,
    lastLoginAt: "2026-09-21T14:15:00.000Z",
    createdAt: "2026-02-10T09:00:00.000Z",
    updatedAt: "2026-09-21T14:15:00.000Z",
    accessControls: [
      { asset: "DASHBOARD", access: ["VIEW"] },
      { asset: "BOOKINGS", access: ["VIEW", "EDIT"] },
    ],
  },
  {
    id: 103,
    firstName: "Elena",
    lastName: "Rostova",
    email: "elena.r@skyjet.com",
    role: "AIRLINE_STAFF",
    isActive: false,
    lastLoginAt: null,
    createdAt: "2026-03-01T11:20:00.000Z",
    updatedAt: "2026-08-12T16:40:00.000Z",
    accessControls: [],
  },
];

export const usersService = {
  async getUsers(page: number, limit: number, search?: string, isActive?: boolean): Promise<{ users: User[]; total: number }> {
    let filtered = [...mockUsers];

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.id.toString().includes(q) ||
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }

    if (isActive !== undefined) {
      filtered = filtered.filter((u) => u.isActive === isActive);
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const users = filtered.slice(startIndex, startIndex + limit);

    return { users, total };
  },

  async inviteUser(user: Omit<User, "id" | "role" | "lastLoginAt" | "createdAt" | "updatedAt">): Promise<{ user: User; message: string; temporaryPassword?: string }> {
    const nextId = mockUsers.length > 0 ? Math.max(...mockUsers.map((u) => u.id)) + 1 : 101;
    const newUser: User = {
      ...user,
      id: nextId,
      role: "AIRLINE_STAFF",
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockUsers.unshift(newUser);

    return {
      user: newUser,
      temporaryPassword: "TempPassword123!",
      message: "Airline user added successfully",
    };
  },

  async updateUser(
    id: number,
    user: Omit<User, "id" | "role" | "lastLoginAt" | "createdAt" | "updatedAt">
  ): Promise<{ user: User; message: string }> {
    const idx = mockUsers.findIndex((u) => u.id === id);
    if (idx === -1) {
      throw new Error("User not found.");
    }

    const updatedUser: User = {
      ...mockUsers[idx],
      ...user,
      updatedAt: new Date().toISOString(),
    };

    mockUsers[idx] = updatedUser;

    return {
      user: updatedUser,
      message: "Airline user updated successfully",
    };
  },

  async deleteUser(id: number): Promise<string> {
    mockUsers = mockUsers.filter((u) => u.id !== id);
    return "Airline user deleted successfully";
  },
};
