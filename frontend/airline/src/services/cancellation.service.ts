import { apiClient, extractErrorMessage } from "@/src/lib/api-client";

export interface ListCancelledFlightsItemDTO {
  id: number;
  flightNumber: string;
  departureAirport: {
    id: number;
    code: string;
    name: string;
  };
  arrivalAirport: {
    id: number;
    code: string;
    name: string;
  };
  cancellationDate: string;
  totalBookings: number;
  totalPassengers: number;
  totalCost: number;
  status: string;
}

export interface ListCancelledFlightsResponseDataDto {
  cancelledFlights: ListCancelledFlightsItemDTO[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
  };
}

export type CancelledFlightApiStatus =
  | "draft"
  | "in_progress"
  | "passengers_booking_confirmed"
  | "hotel_allocation_in_progress"
  | "allocated"
  | "paid"
  | "published";
export interface CreateCancelledFlightPayload {
  flightNumber: string;
  airlineId: number;
  departureAirportId: number;
  arrivalAirportId: number;
  cancellationDate: string;
  cancellationReason?: string;
  cancellationReasonText?: string;
}

export interface UpdateCancelledFlightPayload {
  flightNumber?: string;
  departureAirportId?: number;
  arrivalAirportId?: number;
  cancellationDate?: string;
  cancellationReason?: string;
  cancellationReasonText?: string;
}

export interface BookingDTO {
  id: number | string;
  cancelledFlightId?: number;
  pnr: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  travelClass: string;
  adults: number;
  children: number;
  specialNotes?: string[];
  additionalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBookingPayload {
  pnr: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  travelClass: string;
  adults: number;
  children: number;
  specialNotes?: string[];
  additionalNotes?: string;
}

export interface ImportBookingResponse {
  bookings: BookingDTO[];
  summary?: {
    totalBookings: number;
    validBookings: number;
    errorBookings: number;
  };
  errorList?: Array<{
    row: number;
    errors: string[];
  }>;
}

export const cancellationService = {
  async listCancelledFlights(params?: {
    page?: number;
    limit?: number;
    status?: CancelledFlightApiStatus;
    search?: string;
    airlineId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    try {
      const response = await apiClient.get(`/cancelled-flights`, {
        params: {
          page: params?.page || 1,
          limit: params?.limit || 10,
          status: params?.status,
          search: params?.search,
          airlineId: params?.airlineId,
          startDate: params?.startDate,
          endDate: params?.endDate,
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch bookings"));
    }
  },

  async createCancelledFlight(payload: CreateCancelledFlightPayload) {
    try {
      const response = await apiClient.post("/cancelled-flights", {
        flightNumber: payload.flightNumber,
        departureAirportId: payload.departureAirportId,
        arrivalAirportId: payload.arrivalAirportId,
        cancellationDate: payload.cancellationDate,
        cancellationReason: payload.cancellationReason,
        cancellationReasonText: payload.cancellationReasonText,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to create cancelled flight"),
      );
    }
  },

  async updateCancelledFlight(
    flightId: number | string,
    payload: UpdateCancelledFlightPayload,
  ) {
    try {
      const response = await apiClient.patch(
        `/cancelled-flights/${flightId}`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to update cancelled flight"),
      );
    }
  },

  async addBooking(flightId: number | string, payload: CreateBookingPayload) {
    try {
      const response = await apiClient.post(
        `/cancelled-flights/${flightId}/bookings`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to add booking"));
    }
  },

  async listBookings(
    flightId: number | string,
    params?: { page?: number; limit?: number },
  ) {
    try {
      const response = await apiClient.get(
        `/cancelled-flights/${flightId}/bookings`,
        {
          params: {
            page: params?.page || 1,
            limit: params?.limit || 50,
          },
        },
      );
      return response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch bookings"));
    }
  },

  async importBookings(
    flightId: number | string,
    file: File,
  ): Promise<{
    success: boolean;
    message?: string;
    data: ImportBookingResponse;
  }> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post(
        `/cancelled-flights/${flightId}/bookings/import`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      return response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to import bookings"));
    }
  },

  async updateBooking(
    flightId: number | string,
    bookingId: number | string,
    payload: Partial<CreateBookingPayload>,
  ) {
    try {
      const response = await apiClient.patch(
        `/cancelled-flights/${flightId}/bookings/${bookingId}`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to update booking"));
    }
  },

  async deleteBooking(flightId: number | string, bookingId: number | string) {
    try {
      const response = await apiClient.delete(
        `/cancelled-flights/${flightId}/bookings/${bookingId}`,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to delete booking"));
    }
  },

  async confirmBookings(flightId: number | string) {
    try {
      const response = await apiClient.post(
        `/cancelled-flights/${flightId}/bookings/confirm`,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to confirm bookings"));
    }
  },
};
