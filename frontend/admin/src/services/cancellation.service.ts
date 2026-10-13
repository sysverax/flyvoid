import { apiClient, extractErrorMessage } from "../lib/api-client";
import {
  CancelledFlightItem,
  CancelledFlightsPagination,
  CancelledFlightsSummaryResponse,
  GetCancelledFlightsQueryParams,
  GetCancelledFlightsSummaryQueryParams,
} from "../types/cancellation";

export const cancellationService = {
  async getCancelledFlights(params?: GetCancelledFlightsQueryParams): Promise<{
    cancelledFlights: CancelledFlightItem[];
    pagination: CancelledFlightsPagination;
  }> {
    try {
      const { data } = await apiClient.get("/cancelled-flights", { params });
      return {
        cancelledFlights: data.data?.cancelledFlights || [],
        pagination: data.data?.pagination || { currentPage: 1, limit: 10, totalCount: 0 },
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch cancelled flights."));
    }
  },

  async getCancelledFlightsSummary(
    params?: GetCancelledFlightsSummaryQueryParams
  ): Promise<CancelledFlightsSummaryResponse> {
    try {
      const { data } = await apiClient.get("/cancelled-flights/summary", { params });
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch cancelled flights summary."));
    }
  },

  async getFlightBookings(id: string | number): Promise<any> {
    try {
      const { data } = await apiClient.get(`/cancelled-flights/${id}/bookings`);
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch flight bookings."));
    }
  },
};
