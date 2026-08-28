import { apiClient, extractErrorMessage } from "../lib/api-client";
import { CancelledFlight } from "@/src/types/cancellation";

export const cancellationService = {
  async getCancelledFlights(): Promise<CancelledFlight[]> {
    try {
      const { data } = await apiClient.get("/cancelled-flights");
      // Map API response to UI expected fields
      return (data.data || []).map((flight: any) => {
        // Date formatting: api uses YYYY-MM-DD
        let formattedDate = "N/A";
        if (flight.cancellation_date) {
          const parts = flight.cancellation_date.split("-");
          if (parts.length === 3) {
            formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            formattedDate = new Date(flight.cancellation_date).toLocaleDateString("en-GB");
          }
        }
        
        let displayStatus = flight.status;
        if (flight.status === "draft") {
          displayStatus = "Pending";
        } else if (flight.status === "completed") {
          displayStatus = "Completed";
        } else if (flight.status === "processing") {
          displayStatus = "Processing";
        } else if (flight.status === "failed") {
          displayStatus = "Failed";
        }

        return {
          id: flight.id,
          flightCode: flight.flight_number,
          airlineName: flight.airline_name,
          airlineCode: flight.airline_code,
          route: flight.route,
          date: formattedDate,
          passengers: flight.passengers,
          cost: flight.cost,
          revenue: flight.revenue,
          status: displayStatus,
        };
      });
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch cancelled flights."));
    }
  },

  async getFlightBookings(id: string): Promise<any> {
    try {
      const { data } = await apiClient.get(`/cancelled-flights/${id}/bookings`);
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch flight bookings."));
    }
  },
};
