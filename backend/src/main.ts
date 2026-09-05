import "reflect-metadata";
import {
  BadRequestException,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import * as bodyParser from "body-parser";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { LoggerService } from "./common/logger/logger.service";
import { config } from "./config/config";
import { ValidationError } from "class-validator";
import { AppLogger } from "./logger";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  
  app.enableCors();
  // const allowedOrigins = config.cors.allowedOrigins
  //   ?.split(",")
  //   .map((origin) => origin.trim())
  //   .filter(Boolean);

  // app.enableCors({
  //   origin: allowedOrigins,
  //   credentials: true,
  // });

  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: true,
  //     transform: true,
  //   }),
  // );

  // ── Global validation pipe ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      validationError: { target: false, value: false },
      exceptionFactory: (validationErrors: ValidationError[]) => {
        const fields = flattenValidationErrors(validationErrors[0]);
        const message = fields.message ? [fields.message] : [];
        const detail = fields.detail || "Request field validation failed";
        const solution = fields.solution || "Fix invalid fields and retry.";
        const code = fields?.code ?? undefined;

        return new BadRequestException({
          message: message,
          detail: detail,
          solution: solution,
          code: code,
        });
      },
    }),
  );

  app.use(bodyParser.json({ limit: "30mb" }));
  app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));

  // ── API prefix ──
  const apiPrefix = config.app.apiPrefix;
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1", // ← any unversioned controller falls back to v1
  });

  if (config.swagger.enabled) {
    const swaggerDocumentConfig = new DocumentBuilder()
      .setTitle(config.swagger.title)
      .setDescription(config.swagger.description)
      .setVersion(config.swagger.version)
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Paste only the access token from signin. Swagger will send it as Authorization: Bearer <token>.",
        },
        "access-token",
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerDocumentConfig);
    SwaggerModule.setup(config.swagger.path, app, document, {
      customSiteTitle: `${config.swagger.title} Docs`,
      jsonDocumentUrl: `${config.swagger.path}/json`,
      yamlDocumentUrl: `${config.swagger.path}/yaml`,
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    AppLogger.info(`Swagger is enabled at /${config.swagger.path}`);
  }

  // ── Process-level error handlers ──
  process.on("unhandledRejection", (reason: unknown) => {
    if (reason instanceof Error) {
      AppLogger.error("Unhandled Rejection", reason);
    } else {
      AppLogger.error("Unhandled Rejection", { reason: String(reason) });
    }
  });

  process.on("uncaughtException", (error: Error) => {
    AppLogger.error("Uncaught Exception", error);
    process.exit(1);
  });

  await app.listen(config.app.port);

  AppLogger.info(`${config.app.name} is running on port ${config.app.port}`, {
    env: config.app.env,
    port: config.app.port,
    name: config.app.name,
  });
}

bootstrap().catch((error: unknown) => {
  if (error instanceof Error) {
    AppLogger.error("Application failed to start", error);
  } else {
    AppLogger.error("Application failed to start", { error });
  }

  process.exit(1);
});

// ── Validation error helper ──
function flattenValidationErrors(
  error: ValidationError,
  parent = "",
): {
  field: string;
  message: string;
  detail?: string;
  solution?: string;
  code?: string;
} {
  let out: {
    field: string;
    message: string;
    detail?: string;
    solution?: string;
    code?: string;
  } = { field: "", message: "" };
  console.log(error);

  const field = parent ? `${parent}.${error.property}` : error.property;

  // // Handle nested validation errors (e.g., company.status)
  if (error.children && error.children.length > 0) {
    return flattenValidationErrors(error.children[0], field);
  }

  let detail;
  let solution;
  let code;

  if (error.constraints) {
    const constraintKeys = Object.keys(error.constraints);
    const firstConstraint = constraintKeys[0];

    const constraintOptions = error.contexts?.[firstConstraint];

    if (constraintOptions) {
      detail = constraintOptions.detail;
      solution = constraintOptions.solution;
      code = constraintOptions?.code ?? undefined;
    }
  }

  const message = error.constraints
    ? Object.values(error.constraints).join(". ")
    : "";

  if (message) {
    out = { field, message, detail, solution, code };
  }

  return out;
}
