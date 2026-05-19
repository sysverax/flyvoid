import "reflect-metadata";
import { INestApplication, Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { LoggingInterceptor } from "../../src/common/interceptors/logging.interceptor";
import { LoggerService } from "../../src/common/logger/logger.service";

export const isExternalMode = (): boolean => false;

export const createTestApp = async (): Promise<INestApplication> => {
  const app = await NestFactory.create(AppModule, {
    logger: new Logger(),
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
};
