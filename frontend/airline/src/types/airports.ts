export interface Airport {
  id: string;
  name: string;
  iataCode: string;
  icaoCode: string;
  countryCode: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  type: "INTERNATIONAL" | "DOMESTIC" | "UTC";
  isActive: boolean;
  address?: string | null;
  postalCode: string;
  country: string;
}
