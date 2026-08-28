import axios from "axios";
import Cookies from "js-cookie";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export function extractErrorMessage(error: any, defaultMsg: string): string {
  const data = error.response?.data;
  if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.join(", ");
  }
  return data?.message || defaultMsg;
}

export function setCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (maxAgeSeconds !== undefined) {
    // js-cookie expires option expects number of days (fractional days are supported)
    const days = maxAgeSeconds / (24 * 60 * 60);
    Cookies.set(name, value, { expires: days, path: "/", sameSite: "Lax" });
  } else {
    Cookies.set(name, value, { path: "/", sameSite: "Lax" });
  }
}

export function getCookie(name: string): string | null {
  return Cookies.get(name) || null;
}

export function eraseCookie(name: string) {
  Cookies.remove(name, { path: "/" });
}

// Request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("flyvoid_access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle unauthorized access and automatically refresh tokens
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not attempt token refresh for public routes or refresh requests
    const isPublicRoute =
      originalRequest.url?.includes("/auth/admin/signin") ||
      originalRequest.url?.includes("/auth/admin/signup") ||
      originalRequest.url?.includes("/auth/admin/forgot-password") ||
      originalRequest.url?.includes("/auth/admin/refresh") ||
      originalRequest.url?.includes("/auth/admin/2fa/recover") ||
      originalRequest.url?.includes("/auth/admin/signout");

    if (isPublicRoute) {
      // For refresh failures, clean storage and redirect
      if (originalRequest.url?.includes("/auth/admin/refresh")) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("flyvoid_access_token");
          sessionStorage.removeItem("flyvoid_current_user");
          eraseCookie("flyvoid_refresh_token");
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getCookie("flyvoid_refresh_token");
      if (!refreshToken) {
        isRefreshing = false;
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("flyvoid_access_token");
          sessionStorage.removeItem("flyvoid_current_user");
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/admin/refresh`, {
          refreshToken: refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

        if (typeof window !== "undefined") {
          sessionStorage.setItem("flyvoid_access_token", newAccessToken);
          setCookie("flyvoid_refresh_token", newRefreshToken);
        }

        processQueue(null, newAccessToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        if (typeof window !== "undefined") {
          sessionStorage.removeItem("flyvoid_access_token");
          sessionStorage.removeItem("flyvoid_current_user");
          eraseCookie("flyvoid_refresh_token");
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

