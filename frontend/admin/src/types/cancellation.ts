export interface CancelledFlightItem {
  id: number | string;
  flightNumber: string;
  airlineId?: number;
  airline?: {
    id: number;
    name: string;
    code: string;
  };
  departureAirport?: {
    id: number;
    code: string;
    name: string;
  };
  arrivalAirport?: {
    id: number;
    code: string;
    name: string;
  };
  cancellationDate: string;
  totalBookings?: number;
  totalPassengers?: number;
  totalCost?: number;
  totalPlatformFee?: number;
  status: string;
}

export interface CancelledFlightsPagination {
  currentPage: number;
  limit: number;
  totalCount: number;
}

export interface GetCancelledFlightsQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  airlineId?: number;
  startDate?: string;
  endDate?: string;
}

export interface CancelledFlightsSummaryResponse {
  totalCancelFlights: number;
  totalAdults: number;
  totalChildren: number;
  totalBookings: number;
  totalRooms: number;
  totalHotelCost: number;
  totalHotelTax: number;
  totalDiscount: number;
  totalCost: number;
  totalPlatformFee: number;
}

export interface GetCancelledFlightsSummaryQueryParams {
  airlineId?: number;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

// UI representation interface
export interface CancelledFlight {
  id: string | number;
  flightCode: string;
  airlineName: string;
  airlineCode: string;
  route: string;
  date: string;
  passengers: number;
  cost: number;
  revenue: number;
  status: string;
}
