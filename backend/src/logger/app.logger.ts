import { winstonInstance } from "./logger.config";

/**
 * AppLogger — singleton, non-request-scoped logger.
 * Use for bootstrap, cron jobs, background tasks, system-level logging.
 *
 * Usage:
 *   import { AppLogger } from 'src/logger/app.logger';
 *   AppLogger.info('Server started');
 *   AppLogger.error('DB failed', error);
 */
export class AppLogger {
  static debug(message: string, meta?: Record<string, unknown>): void {
    winstonInstance.debug(message, meta);
  }

  static info(message: string, meta?: Record<string, unknown>): void {
    winstonInstance.info(message, meta);
  }

  static warn(message: string, meta?: Record<string, unknown>): void {
    winstonInstance.warn(message, meta);
  }

  static error(
    message: string,
    errorOrMeta?: Error | Record<string, unknown>,
  ): void {
    if (errorOrMeta instanceof Error) {
      winstonInstance.error(message, {
        message: errorOrMeta.message,
        name: errorOrMeta.name,
        stack: errorOrMeta.stack,
      });
    } else {
      winstonInstance.error(message, errorOrMeta);
    }
  }
}
