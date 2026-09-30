import { apiClient, extractErrorMessage, setCookie, getCookie, eraseCookie, clearAuthStorage } from "@/src/lib/api-client";

export interface User {
  id?: number;
  email: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  accessControl?: Record<string, string[]>;
  accessControls?: Array<{ asset: string; access: string[] }>;
}

const STORAGE_KEY = "airline_current_user";

function mapAccessControls(user: any): Record<string, string[]> {
  const assetMap: Record<string, string> = {
    DASHBOARD: "dashboard",
    AIRPORTS: "airports",
    WALLET: "wallet",
    CANCELLED_FLIGHTS: "cancelledFlights",
    BOOKINGS: "bookings",
    PAYMENTS: "payments",
    AIRLINE_USERS: "manageUsers",
    SETTINGS: "settings",
    PROFILE: "settings",
  };

  const accessControl: Record<string, string[]> = {
    dashboard: [],
    airports: [],
    wallet: [],
    cancelledFlights: [],
    bookings: [],
    payments: [],
    manageUsers: [],
    settings: ["view", "edit", "export"],
  };

  if (!user) return accessControl;

  if (user.role === "AIRLINE_ADMIN" || user.role === "SUPER_ADMIN") {
    Object.keys(accessControl).forEach((key) => {
      accessControl[key] = ["view", "edit", "export"];
    });
  } else if (user.accessControls && Array.isArray(user.accessControls)) {
    user.accessControls.forEach((ac: any) => {
      const frontKey = assetMap[ac.asset];
      if (frontKey) {
        const mappedActions = (ac.access || []).map((action: string) => action.toLowerCase());
        accessControl[frontKey] = mappedActions;
      }
    });
  }

  return accessControl;
}

function getModuleKey(path: string): string {
  const cleanPath = path.split("?")[0].replace(/\/$/, "");

  if (cleanPath === "" || cleanPath === "/") return "dashboard";
  if (cleanPath.startsWith("/airports")) return "airports";
  if (cleanPath.startsWith("/wallet")) return "wallet";
  if (cleanPath.startsWith("/cancellation")) return "cancelledFlights";
  if (cleanPath.startsWith("/bookings")) return "bookings";
  if (cleanPath.startsWith("/payments")) return "payments";
  if (cleanPath.startsWith("/manage-users")) return "manageUsers";
  if (cleanPath.startsWith("/settings")) return "settings";

  return "";
}

export const authService = {
  getCurrentUser(): User | null {
    if (typeof window === "undefined") return null;
    const item = sessionStorage.getItem(STORAGE_KEY);
    if (!item) return null;
    try {
      const rawUser = JSON.parse(item);
      const accessControl = mapAccessControls(rawUser);
      return { ...rawUser, accessControl };
    } catch {
      return null;
    }
  },

  hasPermission(permission: "view" | "edit" | "export", path: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    if (user.role === "AIRLINE_ADMIN" || user.role === "SUPER_ADMIN") {
      return true;
    }

    const moduleKey = (user.accessControl && path in user.accessControl)
      ? path
      : getModuleKey(path);

    if (!moduleKey) return false;
    if (moduleKey === "settings") return true;

    const access = user.accessControl?.[moduleKey] || [];
    return access.includes(permission);
  },

  async onboard(invitationToken: string, password: string) {
    try {
      const response = await apiClient.post("/auth/airline/onboard", {
        invitationToken,
        password,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to onboard airline admin"));
    }
  },

  async signin(email: string, password: string) {
    try {
      const response = await apiClient.post("/auth/airline/signin", {
        email,
        password,
      });
      const data = response.data?.data || response.data;

      // Check if it's 2FA challenge
      if (data?.requiresTwoFactor) {
        return {
          requiresTwoFactor: true,
          twoFactorToken: data.twoFactorToken,
          message: response.data?.message || "Signin requires two-factor authentication",
        };
      }

      // Check if it's a password reset challenge
      if (data?.requiresPasswordReset) {
        return {
          requiresPasswordReset: true,
          resetPasswordToken: data.resetPasswordToken,
          message: response.data?.message || "Password reset required",
        };
      }

      // Normal sign in
      if (typeof window !== "undefined") {
        if (data?.accessToken) {
          sessionStorage.setItem("airline_access_token", data.accessToken);
        }
        if (data?.refreshToken) {
          setCookie("airline_refresh_token", data.refreshToken);
        }
        if (data?.user) {
          sessionStorage.setItem("airline_current_user", JSON.stringify(data.user));
        }
      }
      return data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Invalid email or password"));
    }
  },

  async verifySigninTfa(twoFactorToken: string, twoFactorCode: string) {
    try {
      const response = await apiClient.post("/auth/airline/signin/2fa/verify", {
        twoFactorToken,
        twoFactorCode,
      });
      const data = response.data?.data || response.data;

      if (data?.requiresPasswordReset) {
        return {
          requiresPasswordReset: true,
          resetPasswordToken: data.resetPasswordToken,
          message: response.data?.message || "Initial password reset required",
          user: data?.user || null,
        };
      }

      if (typeof window !== "undefined") {
        if (data?.accessToken) {
          sessionStorage.setItem("airline_access_token", data.accessToken);
        }
        if (data?.refreshToken) {
          setCookie("airline_refresh_token", data.refreshToken);
        }
        if (data?.user) {
          sessionStorage.setItem("airline_current_user", JSON.stringify(data.user));
        }
      }

      return {
        user: data?.user || null,
        message: response.data?.message || "Successfully verified 2FA code",
      };
    } catch (error: any) {
      const errMsg = extractErrorMessage(error, "Invalid 2FA verification code");
      const errObj = new Error(errMsg) as any;
      errObj.status = error.response?.status;
      throw errObj;
    }
  },

  async changePassword(currentPassword: string, newPassword: string) {
    try {
      const response = await apiClient.post("/auth/airline/change-password", {
        currentPassword,
        newPassword,
      });
      return response.data?.message || "Password changed successfully";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to change password."));
    }
  },

  async resetInitialPassword(resetPasswordToken: string, newPassword: string): Promise<string> {
    try {
      const response = await apiClient.post("/auth/airline/signin/reset-password", {
        resetPasswordToken,
        newPassword,
      });
      return response.data?.message || "Password updated successfully.";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to update password."));
    }
  },

  async setupTfa(): Promise<{ secret: string; otpauthUrl: string; qrCodeUrl: string; manualEntryKey: string; qrCodeDataUrl: string; message?: string }> {
    try {
      const response = await apiClient.post("/auth/airline/2fa/setup");
      const data = response.data?.data || response.data;
      return {
        secret: data.secret || "",
        otpauthUrl: data.otpauthUrl || "",
        qrCodeUrl: data.qrCodeUrl || data.qrCodeDataUrl || "",
        manualEntryKey: data.manualEntryKey || data.secret || "",
        qrCodeDataUrl: data.qrCodeDataUrl || data.qrCodeUrl || "",
        message: response.data?.message || "2FA setup initialized",
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to initialize 2FA setup."));
    }
  },

  async enableTfa(twoFactorCode: string): Promise<{ recoveryCodes: string[]; message?: string }> {
    try {
      const response = await apiClient.post("/auth/airline/2fa/enable", {
        twoFactorCode,
      });
      const data = response.data?.data || response.data;
      return {
        recoveryCodes: data.recoveryCodes || [],
        message: response.data?.message || "2FA enabled successfully",
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to enable 2FA."));
    }
  },

  async disableTfa(twoFactorCode: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post("/auth/airline/2fa/disable", {
        twoFactorCode,
      });
      return {
        message: response.data?.message || "2FA disabled successfully",
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to disable 2FA."));
    }
  },

  async recoverTfa(email: string, recoveryCode: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post("/auth/airline/2fa/recover", {
        email,
        recoveryCode,
      });
      return {
        message: response.data?.message || "2FA recovered and disabled successfully",
      };
    } catch (error: any) {
      const errMsg = extractErrorMessage(error, "Failed to recover 2FA.");
      const errObj = new Error(errMsg) as any;
      errObj.status = error.response?.status;
      throw errObj;
    }
  },

  async sendForgotPasswordOtp(email: string): Promise<string> {
    const trimmedEmail = email.toLowerCase().trim();
    try {
      const response = await apiClient.post("/auth/airline/forgot-password/send-otp", {
        email: trimmedEmail,
      });
      return response.data?.message || "Verification code sent successfully.";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to send verification code."));
    }
  },

  async verifyForgotPasswordOtp(email: string, otp: string): Promise<{ resetPasswordToken: string; message: string }> {
    const trimmedEmail = email.toLowerCase().trim();
    try {
      const response = await apiClient.post("/auth/airline/forgot-password/verify-otp", {
        email: trimmedEmail,
        otp,
      });
      const data = response.data?.data || response.data;
      return {
        resetPasswordToken: data?.resetPasswordToken || "",
        message: response.data?.message || "Code verified successfully.",
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Invalid or expired verification code."));
    }
  },

  async resetPassword(resetPasswordToken: string, newPassword: string): Promise<string> {
    try {
      const response = await apiClient.post("/auth/airline/forgot-password", {
        resetPasswordToken,
        newPassword,
      });
      return response.data?.message || "Password reset successful.";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to reset password."));
    }
  },

  async logout(): Promise<void> {
    if (typeof window === "undefined") return;
    const refreshToken = getCookie("airline_refresh_token");
    if (refreshToken) {
      try {
        await apiClient.post("/auth/airline/signout", { refreshToken });
      } catch (err) {
        console.error("Backend signout failed", err);
      }
    }
    clearAuthStorage();
  },
};
