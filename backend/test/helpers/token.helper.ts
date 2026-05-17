import { JwtService } from "@nestjs/jwt";
import { UserType } from "../../src/common/constants/user.constants";
import { config } from "../../src/config/config";

const jwt = new JwtService();
const FALLBACK_ACCESS_SECRET = "e2e-access-secret";
const FALLBACK_REFRESH_SECRET = "e2e-refresh-secret";

export const tokenHelper = {
  malformed(): string {
    return "not.a.jwt";
  },

  invalid(): string {
    return "invalid.token.signature";
  },

  async expiredAdminAccess(adminId = 9999): Promise<string> {
    return jwt.signAsync(
      {
        sub: adminId,
        email: `expired-admin-${Date.now()}@flyvoid.test`,
        role: "SUPER_ADMIN",
        userType: UserType.PLATFORM,
        type: "access",
      },
      {
        secret: config.jwt.accessSecret || FALLBACK_ACCESS_SECRET,
        expiresIn: "1ms",
      },
    );
  },

  async expiredAdminRefresh(adminId = 9999): Promise<string> {
    return jwt.signAsync(
      {
        sub: adminId,
        type: "refresh",
        userType: UserType.PLATFORM,
      },
      {
        secret: config.jwt.refreshSecret || FALLBACK_REFRESH_SECRET,
        expiresIn: "1ms",
      },
    );
  },
};
