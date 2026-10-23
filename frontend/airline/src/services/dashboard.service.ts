import { apiClient, extractErrorMessage } from "../lib/api-client";

export type TrendTimeFrame = "today" | "yesterday" | "week" | "month" | "year";

export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export interface HotelSpendTrendPoint {
  bucket: string;
  label: string;
  spend: number;
}

export interface HotelSpendTrendData {
  timeFrame: TrendTimeFrame;
  granularity: "hour" | "day" | "month" | "year" | string;
  timezone: string;
  startDate: string;
  endDate: string;
  points: HotelSpendTrendPoint[];
}

export interface HotelSpendTrendResponse {
  success: boolean;
  requestId: string;
  timestamp: string;
  message: string;
  data: HotelSpendTrendData;
}

export interface AffectedPassengersTrendPoint {
  bucket: string;
  label: string;
  passengers: number;
}

export interface AffectedPassengersTrendData {
  timeFrame: TrendTimeFrame;
  granularity: "hour" | "day" | "month" | "year" | string;
  timezone: string;
  startDate: string;
  endDate: string;
  points: AffectedPassengersTrendPoint[];
}

export interface AffectedPassengersTrendResponse {
  success: boolean;
  requestId: string;
  timestamp: string;
  message: string;
  data: AffectedPassengersTrendData;
}

export interface CancelledFlightsTrendPoint {
  bucket: string;
  label: string;
  flights: number;
}

export interface CancelledFlightsTrendData {
  timeFrame: TrendTimeFrame;
  granularity: "hour" | "day" | "month" | "year" | string;
  timezone: string;
  startDate: string;
  endDate: string;
  points: CancelledFlightsTrendPoint[];
}

export interface CancelledFlightsTrendResponse {
  success: boolean;
  requestId: string;
  timestamp: string;
  message: string;
  data: CancelledFlightsTrendData;
}

// GET /dashboard/airline/summary. Hotel figures use the hotel booking's
// created_at (allocated / paid / published flights); flight figures use the
// flight's created_at (non-draft flights).
export interface DashboardSummaryData {
  timeFrame: TrendTimeFrame;
  timezone: string;
  startDate: string;
  endDate: string;
  totalHotelBookingCost: number;
  totalHotelBookings: number;
  totalRooms: number;
  totalPlatformFee: number;
  platformFeePercentage: number | null;
  totalCancelFlights: number;
  totalAdults: number;
  totalChildren: number;
}

export interface DashboardSummaryResponse {
  success: boolean;
  requestId: string;
  timestamp: string;
  message: string;
  data: DashboardSummaryData;
}

export const dashboardService = {
  async getHotelSpendTrend(
    timeFrame: TrendTimeFrame,
    timezone?: string
  ): Promise<HotelSpendTrendData> {
    try {
      const tz = timezone || getUserTimeZone();
      const response = await apiClient.get<HotelSpendTrendResponse>(
        "/dashboard/airline/hotel-spend-trend",
        {
          params: { timeFrame, timezone: tz },
        }
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch hotel spend trend.")
      );
    }
  },

  async getAffectedPassengersTrend(
    timeFrame: TrendTimeFrame,
    timezone?: string
  ): Promise<AffectedPassengersTrendData> {
    try {
      const tz = timezone || getUserTimeZone();
      const response = await apiClient.get<AffectedPassengersTrendResponse>(
        "/dashboard/airline/affected-passengers-trend",
        {
          params: { timeFrame, timezone: tz },
        }
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch affected passengers trend.")
      );
    }
  },

  async getCancelledFlightsTrend(
    timeFrame: TrendTimeFrame,
    timezone?: string
  ): Promise<CancelledFlightsTrendData> {
    try {
      const tz = timezone || getUserTimeZone();
      const response = await apiClient.get<CancelledFlightsTrendResponse>(
        "/dashboard/airline/cancelled-flights-trend",
        {
          params: { timeFrame, timezone: tz },
        }
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch cancelled flights trend.")
      );
    }
  },

  async getDashboardSummary(
    timeFrame: TrendTimeFrame,
    timezone?: string
  ): Promise<DashboardSummaryData> {
    try {
      const tz = timezone || getUserTimeZone();
      const response = await apiClient.get<DashboardSummaryResponse>(
        "/dashboard/airline/summary",
        { params: { timeFrame, timezone: tz } }
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch dashboard summary.")
      );
    }
  },
};
