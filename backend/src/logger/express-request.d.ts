import type { Logger } from 'winston';

// Augments Express Request with fields set by RequestIdMiddleware
declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    clientIp?: string;
    logger?: Logger;
  }
}
