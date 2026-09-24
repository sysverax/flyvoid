import { apiClient, extractErrorMessage } from "@/src/lib/api-client";

export interface WalletBalanceDTO {
  walletId: number;
  airlineId: number;
  balance: number;
  creditLimit: number;
  lockedAmount: number;
  currency: string;
  updatedAt: string;
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

export const walletService = {
  async getWalletBalance(): Promise<WalletBalanceDTO> {
    try {
      const { data } = await apiClient.get("/wallets/balance");
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch wallet balance."));
    }
  },

  async getWalletTransactions(params?: {
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
};
