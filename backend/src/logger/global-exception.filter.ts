import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { BaseResponseDto } from '../common/dto/base-response.dto';
import { BackendRequest } from '../auth/interfaces/authenticated-request.interface';

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'creditCard',
];

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  private isJsonParseError(exception: unknown): boolean {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as any)?.message || '';
      return (
        exception.getStatus() === HttpStatus.BAD_REQUEST &&
        (message.includes('Unexpected token') ||
          message.includes('Unexpected number') ||
          message.includes('Unexpected string') ||
          message.includes('in JSON at position'))
      );
    }
    return exception instanceof SyntaxError;
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<BackendRequest>();
    const res = ctx.getResponse<Response>();

    // Handle JSON parse errors
    const isJsonError = this.isJsonParseError(exception);
    const requestId = req.requestId || '';
    const logger: Logger = req.logger;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isJsonError
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isJsonError
      ? 'Invalid JSON format'
      : exception instanceof HttpException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const stack = exception instanceof Error ? exception.stack : undefined;

    const start = (req as any)['__startTime'] as number | undefined;
    const ms = start ? Date.now() - start : 0;
    const handler = ((req as any)['__handler'] as string) || 'unknown';

    // ── Single structured error log ──
    logger.error(`${req.method} ${req.originalUrl} ${status} ${ms}ms`, {
      requestId,
      handler,
      method: req.method,
      url: req.originalUrl,
      statusCode: status,
      responseTime: `${ms}ms`,
      query: req.query,
      body: this.sanitizeBody(req.body),
      errorMessage: message,
      stack,
      userAgent: req.get('user-agent'),
    });

    // ── Response to client (follows BaseResponseDto shape) ──
    let errorDetail = 'An error occurred';
    let errorSolution = 'Please check your request and try again';
    let errorCode = '';
    let responseMessage = message;

    if (isJsonError) {
      errorDetail =
        'The request body contains invalid JSON. Please check your JSON syntax.';
      errorSolution =
        'Ensure the request body is valid JSON with proper formatting, correct quotes, and no trailing commas.';
    } else if (exception instanceof HttpException) {
      const exRes = exception.getResponse();
      if (typeof exRes === 'object' && exRes !== null) {
        const response = exRes as Record<string, unknown>;

        // Extract error details from the exception response
        if (response.detail || response.solution) {
          errorDetail = (response.detail as string) || errorDetail;
          errorSolution = (response.solution as string) || errorSolution;
          if (typeof response.code === 'string' && response.code.length > 0) {
            errorCode = response.code;
          }
        } else if (response.errors && typeof response.errors === 'object') {
          // Check for nested errors object (validation errors pattern)
          const errors = response.errors as Record<string, unknown>;
          errorDetail = (errors.detail as string) || errorDetail;
          errorSolution = (errors.solution as string) || errorSolution;
          if (typeof errors.code === 'string' && errors.code.length > 0) {
            errorCode = errors.code;
          }
        }
        // else: fall back to the defaults set above

        // Override message if response has specific message array or string
        // But not for JSON parse errors as we want to keep the clean message
        if (!isJsonError) {
          if (response.message && Array.isArray(response.message)) {
            responseMessage = response.message.join(', ');
          } else if (response.message && typeof response.message === 'string') {
            responseMessage = response.message;
          }
        }
      }
    } else {
      errorDetail = 'Internal server error occurred';
      errorSolution = 'Please try again later or contact support';
    }

    const responseBody = BaseResponseDto.error(responseMessage, requestId, {
      detail: errorDetail,
      solution: errorSolution,
      code: errorCode,
    });

    res.status(status).json(responseBody);
  }

  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    if (!body || typeof body !== 'object') return {};
    const sanitized = { ...body };
    for (const field of SENSITIVE_FIELDS) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }
    return sanitized;
  }
}
