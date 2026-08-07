import { apiClient, extractErrorMessage } from "../lib/api-client";

export interface InvitationResponse {
  invitationId: number;
  airlineId: number | null;
  airlineName: string;
  airlineCode: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  invitedByAdminId: number;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvitationDetailResponse extends InvitationResponse {
  companyRegistrationNumber: string;
  history: Array<{
    id: number;
    event: string;
    performedByAdminId: number | null;
    performedByAdminEmail: string | null;
    createdAt: string;
  }>;
}

export interface InviteAirlineRequest {
  airlineName: string;
  airlineCode: string;
  countryCode: string;
  companyRegistrationNumber: string;
  website?: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  logo?: string;
  address: string;
  currency: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  jobTitle: string;
  creditLimit?: number;
}

export const onboardingService = {
  async getInvitations(
    page: number,
    limit: number
  ): Promise<{ invitations: InvitationResponse[]; total: number }> {
    try {
      const { data } = await apiClient.get("/airline/invitations", {
        params: { page, limit },
      });
      return {
        invitations: data.data.invitations || [],
        total: data.data.total || 0,
      };
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch invitations."));
    }
  },

  async getInvitationDetail(invitationId: number): Promise<InvitationDetailResponse> {
    try {
      const { data } = await apiClient.get(`/airline/invitations/${invitationId}`);
      return data.data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to fetch invitation details."));
    }
  },

  async inviteAirline(payload: InviteAirlineRequest): Promise<any> {
    try {
      const { data } = await apiClient.post("/airline/invitations", payload);
      return data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to send invitation."));
    }
  },

  async resendInvitation(invitationId: number): Promise<any> {
    try {
      const { data } = await apiClient.post(`/airline/invitations/${invitationId}/resend`);
      return data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to resend invitation."));
    }
  },

  async revokeInvitation(invitationId: number): Promise<any> {
    try {
      const { data } = await apiClient.post(`/airline/invitations/${invitationId}/revoke`);
      return data;
    } catch (error: any) {
      throw new Error(extractErrorMessage(error, "Failed to revoke invitation."));
    }
  },
};
