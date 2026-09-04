import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { winstonInstance } from "./logger.config";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    req.requestId = requestId;

    // Extract real client IP behind proxies
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const first = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(",")[0];
      req.clientIp = first.trim();
    } else {
      const realIp = req.headers["x-real-ip"];
      req.clientIp = realIp
        ? Array.isArray(realIp)
          ? realIp[0]
          : realIp
        : req.ip || req.socket?.remoteAddress || "unknown";
    }

    // Attach a child logger that auto-includes requestId + clientIp
    req.logger = winstonInstance.child({
      requestId,
      clientIp: req.clientIp,
    });

    res.setHeader("x-request-id", requestId);
    next();
  }
}
