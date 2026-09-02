import * as dotenv from "dotenv";

const envFileByCommand: Record<string, string> = {
  dev: ".env.local",
  "start:dev": ".env.dev",
  "start:test": ".env.test",
  "start:e2e": ".env.automation_test",
  "test:e2e": ".env.automation_test",
  "test:e2e:auth": ".env.automation_test",
  "test:e2e:admin-auth": ".env.automation_test",
  start: ".env.prod",
  "start:prod": ".env.prod",
};

const lifecycleEvent = process.env.npm_lifecycle_event ?? "";
const selectedEnvFile = envFileByCommand[lifecycleEvent] ?? ".env";

dotenv.config({ path: selectedEnvFile, quiet: true });

export const config = {
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS ?? "",
  },
  app: {
    port: parseInt(process.env.APP_PORT ?? "3000", 10),
    name: process.env.APP_NAME ?? "backend",
    env: process.env.NODE_ENV ?? "development",
  },
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    username: process.env.DB_USERNAME ?? "postgres",
    password: process.env.DB_PASSWORD ?? "postgres",
    name: process.env.DB_NAME ?? "my_backend_db",
    simulate: process.env.DB_SIMULATE === "true",
    mode: process.env.DB_MODE ?? "development",
    synchronize: process.env.DB_SYNCHRONIZE === "true",
    logging: process.env.DB_LOGGING === "true",
    ssl: process.env.DB_SSL === "true",
  },
  log: {
    logging: process.env.APP_LOGGING === "true",
    level: process.env.LOG_LEVEL ?? "debug",
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED === "true",
    path: process.env.SWAGGER_PATH ?? "docs",
    title: process.env.SWAGGER_TITLE ?? "API",
    description: process.env.SWAGGER_DESCRIPTION ?? "API documentation",
    version: process.env.SWAGGER_VERSION ?? "1.0",
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },
  auth: {
    adminForgotPasswordOtpStatic:
      process.env.ADMIN_FORGOT_PASSWORD_OTP_STATIC ?? "444444",
    adminForgotPasswordOtpExpiryMinutes: parseInt(
      process.env.ADMIN_FORGOT_PASSWORD_OTP_EXPIRY_MINUTES ?? "2",
      10,
    ),
    adminForgotPasswordOtpMaxAttempts: parseInt(
      process.env.ADMIN_FORGOT_PASSWORD_OTP_MAX_ATTEMPTS ?? "5",
      10,
    ),
    adminForgotPasswordOtpSendLimit: parseInt(
      process.env.ADMIN_FORGOT_PASSWORD_OTP_SEND_LIMIT ?? "3",
      10,
    ),
    adminForgotPasswordOtpSendWindowMinutes: parseInt(
      process.env.ADMIN_FORGOT_PASSWORD_OTP_SEND_WINDOW_MINUTES ?? "10",
      10,
    ),
    adminForgotPasswordResetTokenExpiresIn:
      process.env.ADMIN_FORGOT_PASSWORD_RESET_TOKEN_EXPIRES_IN ?? "1h",
    adminInitialPasswordResetTokenExpiresIn:
      process.env.ADMIN_INITIAL_PASSWORD_RESET_TOKEN_EXPIRES_IN ?? "15m",
    twoFactorIssuer: process.env.TWO_FACTOR_ISSUER ?? "Flyvoid Admin",
    twoFactorChallengeTokenExpiresIn:
      process.env.TWO_FACTOR_CHALLENGE_TOKEN_EXPIRES_IN ?? "5m",
    twoFactorEncryptionKey:
      process.env.TWO_FACTOR_ENCRYPTION_KEY ??
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    twoFactorOtpWindow: parseInt(process.env.TWO_FACTOR_OTP_WINDOW ?? "1", 10),
    airlineAdminInviteExpiresIn:
      process.env.AIRLINE_ADMIN_INVITE_EXPIRES_IN ?? "48h",
    airlineAdminOnboardingBaseUrl:
      process.env.AIRLINE_ADMIN_ONBOARDING_BASE_URL ??
      "http://localhost:3000/airline/onboard",
  },
  ses: {
    region: process.env.AWS_REGION ?? "ap-south-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    fromEmail: process.env.AWS_SES_FROM_EMAIL ?? "noreply@example.com",
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? "",
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  },
  hotelbeds: {
    apiKey: process.env.HOTELBEDS_API_KEY ?? "",
    secret: process.env.HOTELBEDS_SECRET ?? "",
    useSandbox: process.env.HOTELBEDS_USE_SANDBOX !== "false",
  },
} as const;
