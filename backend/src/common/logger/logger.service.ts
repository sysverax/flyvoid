import { Injectable } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import { createLogger, format, Logger, transports } from "winston";
import { config } from "../../config/config";

type LogMeta = Record<string, unknown>;
type LogLevel = "error" | "warn" | "info" | "debug";

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
} as const;

const supportsColor =
  process.stdout.isTTY &&
  process.env.NO_COLOR !== "1" &&
  process.env.FORCE_COLOR !== "0";

const colorByLevel: Record<LogLevel, string> = {
  error: ANSI.red,
  warn: ANSI.yellow,
  info: ANSI.green,
  debug: ANSI.cyan,
};

function colorize(value: string, color: string): string {
  if (!supportsColor) {
    return value;
  }

  return `${color}${value}${ANSI.reset}`;
}

function buildLogLine(
  input: {
    timestamp?: string;
    level?: string;
    message?: unknown;
    context?: unknown;
    requestId?: unknown;
    meta?: unknown;
    stack?: unknown;
  },
  useColors: boolean,
): string {
  const { timestamp, level, message, context, requestId, meta, stack } = input;

  const normalizedLevel =
    level === "error" ||
    level === "warn" ||
    level === "info" ||
    level === "debug"
      ? level
      : "info";
  const resolvedRequestId =
    typeof requestId === "string" && requestId.trim().length > 0
      ? requestId
      : "N/A";
  const resolvedContext =
    typeof context === "string" && context.trim().length > 0 ? context : "App";
  const metadata =
    meta && typeof meta === "object" && Object.keys(meta as object).length > 0
      ? ` | ${JSON.stringify(meta)}`
      : "";
  const stackMessage = typeof stack === "string" ? ` | ${stack}` : "";
  const levelText = normalizedLevel.toUpperCase();
  const resolvedMessage =
    typeof message === "string" ? message : JSON.stringify(message);

  if (!useColors) {
    return `[${timestamp}] [${resolvedRequestId}] [${levelText}] [${resolvedContext}] ${resolvedMessage}${metadata}${stackMessage}`;
  }

  const timestampToken = colorize(`[${timestamp}]`, ANSI.dim);
  const requestIdToken = colorize(`[${resolvedRequestId}]`, ANSI.cyan);
  const levelToken = colorize(`[${levelText}]`, colorByLevel[normalizedLevel]);
  const contextToken = colorize(`[${resolvedContext}]`, ANSI.magenta);
  const metadataText = metadata.length > 0 ? colorize(metadata, ANSI.dim) : "";
  const stackText =
    stackMessage.length > 0 ? colorize(stackMessage, ANSI.red) : "";

  return `${timestampToken} ${requestIdToken} ${levelToken} ${contextToken} ${resolvedMessage}${metadataText}${stackText}`;
}

function getCurrentDateFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}.log`;
}

@Injectable()
export class LoggerService {
  private readonly logger: Logger;

  constructor() {
    const logDirectory = path.resolve(process.cwd(), "logs");
    const logFilePath = path.join(logDirectory, getCurrentDateFileName());

    fs.mkdirSync(logDirectory, { recursive: true });

    this.logger = createLogger({
      level: config.log.level,
      transports: [
        new transports.Console({
          format: format.combine(
            format.timestamp({ format: () => new Date().toISOString() }),
            format.errors({ stack: true }),
            format.printf((log) => buildLogLine(log, true)),
          ),
        }),
        new transports.File({
          filename: logFilePath,
          format: format.combine(
            format.timestamp({ format: () => new Date().toISOString() }),
            format.errors({ stack: true }),
            format.printf((log) => buildLogLine(log, false)),
          ),
        }),
      ],
    });
  }

  public log(
    message: string,
    context: string,
    requestId?: string,
    meta?: LogMeta,
  ): void {
    this.info(message, context, requestId, meta);
  }

  public info(
    message: string,
    context: string,
    requestId?: string,
    meta?: LogMeta,
  ): void {
    this.logger.log("info", message, { context, requestId, meta });
  }

  public warn(
    message: string,
    context: string,
    requestId?: string,
    meta?: LogMeta,
  ): void {
    this.logger.log("warn", message, { context, requestId, meta });
  }

  public error(
    message: string,
    context: string,
    requestId?: string,
    meta?: LogMeta,
  ): void {
    this.logger.log("error", message, { context, requestId, meta });
  }

  public debug(
    message: string,
    context: string,
    requestId?: string,
    meta?: LogMeta,
  ): void {
    this.logger.log("debug", message, { context, requestId, meta });
  }
}
