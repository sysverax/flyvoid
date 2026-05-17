import { INestApplication } from "@nestjs/common";
import { requestHelper } from "./request.helper";
import { responseHelper } from "./response.helper";

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  adminId: number;
  email: string;
}

export interface AirlineSession {
  accessToken: string;
  refreshToken: string;
  userId: number;
  email: string;
}

export const authHelper = {
  async signinAdmin(
    app: INestApplication,
    payload: { email: string; password: string },
  ): Promise<AdminSession> {
    const response = await requestHelper.post(
      app,
      "/api/v1/auth/admin/signin",
      payload,
    );

    const body = responseHelper.expectSuccess<{
      accessToken: string;
      refreshToken: string;
      admin: { id: number; email: string };
    }>(response, 200);

    return {
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
      adminId: body.data.admin.id,
      email: body.data.admin.email,
    };
  },

  async signupAdmin(
    app: INestApplication,
    payload: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    },
  ): Promise<{ id: number; email: string; role: string }> {
    const response = await requestHelper.post(
      app,
      "/api/v1/auth/admin/signup",
      payload,
    );
    const body = responseHelper.expectSuccess<{
      id: number;
      email: string;
      role: string;
    }>(response, 201);

    return body.data;
  },

  async signinAirline(
    app: INestApplication,
    payload: { email: string; password: string },
  ): Promise<AirlineSession> {
    const response = await requestHelper.post(
      app,
      "/api/v1/auth/airline/signin",
      payload,
    );

    const body = responseHelper.expectSuccess<{
      accessToken: string;
      refreshToken: string;
      user: { id: number; email: string };
    }>(response, 200);

    return {
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
      userId: body.data.user.id,
      email: body.data.user.email,
    };
  },
};
