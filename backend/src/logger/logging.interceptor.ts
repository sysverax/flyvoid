import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { Request, Response } from "express";
import { Logger } from "winston";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl, requestId, clientIp } = req;
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    const start = Date.now();

    // Store start time for exception filter to use
    (req as any)["__startTime"] = start;
    (req as any)["__handler"] = handler;

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.info(`${method} ${originalUrl} ${res.statusCode} ${ms}ms`, {
          requestId,
          clientIp,
          handler,
          method,
          url: originalUrl,
          statusCode: res.statusCode,
          responseTime: `${ms}ms`,
          contentLength: res.get("content-length") || "-",
          userAgent: req.get("user-agent"),
        });
      }),
    );
  }
}
