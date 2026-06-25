/**
 * Airline invitation fixtures — black-box e2e only.
 *
 * Request payload factories for /api/v1/airline/invitations endpoints.
 */
import { uniqueEmail } from "./admin.fixture";

export interface InviteAirlinePayload {
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

export function uniqueAirlineCode(prefix = "E2E"): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${rand}`.slice(0, 10);
}

export function uniqueCompanyReg(prefix = "CRN"): string {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

export function validInvitePayload(
  overrides: Partial<InviteAirlinePayload> = {},
): InviteAirlinePayload {
  const baseEmail = uniqueEmail("airline-admin").replace(
    "@e2e.test",
    "@e2e-airline.test",
  );

  return {
    airlineName: "SkyJet Airways",
    airlineCode: uniqueAirlineCode("E2E"),
    countryCode: "AE",
    companyRegistrationNumber: uniqueCompanyReg("E2ECRN"),
    website: "https://skyjet.example",
    contactEmail: `ops+${Date.now()}@skyjet.example`,
    contactPhone: "+971501112233",
    timezone: "Asia/Dubai",
    logo: "https://cdn.skyjet.example/logo.png",
    address: "Airport Road, Dubai",
    currency: "AED",
    adminFirstName: "Aisha",
    adminLastName: "Khan",
    adminEmail: baseEmail,
    jobTitle: "Country Manager",
    creditLimit: 500000,
    ...overrides,
  };
}

export function malformedJsonBody(): string {
  return "{ bad json }";
}
