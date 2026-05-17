import { randomUUID } from "node:crypto";

const unique = (prefix: string): string => {
  const uniqueId = randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}.${Date.now()}.${uniqueId}@flyvoid.test`;
};

export const adminFactory = {
  buildAdminSignupPayload(
    overrides?: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }>,
  ) {
    return {
      firstName: "Admin",
      lastName: "User",
      email: unique("admin"),
      password: "Password@123",
      ...overrides,
    };
  },

  buildAdminSigninPayload(email: string, password = "Password@123") {
    return {
      email,
      password,
    };
  },

  buildInactiveAdminPayload() {
    return this.buildAdminSignupPayload({
      firstName: "Inactive",
    });
  },
};
