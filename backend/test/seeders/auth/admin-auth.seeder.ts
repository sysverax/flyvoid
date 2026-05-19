import { INestApplication } from "@nestjs/common";
import { AirlineUserEntity } from "../../../src/airline/entities/airline-user.entity";
import { AdminRole } from "../../../src/common/constants/user.constants";
import { adminFactory } from "../../factories/admin.factory";
import { airlineFactory } from "../../factories/airline.factory";
import { authHelper } from "../../helpers/auth.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { testDbHelper } from "../../database/db.helper";
import { directSqlHelper } from "../../database/direct-sql.helper";

export interface SeededAdminSet {
  superAdmin: {
    id: number;
    email: string;
    password: string;
  };
  staffAdmin: {
    id: number;
    email: string;
    password: string;
  };
  inactiveSuperAdmin: {
    id: number;
    email: string;
    password: string;
  };
  inactiveStaffAdmin: {
    id: number;
    email: string;
    password: string;
  };
}

// const createAdmin = async (
//   app: INestApplication,
//   role: AdminRole,
//   isInactive = false,
// ): Promise<{ id: number; email: string; password: string }> => {
//   const payload = adminFactory.buildAdminSignupPayload();
//   const created = await authHelper.signupAdmin(app, payload);

//   const updates: Partial<AdminEntity> = {};

//   if (role !== AdminRole.SUPER_ADMIN) {
//     updates.role = role;
//   }

//   if (isInactive) {
//     updates.isActive = false;
//   }

//   if (Object.keys(updates).length > 0) {
//     await testDbHelper.update(app, AdminEntity, { id: created.id }, updates);
//   }

//   return {
//     id: created.id,
//     email: created.email,
//     password: payload.password,
//   };
// };

const createAdmin = async (
  app: INestApplication,
  role: AdminRole,
  isInactive = false,
): Promise<{ id: number; email: string; password: string }> => {
  const payload = adminFactory.buildAdminSignupPayload();
  const created = await authHelper.signupAdmin(app, payload);

  const updates: { role?: AdminRole; isActive?: boolean } = {};

  if (role !== AdminRole.SUPER_ADMIN) {
    updates.role = role;
  }

  if (isInactive) {
    updates.isActive = false;
  }

  if (Object.keys(updates).length > 0) {
    const dataSource = directSqlHelper.getDataSource(app);
    const usePostgresParams = dataSource.options.type === "postgres";
    const parameter = (index: number): string =>
      usePostgresParams ? `$${index + 1}` : "?";

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (typeof updates.role === "string") {
      setClauses.push(`role = ${parameter(values.length)}`);
      values.push(updates.role);
    }

    if (typeof updates.isActive === "boolean") {
      setClauses.push(`is_active = ${parameter(values.length)}`);
      values.push(updates.isActive);
    }

    if (setClauses.length > 0) {
      const whereIdToken = parameter(values.length);
      const sql = `UPDATE admins SET ${setClauses.join(", ")} WHERE id = ${whereIdToken}`;
      values.push(created.id);
      await directSqlHelper.execute(app, sql, values);
    }
  }

  return {
    id: created.id,
    email: created.email,
    password: payload.password,
  };
};

export const adminAuthSeeder = {
  async seedAdminSet(app: INestApplication): Promise<SeededAdminSet> {
    const superAdmin = await this.seedSuperAdmin(app);
    const staffAdmin = await this.seedStaffAdmin(app);
    const inactiveSuperAdmin = await this.seedInactiveSuperAdmin(app);
    const inactiveStaffAdmin = await this.seedInactiveStaffAdmin(app);

    return {
      superAdmin,
      staffAdmin,
      inactiveSuperAdmin,
      inactiveStaffAdmin,
    };
  },

  async seedSuperAdmin(
    app: INestApplication,
  ): Promise<{ id: number; email: string; password: string }> {
    return await createAdmin(app, AdminRole.SUPER_ADMIN);
  },

  async seedStaffAdmin(
    app: INestApplication,
  ): Promise<{ id: number; email: string; password: string }> {
    return await createAdmin(app, AdminRole.STAFF);
  },

  async seedInactiveSuperAdmin(
    app: INestApplication,
  ): Promise<{ id: number; email: string; password: string }> {
    return await createAdmin(app, AdminRole.SUPER_ADMIN, true);
  },

  async seedInactiveStaffAdmin(
    app: INestApplication,
  ): Promise<{ id: number; email: string; password: string }> {
    return await createAdmin(app, AdminRole.STAFF, true);
  },

  async updateAdmin(
    app: INestApplication,
    adminId: number,
    updates: Partial<{
      email: string;
      password: string;
      role: AdminRole;
      isActive: boolean;
    }>,
  ): Promise<void> {
    const dataSource = directSqlHelper.getDataSource(app);
    const usePostgresParams = dataSource.options.type === "postgres";
    const parameter = (index: number): string =>
      usePostgresParams ? `$${index + 1}` : "?";

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.email) {
      setClauses.push(`email = ${parameter(values.length)}`);
      values.push(updates.email);
    }

    if (updates.role) {
      setClauses.push(`role = ${parameter(values.length)}`);
      values.push(updates.role);
    }

    if (typeof updates.isActive === "boolean") {
      setClauses.push(`is_active = ${parameter(values.length)}`);
      values.push(updates.isActive);
    }

    if (setClauses.length > 0) {
      const whereIdToken = parameter(values.length);
      const sql = `UPDATE admins SET ${setClauses.join(", ")} WHERE id = ${whereIdToken}`;
      values.push(adminId);
      await directSqlHelper.execute(app, sql, values);

      const selectIdToken = usePostgresParams ? "$1" : "?";
      const updatedAdmin = await directSqlHelper.first<{
        id: number;
        email: string;
        role: string;
        is_active: boolean;
      }>(
        app,
        `SELECT id, email, role, is_active FROM admins WHERE id = ${selectIdToken}`,
        [adminId],
      );
      console.log("Updated admin row:", updatedAdmin);
    }
  },

  async seedAirlineInvite(app: INestApplication): Promise<{
    invitationToken: string;
    invitedAdminEmail: string;
  }> {
    const inviter = await this.seedSuperAdmin(app);
    const inviterSession = await authHelper.signinAdmin(app, {
      email: inviter.email,
      password: inviter.password,
    });

    const invitePayload = airlineFactory.buildInvitePayload();
    const inviteResponse = await requestHelper.authorizedPost(
      app,
      "/api/v1/auth/admin/airline-invitations",
      invitePayload,
      inviterSession.accessToken,
    );

    const body = responseHelper.expectSuccess<{
      onboardingLink: string | null;
      email: string;
    }>(inviteResponse, 201);

    const onboardingLink = body.data.onboardingLink;
    if (!onboardingLink) {
      throw new Error("Onboarding link is missing in non-production test mode");
    }

    const token = new URL(onboardingLink).searchParams.get("token");
    if (!token) {
      throw new Error("Invitation token not found in onboarding link");
    }

    return {
      invitationToken: token,
      invitedAdminEmail: body.data.email,
    };
  },

  async seedOnboardedAirlineAdmin(
    app: INestApplication,
    options?: { inactive?: boolean; password?: string },
  ): Promise<{ email: string; password: string; userId: number }> {
    const password = options?.password ?? "Password@123";
    const invite = await this.seedAirlineInvite(app);

    const onboardResponse = await requestHelper.post(
      app,
      "/api/v1/auth/airline/onboard",
      {
        invitationToken: invite.invitationToken,
        password,
      },
    );

    const onboardBody = responseHelper.expectSuccess<{
      userId: number;
      email: string;
    }>(onboardResponse, 200);

    if (options?.inactive) {
      await testDbHelper.update(
        app,
        AirlineUserEntity,
        { id: onboardBody.data.userId },
        { isActive: false },
      );
    }

    return {
      email: onboardBody.data.email,
      password,
      userId: onboardBody.data.userId,
    };
  },
};
