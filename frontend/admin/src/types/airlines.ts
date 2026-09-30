export interface AirlineOperationalMetrics {
  totalOngoingCancelledFlights: number;
  totalCancelledFlights: number;
  totalChildren: number;
  totalAdults: number;
  totalBookings: number;
  totalRooms: number;
}

export interface AirlineFinancialSummary {
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

export interface Airline {
  id: string;
  airlineName: string;
  airlineCode: string;
  country: string;
  companyReg: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  currency: string;
  address: string;
  onboardingDate: string;
  status: "Active" | "Suspended" | "Disabled";
  spend: number;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminJobTitle: string;
  adminLastLoginAt?: string | null;
  creditLimit: number;
  platformFeePercentage: number;
  failedPaymentsCount: number;
  allocationFailuresCount: number;
  logoUrl?: string;
  assignedAirports?: string;
  isActive?: boolean;
  isSuspended?: boolean;
  // Only populated when mapped from GET/PATCH /airline/:id — the list
  // endpoint (GET /airline) doesn't return these.
  operationalMetrics?: AirlineOperationalMetrics;
  financialSummary?: AirlineFinancialSummary;
}
