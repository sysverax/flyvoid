import { apiClient, extractErrorMessage } from "../lib/api-client";
import { countries } from "countries-list";
import { Airline } from "../types/airlines";
import { formatDate, formatDateTime } from "../lib/utils";
export interface AirlineDetailsDTO {
  id: number;
  name: string;
  code: string;
  countryCode: string;
  companyRegistrationNumber: string;
  website?: string | null;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  currency: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isSuspended: boolean;
}

export interface AirlineAdminDetailsDTO {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  lastLoginAt: string | null;
  isActive: boolean;
}

export interface AirlineOperationalMetricsDTO {
  totalOngoingCancelledFlights: number;
  totalCancelledFlights: number;
  totalChildren: number;
  totalAdults: number;
  totalBookings: number;
  totalRooms: number;
}

export interface AirlineFinancialSummaryDTO {
  walletId: number;
  creditLimit: number;
  balance: number;
  lockedAmount: number;
  platformFeePercentage: number;
  totalActualPrice: number;
  totalBuyingPrice: number;
  totalSellingPrice: number;
  totalDiscounts: number;
  totalHotelTaxes: number;
  totalPlatformFee: number;
  totalPrice: number;
  totalEarnings: number;
}

// GET /airline/:id and PATCH /airline/:id response shape.
export interface AirlineDetailResponseDTO {
  airlineDetails: AirlineDetailsDTO;
  adminDetails: AirlineAdminDetailsDTO;
  operationalMetrics: AirlineOperationalMetricsDTO;
  financialSummary: AirlineFinancialSummaryDTO;
}

export interface AirlineWalletSummaryDTO {
  id: number;
  balance: number;
  creditLimit: number;
  lockedAmount: number;
}

// GET /airline (list) response shape — intentionally leaner than
// AirlineDetailResponseDTO (no contact/admin/metrics/financial details);
// credit limit and balance come from the nested wallet instead.
export interface AirlineListItemDTO {
  id: number;
  name: string;
  code: string;
  countryCode: string;
  platformFeePercentage: number;
  isActive: boolean;
  isSuspended: boolean;
  wallet: AirlineWalletSummaryDTO;
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
  platformFeePercentage: number;
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

export interface AdjustWalletBalanceRequest {
  airlineId: number;
  type: "CREDIT" | "DEBIT";
  amount: number;
  reason?: string;
}

export interface WalletAdjustmentDTO {
  adjustmentId: number;
  transactionId: number;
  airlineId: number;
  walletId: number;
  type: "CREDIT" | "DEBIT";
  amount: number;
  openingBalance: number;
  closingBalance: number;
  creditLimit: number;
  reason?: string | null;
  createdAt: string;
}

export interface WalletTransactionItemDTO {
  id: number;
  airline: {
    id: number;
    name: string;
    code: string;
  };
  openingBalance: number;
  transactionAmount: number;
  closingBalance: number;
  transactionType: "CREDIT" | "DEBIT";
  type: string;
  creditLimit: number;
  reason: string | null;
  status: string;
  createdAt: string;
}

export interface WalletTransactionsResponse {
  transactions: WalletTransactionItemDTO[];
  pagination: {
    currentPage: number;
    limit: number;
    totalCount: number;
  };
}

export interface WalletSummaryDTO {
  totalWalletBalance: number;
  totalCreditIssued: number;
  totalCreditUsed: number;
}

export const airlinesService = {
  async getWalletsSummary(): Promise<WalletSummaryDTO> {
    try {
      const { data } = await apiClient.get("/wallets/summary");
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch wallets summary."));
    }
  },

  async adjustWalletBalance(
    payload: AdjustWalletBalanceRequest
  ): Promise<WalletAdjustmentDTO> {
    try {
      const { data } = await apiClient.post("/wallets/adjustments", payload);
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to adjust wallet balance."));
    }
  },

  async getWalletTransactions(params: {
    airlineId?: number;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<WalletTransactionsResponse> {
    try {
      const { data } = await apiClient.get("/wallets/transactions", { params });
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch wallet transactions."));
    }
  },
  async getAirlines(params: {
    search?: string;
    isActive?: boolean;
    isSuspended?: boolean;
    countryCode?: string;
    page: number;
    limit: number;
  }): Promise<{ airlines: AirlineListItemDTO[]; total: number }> {
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

  async getAirlineDetail(airlineId: number): Promise<AirlineDetailResponseDTO> {
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
  // GET/PATCH /airline/:id return a nested shape:
  // { airlineDetails, adminDetails, operationalMetrics, financialSummary }.
  // GET /airline (list) returns a flat lean shape with a nested `wallet`
  // instead (no adminDetails/operationalMetrics/financialSummary at all).
  const details = dto.airlineDetails ?? dto;
  const admin = dto.adminDetails ?? null;
  const wallet = dto.financialSummary ?? dto.wallet;

  const countryName = countries[details.countryCode as keyof typeof countries]?.name || details.countryCode || "N/A";

  const isSuspendedBool = Boolean(details.isSuspended);
  const isActiveBool = details.isActive !== undefined ? Boolean(details.isActive) : true;

  let status: "Active" | "Suspended" | "Disabled" = "Active";
  if (isSuspendedBool) {
    status = "Suspended";
  } else if (!isActiveBool) {
    status = "Disabled";
  }

  return {
    id: String(details.id),
    airlineName: details.name,
    airlineCode: details.code,
    country: countryName,
    companyReg: details.companyRegistrationNumber || "",
    website: details.website || "",
    contactEmail: details.contactEmail || "",
    contactPhone: details.contactPhone || "",
    timezone: details.timezone || "",
    currency: details.currency || "",
    address: details.address || "",
    onboardingDate: formatDate(details.createdAt),
    status,
    spend: wallet?.balance ?? 0,
    adminFirstName: admin?.firstName || "",
    adminLastName: admin?.lastName || "",
    adminEmail: admin?.email || "",
    adminJobTitle: admin?.jobTitle || "",
    adminLastLoginAt: admin?.lastLoginAt ? formatDateTime(admin.lastLoginAt) : null,
    creditLimit: wallet?.creditLimit ?? 0,
    platformFeePercentage: wallet?.platformFeePercentage ?? details.platformFeePercentage ?? 0,
    failedPaymentsCount: 0,
    allocationFailuresCount: 0,
    logoUrl: details.logo,
    isActive: isActiveBool,
    isSuspended: isSuspendedBool,
    operationalMetrics: dto.operationalMetrics
      ? {
          totalOngoingCancelledFlights: Number(dto.operationalMetrics.totalOngoingCancelledFlights),
          totalCancelledFlights: Number(dto.operationalMetrics.totalCancelledFlights),
          totalChildren: Number(dto.operationalMetrics.totalChildren),
          totalAdults: Number(dto.operationalMetrics.totalAdults),
          totalBookings: Number(dto.operationalMetrics.totalBookings),
          totalRooms: Number(dto.operationalMetrics.totalRooms),
        }
      : undefined,
    financialSummary: dto.financialSummary
      ? {
          creditLimit: Number(dto.financialSummary.creditLimit),
          balance: Number(dto.financialSummary.balance),
          lockedAmount: Number(dto.financialSummary.lockedAmount),
          platformFeePercentage: Number(dto.financialSummary.platformFeePercentage),
          totalActualPrice: Number(dto.financialSummary.totalActualPrice),
          totalBuyingPrice: Number(dto.financialSummary.totalBuyingPrice),
          totalSellingPrice: Number(dto.financialSummary.totalSellingPrice),
          totalDiscounts: Number(dto.financialSummary.totalDiscounts),
          totalHotelTaxes: Number(dto.financialSummary.totalHotelTaxes),
          totalPlatformFee: Number(dto.financialSummary.totalPlatformFee),
          totalPrice: Number(dto.financialSummary.totalPrice),
          totalEarnings: Number(dto.financialSummary.totalEarnings),
        }
      : undefined,
  };
}
