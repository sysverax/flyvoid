import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AdminEntity } from "../../../src/admin/entities/admin.entity";
import { AirlineUserEntity } from "../../../src/airline/entities/airline-user.entity";
import { AdminRole } from "../../../src/common/constants/user.constants";
import { adminFactory } from "../../factories/admin.factory";
import { airlineFactory } from "../../factories/airline.factory";
import { authHelper } from "../../helpers/auth.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { isExternalMode } from "../../setup/test-app";

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
  inactiveAdmin: {
    id: number;
    email: string;
    password: string;
  };
}

const createAdmin = async (
  app: INestApplication,
  role: AdminRole,
  isInactive = false,
): Promise<{ id: number; email: string; password: string }> => {
  const payload = adminFactory.buildAdminSignupPayload();
  const created = await authHelper.signupAdmin(app, payload);

  if (!isExternalMode()) {
    const dataSource = app.get(DataSource);
    const updates: Partial<AdminEntity> = {};

    if (role !== AdminRole.SUPER_ADMIN) {
      updates.role = role;
    }

    if (isInactive) {
      updates.isActive = false;
    }

    if (Object.keys(updates).length > 0) {
      await dataSource
        .getRepository(AdminEntity)
        .update({ id: created.id }, updates);
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
    const inactiveAdmin = await this.seedInactiveAdmin(app);

    return {
      superAdmin,
      staffAdmin,
      inactiveAdmin,
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

  async seedInactiveAdmin(
    app: INestApplication,
  ): Promise<{ id: number; email: string; password: string }> {
    return await createAdmin(app, AdminRole.STAFF, true);
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
      if (!isExternalMode()) {
        const dataSource = app.get(DataSource);
        await dataSource
          .getRepository(AirlineUserEntity)
          .update({ id: onboardBody.data.userId }, { isActive: false });
      }
    }

    return {
      email: onboardBody.data.email,
      password,
      userId: onboardBody.data.userId,
    };
  },
};
