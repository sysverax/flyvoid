import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { LoggerService } from "../logger/logger.service";

type RequestWithId = Request & { requestId?: string };

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const response = ctx.getResponse<Response>();

    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = exception.message;
    let errors: unknown[] = [];

    if (typeof exceptionResponse === "string") {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null
    ) {
      const responseBody = exceptionResponse as {
        message?: string | string[];
        error?: string;
      };
      if (Array.isArray(responseBody.message)) {
        message = responseBody.message[0] ?? "Request failed";
        errors = responseBody.message;
      } else if (typeof responseBody.message === "string") {
        message = responseBody.message;
      } else if (typeof responseBody.error === "string") {
        message = responseBody.error;
      }
    }

    const requestId = request.requestId ?? "N/A";
    const timestamp = new Date().toISOString();

    this.logger.error(message, "HttpExceptionFilter", requestId, {
      statusCode,
      path: request.url,
      errors,
    });

    response.status(statusCode).json({
      statusCode,
      requestId,
      timestamp,
      path: request.url,
      message,
      errors,
    });
  }
}
