import "reflect-metadata";
import { INestApplication } from "@nestjs/common";

export const isExternalMode = (): boolean =>
  process.env.E2E_USE_RUNNING_APP !== "false";

const getExternalBaseUrl = (): string =>
  process.env.E2E_BASE_URL ??
  `http://127.0.0.1:${process.env.APP_PORT ?? "8080"}`;

export const createTestApp = async (): Promise<INestApplication> => {
  const externalBaseUrl = getExternalBaseUrl();

  const externalAdapter = {
    getHttpServer: () => externalBaseUrl,
    close: async () => undefined,
  } as unknown as INestApplication;

  return externalAdapter;
};
