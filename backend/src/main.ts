import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { LoggerService } from "./common/logger/logger.service";
import { config } from "./config/config";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(LoggerService);

  app.enableCors();
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

  if (config.swagger.enabled) {
    const swaggerDocumentConfig = new DocumentBuilder()
      .setTitle(config.swagger.title)
      .setDescription(config.swagger.description)
      .setVersion(config.swagger.version)
      .addBearerAuth({
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Paste only the access token from signin. Swagger will send it as Authorization: Bearer <token>.",
      }, "access-token")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerDocumentConfig);
    SwaggerModule.setup(config.swagger.path, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.info(
      `Swagger is enabled at /${config.swagger.path}`,
      "Bootstrap",
      "SYSTEM",
    );
  }

  await app.listen(config.app.port);

  logger.info(
    `${config.app.name} is running on port ${config.app.port}`,
    "Bootstrap",
    "SYSTEM",
    { env: config.app.env },
  );
}

bootstrap().catch((error: unknown) => {
  const fallbackLogger = new LoggerService();
  fallbackLogger.error("Application failed to start", "Bootstrap", "SYSTEM", {
    error:
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error,
  });

  process.exit(1);
});
