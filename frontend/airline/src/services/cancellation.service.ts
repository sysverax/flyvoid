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
  departureAirportId: number;
  arrivalAirportId: number;
  cancellationDate: string;
  cancellationReason?: string;
  cancellationReasonText?: string;
  airlineId?: number;
}

export interface UpdateCancelledFlightPayload {
  flightNumber?: string;
  departureAirportId?: number;
  arrivalAirportId?: number;
  cancellationDate?: string;
  cancellationReason?: string | null;
  cancellationReasonText?: string | null;
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

export interface ReviewCancelledFlightData {
  flight: {
    id: number;
    flightNumber: string;
    airlineId: number;
    departureAirportId: number;
    arrivalAirportId: number;
    route: {
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
    };
    cancellationDate: string;
    cancellationReason: string | null;
    status: string;
    createdAt?: string;
    updatedAt?: string | null;
  };
  summary: {
    totalBookings: number;
    totalAdults: number;
    totalChildren: number;
  };
}

export type ReviewFlightResponse = ReviewCancelledFlightData;

export interface HotelAllocationsResponse {
  cancelledFlightId: number;
  status: string;
  totalBookings: number;
  allocatedBookings: number;
  failedBookings: number;
  totalRooms: number;
  totalActualPrice: number;
  totalSellingPrice: number;
  totalDiscounts: number;
  totalHotelTaxes: number;
  totalPlatformFee: number;
  currency: string;
}

export interface HotelSummaryCancelledFlightSummaryDto {
  totalBookings: number;
  totalAdults: number;
  totalChildren: number;
  totalRooms: number;
  totalHotelCost: number;
  totalDiscount: number;
  totalHotelTax: number;
  totalPlatformFee: number;
  totalPayable: number;
}

export interface HotelSummaryResponse {
  summary: HotelSummaryCancelledFlightSummaryDto;
}

export interface HotelBookingPassengerDto {
  id: number;
  cancelledFlightId: number;
  pnr: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  travelClass: string;
  adults: number;
  children: number;
}

export interface HotelBookingItemDTO {
  id: number;
  passengerBooking: HotelBookingPassengerDto;
  cancelledFlightId: number;
  hotelName: string;
  rating: string;
  totalRooms: number;
  totalCost: number | string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CancelledFlightHotelBookingListResponseDto {
  hotelBookings: HotelBookingItemDTO[];
  totalHotelBookings: number;
  currentPage: number;
  limit: number;
}

export interface HotelBookingRoomDetailDto {
  adults: number;
  children: number;
  roomName: string;
  boardName: string;
  price: number;
}

export interface HotelBookingHotelDetailDto {
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
  checkInDate: string;
  checkOutDate: string;
  rooms: HotelBookingRoomDetailDto[];
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
  updatedAt: string | null;
  amenities?: string[];
}

export interface HotelBookingDetailFlightDto {
  id: number;
  flightNumber: string;
  airlineId: number;
  departureAirportId: number;
  arrivalAirportId: number;
  cancellationDate: string;
  cancellationReason: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  route: {
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
  };
}

export interface HotelBookingDetailDataDto {
  id: number;
  flight: HotelBookingDetailFlightDto;
  booking: BookingDTO;
  hotel: HotelBookingHotelDetailDto;
}

export interface HotelBookingDetailResponseDto {
  success: boolean;
  data: HotelBookingDetailDataDto;
  message?: string;
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

  async reviewFlight(flightId: number | string) {
    try {
      const response = await apiClient.get(
        `/cancelled-flights/${flightId}/review`,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch flight review details"),
      );
    }
  },

  async createCancelledFlight(payload: CreateCancelledFlightPayload) {
    try {
      const { airlineId, ...requestBody } = payload;
      const response = await apiClient.post("/cancelled-flights", requestBody);
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

  async allocateHotels(flightId: number | string) {
    try {
      const response = await apiClient.post(
        `/cancelled-flights/${flightId}/hotel-allocations`,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to allocate hotels"),
      );
    }
  },

  async getHotelSummary(flightId: number | string): Promise<{
    success: boolean;
    data: HotelSummaryResponse;
    message?: string;
  }> {
    try {
      const response = await apiClient.get(
        `/cancelled-flights/${flightId}/hotel-summary`,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch hotel summary"),
      );
    }
  },

  async listHotelBookings(
    flightId: number | string,
    params?: { page?: number; limit?: number },
  ): Promise<{
    success: boolean;
    data: CancelledFlightHotelBookingListResponseDto;
    message?: string;
  }> {
    try {
      const response = await apiClient.get(
        `/cancelled-flights/${flightId}/hotel-bookings`,
        {
          params: {
            page: params?.page || 1,
            limit: params?.limit || 10,
          },
        },
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to fetch hotel bookings"),
      );
    }
  },

  async getHotelBookingDetail(
    flightId: number | string,
    hotelBookingId: number | string,
  ): Promise<HotelBookingDetailResponseDto> {
    try {
      const response = await apiClient.get(
        `/cancelled-flights/${flightId}/hotel-bookings/${hotelBookingId}`,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(
          error,
          "Failed to fetch hotel booking details",
        ),
      );
    }
  },

  async processPayment(flightId: number | string): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    try {
      const response = await apiClient.post(
        `/cancelled-flights/${flightId}/payment`,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to process payment"),
      );
    }
  },

  async publishFlight(flightId: number | string): Promise<{
    success: boolean;
    data?: any;
    message?: string;
  }> {
    try {
      const response = await apiClient.post(
        `/cancelled-flights/${flightId}/publish`,
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        extractErrorMessage(error, "Failed to publish cancelled flight"),
      );
    }
  },
};


