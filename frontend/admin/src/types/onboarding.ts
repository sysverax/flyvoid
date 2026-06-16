export interface Invitation {
  id: string;
  airlineName: string;
  airlineCode: string;
  contactEmail: string;
  country: string;
  invitedBy: string;
  invitedDate: string;
  expiryDate: string;
  creditLimit: number;
  status: "Pending" | "Accepted" | "Revoked" | "Expired";
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
  adminJobTitle?: string;
  companyReg?: string;
  website?: string;
  phone?: string;
  timezone?: string;
  logoUrl?: string;
  currency?: string;
  address?: string;
}

export { type Toast } from "./common";

export interface InviteFormState {
  airlineName: string;
  airlineCode: string;
  contactEmail: string;
  country: string;
  creditLimit: string;
  expiryDate: string;
  companyReg: string;
  website: string;
  phone: string;
  timezone: string;
  logoUrl: string;
  currency: string;
  address: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminJobTitle: string;
}
