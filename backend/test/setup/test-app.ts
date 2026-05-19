import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { LoggingInterceptor } from "../../src/common/interceptors/logging.interceptor";
import { LoggerService } from "../../src/common/logger/logger.service";

export const isExternalMode = (): boolean =>
  process.env.E2E_USE_RUNNING_APP !== "false";

const getExternalBaseUrl = (): string =>
  process.env.E2E_BASE_URL ??
  `http://127.0.0.1:${process.env.APP_PORT ?? "8080"}`;

export const createTestApp = async (): Promise<INestApplication> => {
  if (!isExternalMode()) {
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

    const logger = app.get(LoggerService);

    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new LoggingInterceptor(logger));
    app.useGlobalFilters(new HttpExceptionFilter(logger));

    await app.init();

    return app;
  }

  const externalBaseUrl = getExternalBaseUrl();

  const externalAdapter = {
    getHttpServer: () => externalBaseUrl,
    close: async () => undefined,
  } as unknown as INestApplication;

  return externalAdapter;
};
