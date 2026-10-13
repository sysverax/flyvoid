import { apiClient, extractErrorMessage } from "../lib/api-client";

export interface AdminHotelBookingDTO {
  id: number;
  cancelledFlightId?: number;
  flightNumber?: string;
  airlineId?: number;
  airline?: {
    id: number;
    name: string;
    code: string;
  };
  destinationAirport?: {
    id: number;
    code: string;
    name: string;
  };
  passenger?: {
    id: number;
    pnr?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    adults?: number;
    children?: number;
  };
  vendor?: string;
  hotelName?: string;
  rate?: string;
  checkInDate?: string;
  checkOutDate?: string;
  totalRooms?: number;
  totalPrice?: number;
  totalPlatformFee?: number;
  earnings?: number;
  totalEarnings?: number;
  status: string;
  createdAt?: string;
}

export interface AdminHotelBookingsSummaryDTO {
  totalPaymentsByAirlines?: number;
  totalPaidToHotels?: number;
  totalEarnings?: number;
  totalCancelFlights?: number;
  totalBookings?: number;
  totalPassengers?: number;
  totalRooms?: number;
  totalCost?: number;
  totalPlatformFee?: number;
}

export interface AdminHotelBookingDetailDTO {
  id: number;
  flight?: any;
  booking?: any;
  hotel?: any;
}

export const adminHotelBookingsService = {
  async getHotelBookings(params: {
    page: number;
    limit: number;
    search?: string;
    airlineId?: number;
    cancelledFlightId?: number;
    destinationAirportId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    hotelBookings: AdminHotelBookingDTO[];
    total: number;
    currentPage: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      const { data } = await apiClient.get("/hotel-bookings", { params });
      const pagination = data.data?.pagination;
      const total = pagination?.totalCount || 0;
      const limit = pagination?.limit || params.limit;
      const currentPage = pagination?.currentPage || params.page;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return {
        hotelBookings: data.data?.hotelBookings || [],
        total,
        currentPage,
        totalPages,
        limit,
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch hotel bookings."));
    }
  },

  async getHotelBookingsSummary(params?: {
    airlineId?: number;
    cancelledFlightId?: number;
    destinationAirportId?: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AdminHotelBookingsSummaryDTO> {
    try {
      const { data } = await apiClient.get("/hotel-bookings/summary", { params });
      return data.data || {};
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch hotel bookings summary."));
    }
  },

  async getHotelBookingDetail(id: number | string): Promise<AdminHotelBookingDetailDTO> {
    try {
      const { data } = await apiClient.get(`/hotel-bookings/${id}`);
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch hotel booking details."));
    }
  },

  async downloadHotelConfirmation(id: number | string): Promise<void> {
    try {
      const res = await apiClient.get(`/hotel-bookings/${id}/confirmation`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `hotel-booking-confirmation-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to download hotel booking confirmation PDF."));
    }
  },

  async sendHotelBookingEmail(id: number | string): Promise<{ success: boolean; data: string; message?: string }> {
    try {
      const { data } = await apiClient.post(`/hotel-bookings/${id}/send`);
      return data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to send hotel booking confirmation email."));
    }
  },
};
