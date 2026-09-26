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
    apiPrefix: process.env.APP_API_PREFIX ?? "api",
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
    // Queries slower than this are logged as warnings, with their execution
    // time and SQL, regardless of the `logging` flag above.
    slowQueryThresholdMs: parseInt(
      process.env.DB_SLOW_QUERY_THRESHOLD_MS ?? "200",
      10,
    ),
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
    forgotPasswordOtpStatic: process.env.FORGOT_PASSWORD_OTP_STATIC ?? "444444",
    forgotPasswordOtpExpiryMinutes: parseInt(
      process.env.FORGOT_PASSWORD_OTP_EXPIRY_MINUTES ?? "2",
      10,
    ),
    forgotPasswordOtpMaxAttempts: parseInt(
      process.env.FORGOT_PASSWORD_OTP_MAX_ATTEMPTS ?? "5",
      10,
    ),
    forgotPasswordOtpSendLimit: parseInt(
      process.env.FORGOT_PASSWORD_OTP_SEND_LIMIT ?? "3",
      10,
    ),
    forgotPasswordOtpSendWindowMinutes: parseInt(
      process.env.FORGOT_PASSWORD_OTP_SEND_WINDOW_MINUTES ?? "10",
      10,
    ),
    forgotPasswordResetTokenExpiresIn:
      process.env.FORGOT_PASSWORD_RESET_TOKEN_EXPIRES_IN ?? "1h",
    initialPasswordResetTokenExpiresIn:
      process.env.INITIAL_PASSWORD_RESET_TOKEN_EXPIRES_IN ?? "15m",
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
      "http://localhost:3000/auth/onboard",
  },
  ses: {
    region: process.env.AWS_REGION ?? "ap-south-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    fromEmail: process.env.AWS_SES_FROM_EMAIL ?? "noreply@example.com",
  },

  ai: {
    apiKey: process.env.AI_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
    apiUrl:
      process.env.AI_API_URL ??
      "https://api.groq.com/openai/v1/chat/completions",
    temperature: parseFloat(process.env.AI_TEMPERATURE ?? "0.2"),
    // Token budget (rough char/4 estimate) for one hotel-allocation AI
    // call's input; larger flights are split into multiple calls.
    maxInputTokensPerCall: parseInt(
      process.env.AI_MAX_INPUT_TOKENS_PER_CALL ?? "6000",
      10,
    ),
  },

  // Active hotel supplier (HOTEL_PROVIDER) and each supplier's credentials;
  // HOTEL_USE_SANDBOX applies to whichever supplier is active.
  hotelProvider: {
    name: (process.env.HOTEL_PROVIDER || "hotelbeds").trim().toLowerCase(),
    useSandbox: process.env.HOTEL_USE_SANDBOX !== "false",
    hotelbeds: {
      apiKey: process.env.HOTELBEDS_API_KEY ?? "",
      secret: process.env.HOTELBEDS_SECRET ?? "",
    },
    ratehawk: {
      apiKey: process.env.RATEHAWK_API_KEY ?? "",
      userId: process.env.RATEHAWK_USER_ID ?? "",
    },
  },
  hotelSearch: {
    defaultRadius: parseInt(process.env.HOTEL_SEARCH_RADIUS ?? "10", 10),
    unit: process.env.HOTEL_SEARCH_RADIUS_UNIT ?? "km",
    maxRadius: parseInt(process.env.HOTEL_SEARCH_MAX_RADIUS ?? "50", 10),
    minRate: parseFloat(process.env.HOTEL_SEARCH_MIN_RATE ?? "3"), // 3 stars
    isAllowSearchAPI: true,
    isAllowFetchHotelDetails: true,
  },
  platformFeePercentage: parseFloat(
    process.env.PLATFORM_FEE_PERCENTAGE ?? "10",
  ),
} as const;
