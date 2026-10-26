import { apiClient, extractErrorMessage } from "../lib/api-client";

/** A hotel booking as GET /hotel-bookings returns it to platform users. */
export interface AdminHotelBookingDTO {
  id: number;
  airline: { id: number; name: string };
  provider: { id: number; code: string; name: string } | null;
  destinationAirport: { id: number; code: string; name: string };
  hotel: { id: number | null; name: string };
  passengers: { adults: number; children: number };
  rooms: number;
  pricing: {
    hotelCost: number;
    buyingPrice: number;
    tax: number;
    discount: number;
    platformFee: number;
    supplierMargin: number;
    totalCost: number;
    totalEarning: number;
  };
  /** confirmed | in_progress | manual_check */
  status: string;
  createdAt: string;
}

export interface HotelProviderDTO {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

/** GET /hotel-bookings/summary for platform users: totals of CONFIRMED bookings. */
export interface AdminHotelBookingsSummaryDTO {
  totalBookings: number;
  totalPassengers: number;
  totalRooms: number;
  /** Billed to airlines. */
  totalCost: number;
  totalPlatformFee: number;
  totalSupplierMargin: number;
  totalDiscounts: number;
  /** totalPlatformFee + totalSupplierMargin */
  totalEarnings: number;
  /** Paid to suppliers (Σ buying price). */
  totalPaidToHotels: number;
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
    providerId?: number;
    cancelledFlightId?: number;
    destinationAirportId?: number;
    status?: string;
    /** ISO 8601 with timezone; start inclusive, end exclusive (booking created time). */
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

  /** Hotel suppliers (GET /hotel-providers), for the provider filter. */
  async getHotelProviders(params?: { isActive?: boolean }): Promise<HotelProviderDTO[]> {
    try {
      const { data } = await apiClient.get("/hotel-providers", { params });
      return data.data?.providers || [];
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch hotel providers."));
    }
  },

  /** Same filters as getHotelBookings; status is accepted but the totals are confirmed-only. */
  async getHotelBookingsSummary(params?: {
    airlineId?: number;
    providerId?: number;
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
