"use client";

export interface User {
  email: string;
  accessControl: Record<string, string[]>;
}

export const NAVIGATION_ITEMS = [
  { title: "Dashboard", path: "/", key: "dashboard" },
  { title: "Airlines", path: "/airlines", key: "airlines" },
  { title: "Cancellation", path: "/cancellation", key: "cancelledFlights" },
  { title: "Payments", path: "/payments", key: "payments" },
  { title: "Onboarding", path: "/onboarding", key: "invitesOnboarding" },
  { title: "Audit Logs", path: "/audit-logs", key: "auditLogs" },
  { title: "Manage Users", path: "/manage-users", key: "systemSettings" },
  { title: "Admin Profile", path: "/profile", key: "profile" },
];

export const getModuleKey = (path: string): string => {
  if (path === "/") return "dashboard";
  const found = NAVIGATION_ITEMS.find((item) => item.path !== "/" && path.startsWith(item.path));
  return found ? found.key : "";
};

// 5 simulated users 
const SIMULATED_USERS: Record<string, User> = {
  "all@gmail.com": {
    email: "all@gmail.com",
    accessControl: {
      dashboard: ["view", "edit", "export"],
      airlines: ["view", "edit", "export"],
      cancelledFlights: ["view", "edit", "export"],
      platformOverview: ["view", "edit", "export"],
      detailedAnalysis: ["view", "edit", "export"],
      platformTreasury: ["view", "edit", "export"],
      invitesOnboarding: ["view", "edit", "export"],
      systemSettings: ["view", "edit", "export"],
      auditLogs: ["view", "edit", "export"],
      profile: ["view", "edit", "export"],
    },
  },
  "view@gmail.com": {
    email: "view@gmail.com",
    accessControl: {
      dashboard: ["view"],
      airlines: ["view"],
      cancelledFlights: ["view"],
      platformOverview: ["view"],
      detailedAnalysis: ["view"],
      platformTreasury: ["view"],
      invitesOnboarding: ["view"],
      systemSettings: ["view"],
      auditLogs: ["view"],
      profile: ["view"],
    },
  },
  "edit@gmail.com": {
    email: "edit@gmail.com",
    accessControl: {
      dashboard: ["view", "edit"],
      airlines: ["view", "edit"],
      cancelledFlights: ["view", "edit"],
      platformOverview: ["view", "edit"],
      detailedAnalysis: ["view", "edit"],
      platformTreasury: ["view", "edit"],
      invitesOnboarding: ["view", "edit"],
      systemSettings: ["view", "edit"],
      auditLogs: ["view", "edit"],
      profile: ["view", "edit"],
    },
  },
  "export@gmail.com": {
    email: "export@gmail.com",
    accessControl: {
      dashboard: ["view", "export"],
      airlines: ["view", "export"],
      cancelledFlights: ["view", "export"],
      platformOverview: ["view", "export"],
      detailedAnalysis: ["view", "export"],
      platformTreasury: ["view", "export"],
      invitesOnboarding: ["view", "export"],
      systemSettings: ["view", "export"],
      auditLogs: ["view", "export"],
      profile: ["view", "export"],
    },
  },
  "none@gmail.com": {
    email: "none@gmail.com",
    accessControl: {
      dashboard: [],
      airlines: [],
      cancelledFlights: [],
      platformOverview: [],
      detailedAnalysis: [],
      platformTreasury: [],
      invitesOnboarding: [],
      systemSettings: [],
      auditLogs: [],
      profile: [],
    },
  },
};

const STORAGE_KEY = "flyvoid_current_user";

export const authService = {
  login(email: string, password?: string): User | null {
    if (typeof window === "undefined") return null;

    // Check if user is in simulated database
    let user = SIMULATED_USERS[email.toLowerCase().trim()];

    // If email is not explicitly mapped, treat as restricted (no access)
    if (!user) {
      user = {
        email: email.trim(),
        accessControl: {
          dashboard: [],
          airlines: [],
          cancelledFlights: [],
          platformOverview: [],
          detailedAnalysis: [],
          platformTreasury: [],
          invitesOnboarding: [],
          systemSettings: [],
          auditLogs: [],
          profile: [],
        },
      };
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  logout(): void {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(STORAGE_KEY);
  },

  getCurrentUser(): User | null {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  },

  isLoggedIn(): boolean {
    return this.getCurrentUser() !== null;
  },

  hasPermission(permission: "view" | "edit" | "export", path: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    // Resolve moduleKey dynamically if a direct accessControl key or "payments" is requested
    const moduleKey = (user.accessControl && path in user.accessControl) || path === "payments"
      ? path
      : getModuleKey(path);

    if (!moduleKey) return false;

    if (moduleKey === "payments") {
      // Special logic for payments tab
      const accessControl = user.accessControl || {};
      const hasAnyView =
        (accessControl.platformOverview || []).includes("view") ||
        (accessControl.detailedAnalysis || []).includes("view") ||
        (accessControl.platformTreasury || []).includes("view");

      if (permission === "view") {
        return hasAnyView;
      }

      const hasAnyEdit =
        (accessControl.platformOverview || []).includes("edit") ||
        (accessControl.detailedAnalysis || []).includes("edit") ||
        (accessControl.platformTreasury || []).includes("edit");

      const hasAnyExport =
        (accessControl.platformOverview || []).includes("export") ||
        (accessControl.detailedAnalysis || []).includes("export") ||
        (accessControl.platformTreasury || []).includes("export");

      return permission === "edit" ? hasAnyEdit : hasAnyExport;
    }

    const access = user.accessControl?.[moduleKey] || [];
    return access.includes(permission);
  },
};
