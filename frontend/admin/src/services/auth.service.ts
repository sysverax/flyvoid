"use client";

import { apiClient, setCookie, getCookie, eraseCookie, extractErrorMessage } from "../lib/api-client";
import { getModuleKey } from "../lib/navigation";

export interface User {
  email: string;
  accessControl: Record<string, string[]>;
}

const STORAGE_KEY = "flyvoid_current_user";

function mapAccessControls(admin: any): Record<string, string[]> {
  const assetMap: Record<string, string> = {
    DASHBOARD: "dashboard",
    AIRLINES: "airlines",
    AIRPORTS: "airports",
    CANCELLED_FLIGHTS: "cancelledFlights",
    PAYMENTS: "payments",
    REVENUE: "payments",
    INVITES_ONBOARDING: "invitesOnboarding",
    SYSTEM_SETTINGS: "systemSettings",
    AUDIT_LOGS: "auditLogs",
    PROFILE: "profile",
  };

  const accessControl: Record<string, string[]> = {
    dashboard: [],
    airlines: [],
    airports: [],
    cancelledFlights: [],
    platformOverview: [],
    detailedAnalysis: [],
    platformTreasury: [],
    invitesOnboarding: [],
    systemSettings: [],
    auditLogs: [],
    profile: ["view", "edit", "export"],
  };

  if (admin.role === "SUPER_ADMIN") {
    Object.keys(accessControl).forEach((key) => {
      accessControl[key] = ["view", "edit", "export"];
    });
  } else if (admin.accessControls) {
    admin.accessControls.forEach((ac: any) => {
      const frontKey = assetMap[ac.asset];
      if (frontKey) {
        const mappedActions = ac.access.map((action: string) => action.toLowerCase());
        accessControl[frontKey] = mappedActions;

        // Map payments module to all sub-views/tabs
        if (frontKey === "payments") {
          accessControl.platformOverview = mappedActions;
          accessControl.detailedAnalysis = mappedActions;
          accessControl.platformTreasury = mappedActions;
        }
      }
    });
  }

  return accessControl;
}

export const authService = {
  async login(email: string, password?: string): Promise<{ user: User; message: string; requiresTwoFactor?: boolean; twoFactorToken?: string; requiresPasswordReset?: boolean; resetPasswordToken?: string } | null> {
    if (typeof window === "undefined") return null;
    const trimmedEmail = email.toLowerCase().trim();

    try {
      const response = await apiClient.post("/auth/admin/signin", {
        email: trimmedEmail,
        password,
      });

      if (response.data.data?.requiresPasswordReset) {
        return {
          requiresPasswordReset: true,
          resetPasswordToken: response.data.data.resetPasswordToken,
          message: response.data.message || "Initial password reset required",
          user: {
            email: response.data.data.admin.email,
            accessControl: mapAccessControls(response.data.data.admin),
          },
        };
      }

      if (response.data.data?.requiresTwoFactor) {
        const admin = response.data.data.admin;
        return {
          requiresTwoFactor: true,
          twoFactorToken: response.data.data.twoFactorToken,
          message: response.data.message || "Signin requires two-factor authentication",
          user: {
            email: admin.email,
            accessControl: mapAccessControls(admin),
          },
        };
      }

      const { accessToken, refreshToken, admin } = response.data.data;
      const user: User = {
        email: admin.email,
        accessControl: mapAccessControls(admin),
      };

      sessionStorage.setItem("flyvoid_access_token", accessToken);
      if (refreshToken) {
        setCookie("flyvoid_refresh_token", refreshToken);
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return { user, message: response.data.message || "Successfully signed in." };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to sign in. Please check your credentials."));
    }
  },

  async verifySigninTfa(twoFactorToken: string, twoFactorCode: string): Promise<{ user: User; message: string; requiresPasswordReset?: boolean; resetPasswordToken?: string }> {
    try {
      const response = await apiClient.post("/auth/admin/signin/2fa/verify", {
        twoFactorToken,
        twoFactorCode,
      });

      if (response.data.data?.requiresPasswordReset) {
        return {
          requiresPasswordReset: true,
          resetPasswordToken: response.data.data.resetPasswordToken,
          message: response.data.message || "Initial password reset required",
          user: {
            email: response.data.data.admin.email,
            accessControl: mapAccessControls(response.data.data.admin),
          },
        };
      }

      const { accessToken, refreshToken, admin } = response.data.data;
      const user: User = {
        email: admin.email,
        accessControl: mapAccessControls(admin),
      };

      sessionStorage.setItem("flyvoid_access_token", accessToken);
      if (refreshToken) {
        setCookie("flyvoid_refresh_token", refreshToken);
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return { user, message: response.data.message || "Successfully signed in." };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Invalid 2FA code."));
    }
  },

  async resetInitialPassword(resetPasswordToken: string, newPassword: string): Promise<string> {
    try {
      const response = await apiClient.post("/auth/admin/signin/reset-password", {
        resetPasswordToken,
        newPassword,
      });
      return response.data.message || "Initial password reset successful";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to reset password."));
    }
  },

  async recoverSigninTfa(email: string, password?: string, recoveryCode?: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post("/auth/admin/2fa/recover", {
        email,
        password,
        recoveryCode,
      });
      return { message: response.data.message || "2FA successfully recovered and disabled. Please sign in again." };
    } catch (error: any) {
      const errMsg = extractErrorMessage(error, "Failed to recover 2FA.");
      const errObj = new Error(errMsg) as any;
      errObj.status = error.response?.status;
      throw errObj;
    }
  },

  async logout(): Promise<void> {
    if (typeof window === "undefined") return;
    const refreshToken = getCookie("flyvoid_refresh_token");
    if (refreshToken) {
      try {
        await apiClient.post("/auth/admin/signout", { refreshToken });
      } catch (err) {
        console.error("Backend signout failed", err);
      }
    }
    sessionStorage.removeItem("flyvoid_access_token");
    sessionStorage.removeItem(STORAGE_KEY);
    eraseCookie("flyvoid_refresh_token");
  },

  async setupTfa(): Promise<{ manualEntryKey: string; qrCodeDataUrl: string; message: string }> {
    try {
      const response = await apiClient.post("/auth/admin/2fa/setup");
      return {
        ...response.data.data,
        message: response.data.message || "2FA setup initialized"
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to initialize 2FA setup."));
    }
  },

  async enableTfa(twoFactorCode: string): Promise<{ recoveryCodes: string[]; message: string }> {
    try {
      const response = await apiClient.post("/auth/admin/2fa/enable", {
        twoFactorCode,
      });
      return {
        recoveryCodes: response.data.data.recoveryCodes,
        message: response.data.message || "2FA enabled successfully"
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to enable 2FA."));
    }
  },

  async disableTfa(twoFactorCode: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post("/auth/admin/2fa/disable", {
        twoFactorCode,
      });
      return {
        message: response.data.message || "2FA disabled successfully"
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to disable 2FA."));
    }
  },

  async sendForgotPasswordOtp(email: string): Promise<string> {
    const trimmedEmail = email.toLowerCase().trim();
    try {
      const response = await apiClient.post("/auth/admin/forgot-password/send-otp", {
        email: trimmedEmail,
      });
      return response.data.message || "Verification code sent successfully.";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to send verification code."));
    }
  },

  async verifyForgotPasswordOtp(email: string, otp: string): Promise<{ resetPasswordToken: string; message: string }> {
    const trimmedEmail = email.toLowerCase().trim();
    try {
      const response = await apiClient.post("/auth/admin/forgot-password/verify-otp", {
        email: trimmedEmail,
        otp,
      });
      return {
        resetPasswordToken: response.data.data.resetPasswordToken,
        message: response.data.message || "Code verified successfully.",
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Invalid or expired verification code."));
    }
  },

  async resetPassword(resetPasswordToken: string, newPassword: string): Promise<string> {
    try {
      const response = await apiClient.post("/auth/admin/forgot-password", {
        resetPasswordToken,
        newPassword,
      });
      return response.data.message || "Password reset successful.";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to reset password."));
    }
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

    // Resolve moduleKey dynamically
    const moduleKey = (user.accessControl && path in user.accessControl) || path === "payments"
      ? path
      : getModuleKey(path);

    if (!moduleKey) return false;

    if (moduleKey === "payments") {
      const accessControl = user.accessControl || {};
      const tabs = ["platformOverview", "detailedAnalysis", "platformTreasury"];
      return tabs.some((tab) => (accessControl[tab] || []).includes(permission));
    }

    const access = user.accessControl?.[moduleKey] || [];
    return access.includes(permission);
  },
};
