import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { Request, Response } from "express";
import { LoggerService } from "../logger/logger.service";

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<RequestWithId>();
    const res = httpCtx.getResponse<Response>();
    const requestId = req.requestId;
    const method = req.method;
    const url = req.originalUrl || req.url;

    this.logger.info("Incoming request", "HTTP", requestId, {
      method,
      url,
      timestamp: new Date(now).toISOString(),
    });

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - now;
        this.logger.info("Outgoing response", "HTTP", requestId, {
          method,
          url,
          statusCode: res.statusCode,
          durationMs,
        });
      }),
      catchError((error: unknown) => {
        const durationMs = Date.now() - now;
        const statusCode =
          typeof error === "object" && error !== null && "status" in error
            ? (error as { status?: number }).status
            : res.statusCode;

        this.logger.error("Request failed", "HTTP", requestId, {
          method,
          url,
          statusCode,
          durationMs,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : { message: "Unknown error" },
        });

        return throwError(() => error);
      }),
    );
  }
}
