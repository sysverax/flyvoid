import { INestApplication } from "@nestjs/common";
import request, { Response, Test } from "supertest";

const defaultHeaders = {
  "x-request-id": "e2e-request",
  "content-type": "application/json",
};

export const requestHelper = {
  post(
    app: INestApplication,
    path: string,
    payload: Record<string, unknown> | string,
  ): Test {
    return request(app.getHttpServer())
      .post(path)
      .set(defaultHeaders)
      .send(payload);
  },

  get(app: INestApplication, path: string): Test {
    return request(app.getHttpServer()).get(path).set(defaultHeaders);
  },

  patch(
    app: INestApplication,
    path: string,
    payload: Record<string, unknown> | string,
  ): Test {
    return request(app.getHttpServer())
      .patch(path)
      .set(defaultHeaders)
      .send(payload);
  },

  authorizedPost(
    app: INestApplication,
    path: string,
    payload: Record<string, unknown> | string,
    accessToken: string,
  ): Test {
    return request(app.getHttpServer())
      .post(path)
      .set(defaultHeaders)
      .set("authorization", `Bearer ${accessToken}`)
      .send(payload);
  },

  authorizedGet(
    app: INestApplication,
    path: string,
    accessToken: string,
  ): Test {
    return request(app.getHttpServer())
      .get(path)
      .set(defaultHeaders)
      .set("authorization", `Bearer ${accessToken}`);
  },

  authorizedPatch(
    app: INestApplication,
    path: string,
    payload: Record<string, unknown> | string,
    accessToken: string,
  ): Test {
    return request(app.getHttpServer())
      .patch(path)
      .set(defaultHeaders)
      .set("authorization", `Bearer ${accessToken}`)
      .send(payload);
  },

  async asResponse(test: Test): Promise<Response> {
    return test;
  },
};
