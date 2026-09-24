import { apiClient, extractErrorMessage, setCookie, getCookie, eraseCookie } from "@/src/lib/api-client";

export const authService = {
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
      throw new Error(extractErrorMessage(error, "Invalid 2FA verification code"));
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
      throw new Error(extractErrorMessage(error, "Failed to change password"));
    }
  },

  async resetInitialPassword(resetPasswordToken: string, newPassword: string) {
    try {
      const response = await apiClient.post("/auth/airline/signin/reset-password", {
        resetPasswordToken,
        newPassword,
      });
      return response.data?.message || "Password updated successfully";
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to update password"));
    }
  },

  async setupTfa(): Promise<{ manualEntryKey: string; qrCodeDataUrl: string; message: string }> {
    try {
      const response = await apiClient.post("/auth/airline/2fa/setup");
      const data = response.data?.data || response.data;
      return {
        manualEntryKey: data?.manualEntryKey || "",
        qrCodeDataUrl: data?.qrCodeDataUrl || "",
        message: response.data?.message || "2FA setup initialized",
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to initialize 2FA setup."));
    }
  },

  async enableTfa(twoFactorCode: string): Promise<{ recoveryCodes: string[]; message: string }> {
    try {
      const response = await apiClient.post("/auth/airline/2fa/enable", {
        twoFactorCode,
      });
      const data = response.data?.data || response.data;
      return {
        recoveryCodes: data?.recoveryCodes || [],
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

  async recoverTfa(twoFactorToken: string, recoveryCode: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post("/auth/airline/2fa/recover", {
        twoFactorToken,
        recoveryCode,
      });
      return {
        message: response.data?.message || "2FA recovered and disabled successfully",
      };
    } catch (error: any) {
      const wrappedError = new Error(extractErrorMessage(error, "Failed to recover 2FA.")) as Error & {
        status?: number;
      };
      wrappedError.status = error.response?.status;
      throw wrappedError;
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
    sessionStorage.removeItem("airline_access_token");
    sessionStorage.removeItem("airline_current_user");
    eraseCookie("airline_refresh_token");
  },
};
