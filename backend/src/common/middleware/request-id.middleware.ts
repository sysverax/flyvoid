import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const request = req as RequestWithId;
    const incomingRequestId = req.header("x-request-id");
    const requestId =
      incomingRequestId && incomingRequestId.trim().length > 0
        ? incomingRequestId
        : randomUUID();

    request.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    next();
  }
}
