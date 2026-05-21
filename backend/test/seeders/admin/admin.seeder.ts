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

const createAdmin = async (
  app: INestApplication,
  role: AdminRole,
  isInactive = false,
): Promise<{ id: number; email: string; password: string }> => {
  const payload = adminFactory.buildAdminSignupPayload();
  const response = await requestHelper.post(
    app,
    "/api/v1/auth/admin/signup",
    payload,
  );

  const created = response.body.data;

  await adminAuthSeeder.updateAdmin(app, created.id, {
    role: role !== AdminRole.SUPER_ADMIN ? role : undefined,
    isActive: isInactive ? false : undefined,
  });

  return {
    id: created.id,
    email: created.email,
    password: payload.password,
  };
};

export const adminAuthSeeder = {
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

      // const selectIdToken = usePostgresParams ? "$1" : "?";
      // const updatedAdmin = await directSqlHelper.first<{
      //   id: number;
      //   email: string;
      //   role: string;
      //   is_active: boolean;
      // }>(
      //   app,
      //   `SELECT id, email, role, is_active FROM admins WHERE id = ${selectIdToken}`,
      //   [adminId],
      // );
    }
  },
};
