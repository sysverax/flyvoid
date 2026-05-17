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
      contactEmail: string;
      contactPhone: string;
      adminFirstName: string;
      adminLastName: string;
      adminEmail: string;
    }>,
  ) {
    return {
      airlineName: "Flyvoid Airways",
      airlineCode: uniqueAirlineCode(),
      countryCode: "IN",
      contactEmail: uniqueAirlineEmail("ops"),
      contactPhone: "+911234567890",
      adminFirstName: "Airline",
      adminLastName: "Admin",
      adminEmail: uniqueAirlineEmail("admin"),
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
