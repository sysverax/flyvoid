let airlineCounter = 1;

const uniqueAirlineCode = (): string => {
  const next = `${Date.now()}${airlineCounter}`.slice(-6);
  airlineCounter += 1;
  return `E2E${next}`;
};

const uniqueAirlineEmail = (prefix: string): string => {
  const value = `${prefix}.${Date.now()}.${airlineCounter}@flyvoid-airline.test`;
  airlineCounter += 1;
  return value;
};

export const airlineFactory = {
  buildInvitePayload(
    overrides?: Partial<{
      airlineName: string;
      airlineCode: string;
      countryCode: string;
      companyRegistrationNumber: string;
      website: string;
      contactEmail: string;
      contactPhone: string;
      timezone: string;
      logo: string;
      address: string;
      currency: string;
      adminFirstName: string;
      adminLastName: string;
      adminEmail: string;
      jobTitle: string;
    }>,
  ) {
    return {
      airlineName: "Flyvoid Airways",
      airlineCode: uniqueAirlineCode(),
      countryCode: "IN",
      companyRegistrationNumber: `CRN-${Date.now()}${airlineCounter}`,
      website: `https://www.flyvoid-airline-${Date.now()}${airlineCounter}.test`,
      contactEmail: uniqueAirlineEmail("ops"),
      contactPhone: "+911234567890",
      timezone: "Asia/Kolkata",
      logo: `https://cdn.flyvoid-airline.test/logo-${Date.now()}${airlineCounter}.png`,
      address: "221B Baker Street, London",
      currency: "INR",
      adminFirstName: "Airline",
      adminLastName: "Admin",
      adminEmail: uniqueAirlineEmail("admin"),
      jobTitle: "Operations Lead",
      ...overrides,
    };
  },

  buildOnboardPayload(invitationToken: string, password = "Password@123") {
    return {
      invitationToken,
      password,
    };
  },

  buildAirlineSigninPayload(email: string, password = "Password@123") {
    return {
      email,
      password,
    };
  },
};
