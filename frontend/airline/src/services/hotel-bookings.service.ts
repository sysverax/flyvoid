import { apiClient, extractErrorMessage } from "../lib/api-client";

export interface HotelBookingPassengerDTO {
  id: number;
  pnr: string;
  firstName: string;
  lastName: string;
  email: string;
  travelClass: string;
  phone: string;
  adults: number;
  children: number;
}

export interface HotelBookingAirportDTO {
  id: number;
  code: string;
  name: string;
}

export interface HotelBookingAirlineDTO {
  id: number;
  name: string;
  code: string;
}

export interface HotelBookingDTO {
  id: number;
  cancelledFlightId: number;
  flightNumber: string;
  flightStatus: string;
  airlineId: number;
  airline: HotelBookingAirlineDTO;
  destinationAirport: HotelBookingAirportDTO;
  passenger: HotelBookingPassengerDTO;
  hotelName: string;
  rate: string;
  checkInDate: string;
  checkOutDate: string;
  totalRooms: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface HotelBookingFlightRouteAirportDTO {
  id: number;
  code: string;
  name: string;
}

export interface HotelBookingDetailFlightDTO {
  id: number;
  flightNumber: string;
  airlineId: number;
  departureAirportId: number;
  arrivalAirportId: number;
  cancellationDate: string;
  cancellationReason?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  route?: {
    departureAirport: HotelBookingFlightRouteAirportDTO;
    arrivalAirport: HotelBookingFlightRouteAirportDTO;
  };
}

export interface HotelBookingDetailPassengerDTO {
  id: number;
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
  createdAt: string;
  updatedAt?: string | null;
}

export interface HotelBookingDetailRoomDTO {
  adults: number;
  children: number;
  roomName: string;
  boardName: string;
  price: number;
}

export interface HotelBookingDetailHotelDTO {
  hotelCode: string;
  hotelName: string;
  category: string;
  address?: string | null;
  contact?: {
    phones: Array<{ phoneNumber: string; phoneType: string }>;
    email: string | null;
  } | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceFromAirportKm?: number | null;
  imageUrl?: string | null;
  website?: string | null;
  amenities?: string[] | null;
  checkInDate: string;
  checkOutDate: string;
  rooms: HotelBookingDetailRoomDTO[];
  totalRooms: number;
  actualPrice: number;
  buyingPrice?: number;
  sellingPrice: number;
  tax: number;
  platformFee: number;
  discount: number;
  totalPrice: number;
  earnings?: number;
  status: string;
  bookingReference: string;
  createdAt: string;
  updatedAt?: string | null;
  reason?: string | null;
}

export interface HotelBookingDetailDTO {
  id: number;
  flight: HotelBookingDetailFlightDTO;
  booking: HotelBookingDetailPassengerDTO;
  hotel: HotelBookingDetailHotelDTO;
}

export const hotelBookingsService = {
  async getHotelBookings(params: {
    page: number;
    limit: number;
    destinationAirportId?: number;
    cancelledFlightId?: number;
    search?: string;
    airlineId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    hotelBookings: HotelBookingDTO[];
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

  async getCancelledFlights(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<Array<{ id: number; flightNumber: string }>> {
    try {
      const { data } = await apiClient.get("/cancelled-flights", {
        params: {
          page: params?.page || 1,
          limit: params?.limit || 100,
          search: params?.search,
        },
      });
      return data.data?.cancelledFlights || [];
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch cancelled flights."));
    }
  },

  async getHotelBookingDetail(id: number | string): Promise<HotelBookingDetailDTO> {
    try {
      const { data } = await apiClient.get(`/hotel-bookings/${id}`);
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch hotel booking details."));
    }
  },

  async exportHotelBooking(id: number | string): Promise<void> {
    try {
      const res = await apiClient.get(`/hotel-bookings/${id}/export`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `hotel-booking-${id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to export hotel booking CSV."));
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

