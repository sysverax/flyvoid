import { INestApplication } from "@nestjs/common";
import { AirlineUserEntity } from "../../../src/airline/entities/airline-user.entity";
import { authHelper } from "../../helpers/auth.helper";
import { requestHelper } from "../../helpers/request.helper";
import { responseHelper } from "../../helpers/response.helper";
import { testDbHelper } from "../../database/db.helper";
import { directSqlHelper } from "../../database/direct-sql.helper";

export interface AirlineData {
  id: number;
  name: string;
  code: string;
  company_registration_number: string;
  website?: string;
  contact_email: string;
  contact_phone: string;
  timezone: string;
  currency: string;
  address: string;
  logo?: string;
}

export interface AirlineUserData {
  id: number;
  airline_id: number;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  role: string;
  is_active: boolean;
}

export interface AirlineInvitationData {
  id: number;
  airline_id: number;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  expires_at: Date;
}

export const airlineSeeder = {
  async findAirlineById(
    app: INestApplication,
    airlineId: number,
  ): Promise<AirlineData> {
    const dataSource = directSqlHelper.getDataSource(app);
    const usePostgresParams = dataSource.options.type === "postgres";
    const parameter = (index: number): string =>
      usePostgresParams ? `$${index + 1}` : "?";

    const query = `SELECT * FROM airlines WHERE id = ${parameter(0)}`;
    const result = await dataSource.query(query, [airlineId]);

    return result[0] as AirlineData;
  },

  async findAirlineUserById(
    app: INestApplication,
    airlineUserId: number,
  ): Promise<AirlineUserData> {
    const dataSource = directSqlHelper.getDataSource(app);
    const usePostgresParams = dataSource.options.type === "postgres";
    const parameter = (index: number): string =>
      usePostgresParams ? `$${index + 1}` : "?";

    const query = `SELECT * FROM airline_users WHERE id = ${parameter(0)}`;
    const result = await dataSource.query(query, [airlineUserId]);

    return result[0] as AirlineUserData;
  },

  async findAirlineInvitationById(
    app: INestApplication,
    invitationId: number,
  ): Promise<AirlineInvitationData> {
    const dataSource = directSqlHelper.getDataSource(app);
    const usePostgresParams = dataSource.options.type === "postgres";
    const parameter = (index: number): string =>
      usePostgresParams ? `$${index + 1}` : "?";

    const query = `SELECT * FROM airline_admin_invites WHERE id = ${parameter(0)}`;
    const result = await dataSource.query(query, [invitationId]);

    return result[0] as AirlineInvitationData;
  },

  async updateAirlineInvitationExpiresAt(
    app: INestApplication,
    invitationId: number,
    expiresAt: Date,
  ): Promise<void> {
    const dataSource = directSqlHelper.getDataSource(app);
    const usePostgresParams = dataSource.options.type === "postgres";
    const parameter = (index: number): string =>
      usePostgresParams ? `$${index + 1}` : "?";

    const query = `UPDATE airline_admin_invites SET expires_at = ${parameter(0)}::timestamp WITHOUT TIME ZONE WHERE id = ${parameter(1)}`;
    await dataSource.query(query, [expiresAt, invitationId]);
  },
};
