import { apiClient, extractErrorMessage, setCookie, eraseCookie } from "@/src/lib/api-client";

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

  logout() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("airline_access_token");
      sessionStorage.removeItem("airline_current_user");
      eraseCookie("airline_refresh_token");
    }
  },
};
