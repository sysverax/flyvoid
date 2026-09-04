import * as path from 'path';
import * as winston from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import { config } from '../config/config';

const logDir = path.join(process.cwd(), 'logs');
const isProd = config.app.env === 'prod';

// ── Shared format (always includes stack traces) ──
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
);

const jsonFormat = winston.format.combine(baseFormat, winston.format.json());

// ── Daily rotate: application log ──
const appRotate = new DailyRotateFile({
  dirname: logDir,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
});

// ── Daily rotate: error-only log ──
const errorRotate = new DailyRotateFile({
  dirname: logDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
});

// ── Exception handler file ──
const exceptionRotate = new DailyRotateFile({
  dirname: logDir,
  filename: 'exceptions-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
});

// ── Rejection handler file ──
const rejectionRotate = new DailyRotateFile({
  dirname: logDir,
  filename: 'rejections-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
});

// ── Console transport (dev only) ──
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    nestWinstonModuleUtilities.format.nestLike('Milta', {
      prettyPrint: true,
      colors: true,
    }),
  ),
});

// ── Exported Winston instance options ──
export const winstonModuleOptions: winston.LoggerOptions = {
  level: isProd ? 'info' : 'debug',
  transports: [appRotate, errorRotate, ...(isProd ? [] : [consoleTransport])],
  exceptionHandlers: [exceptionRotate],
  rejectionHandlers: [rejectionRotate],
};

// ── Standalone Winston instance for AppLogger (non-request, system-level) ──
export const winstonInstance = winston.createLogger(winstonModuleOptions);
