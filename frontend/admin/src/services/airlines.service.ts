import { apiClient, extractErrorMessage } from "../lib/api-client";
import { countries } from "countries-list";
import { Airline } from "../types/airlines";
import { formatDate } from "../lib/utils";
export interface AirlineUserDTO {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  isActive: boolean;
}

export interface AirlineDTO {
  id: number;
  name: string;
  code: string;
  countryCode: string;
  companyRegistrationNumber: string;
  website?: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  logo?: string;
  currency: string;
  address: string;
  isActive: boolean;
  isSuspended: boolean;
  adminUser: AirlineUserDTO;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAirlineRequest {
  name: string;
  code: string;
  countryCode: string;
  companyRegistrationNumber: string;
  website?: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  logo?: string;
  currency: string;
  address: string;
  isActive: boolean;
  isSuspended: boolean;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminJobTitle: string;
}

export interface AirportDTO {
  id: number;
  name: string;
  iataCode: string;
  icaoCode: string;
  countryCode: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isActive: boolean;
  type: string;
  address: string;
  postalCode: string;
  isAssigned: boolean;
}

export interface AirlineAirportsResponse {
  airports: AirportDTO[];
  total: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}

export const airlinesService = {
  async getAirlines(params: {
    search?: string;
    isActive?: boolean;
    isSuspended?: boolean;
    countryCode?: string;
    page: number;
    limit: number;
  }): Promise<{ airlines: AirlineDTO[]; total: number }> {
    try {
      const { data } = await apiClient.get("/airline", { params });
      return {
        airlines: data.data.airlines || [],
        total: data.data.total || 0,
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch airlines."));
    }
  },

  async getAirlineDetail(airlineId: number): Promise<AirlineDTO> {
    try {
      const { data } = await apiClient.get(`/airline/${airlineId}`);
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch airline details."));
    }
  },

  async updateAirline(
    airlineId: number,
    payload: Partial<UpdateAirlineRequest>
  ): Promise<any> {
    try {
      const { data } = await apiClient.patch(`/airline/${airlineId}`, payload);
      return data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to update airline."));
    }
  },

  async getAirlineAirports(
    airlineId: number,
    params?: { page?: number; limit?: number }
  ): Promise<AirlineAirportsResponse> {
    try {
      const { data } = await apiClient.get(`/airports/airlines/${airlineId}/airports`, { params });
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch airline airports."));
    }
  },

  async updateAirlineAirportAssignments(
    airlineId: number,
    payload: { assignAirportIds: number[]; disableAirportIds: number[] }
  ): Promise<any> {
    try {
      const { data } = await apiClient.patch(`/airports/airlines/${airlineId}/assignments`, payload);
      return data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to update airport assignments."));
    }
  },
};


export function mapAirlineDTOToAirline(dto: any): Airline {
  const countryName = countries[dto.countryCode as keyof typeof countries]?.name || dto.countryCode || "N/A";

  const isSuspendedBool = Boolean(dto.isSuspended);
  const isActiveBool = dto.isActive !== undefined ? Boolean(dto.isActive) : true;

  let status: "Active" | "Suspended" | "Disabled" = "Active";
  if (isSuspendedBool) {
    status = "Suspended";
  } else if (!isActiveBool) {
    status = "Disabled";
  }

  return {
    id: String(dto.id),
    airlineName: dto.name,
    airlineCode: dto.code,
    country: countryName,
    companyReg: dto.companyRegistrationNumber,
    website: dto.website || "",
    contactEmail: dto.contactEmail,
    contactPhone: dto.contactPhone,
    timezone: dto.timezone,
    currency: dto.currency,
    address: dto.address,
    onboardingDate: formatDate(dto.createdAt),
    status,
    flightsCount: dto.flightsCount || 0,
    passengersCount: dto.passengersCount || 0,
    spend: dto.spendAmount || 0,
    revenue: dto.revenueAmount || 0,
    stripeConnection: "Pending",
    adminFirstName: dto.adminUser?.firstName || "",
    adminLastName: dto.adminUser?.lastName || "",
    adminEmail: dto.adminUser?.email || "",
    adminJobTitle: dto.adminUser?.jobTitle || "",
    creditLimit: dto.creditLimit || 0,
    totalCancelledFlights: 0,
    totalPassengersMetric: 0,
    avgCostPerPassenger: 0,
    totalSpendMetric: 0,
    platformFeesMetric: 0,
    allowanceBalanceMetric: 0,
    failedPaymentsCount: 0,
    allocationFailuresCount: 0,
    logoUrl: dto.logo,
    isActive: isActiveBool,
    isSuspended: isSuspendedBool,
  };
}
