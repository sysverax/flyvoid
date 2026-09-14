import { Type } from "@nestjs/common";
import { getSchemaPath } from "@nestjs/swagger";
import { BaseResponseDto } from "../dto/base-response.dto";

export const REQUEST_ID_EXAMPLE = "0b6c7c87-57d7-4b8f-92eb-4b3442784b3b";
export const TIMESTAMP_EXAMPLE = "2026-01-01T10:00:00.000Z";

export const REQUEST_ID_HEADER_SCHEMA = {
  description: "Request trace identifier",
  schema: { type: "string", example: REQUEST_ID_EXAMPLE },
};

type ErrorSchemaInput = {
  statusCode: number;
  path: string;
  message: string;
  errorsExample?: string[];
};

export function createErrorSchema(input: ErrorSchemaInput) {
  return {
    type: "object",
    properties: {
      statusCode: { type: "number", example: input.statusCode },
      requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
      timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
      path: { type: "string", example: input.path },
      message: { type: "string", example: input.message },
      errors: {
        type: "array",
        items: { type: "string" },
        example: input.errorsExample ?? [],
      },
    },
  };
}

export function createBadRequestErrorSchema(path: string) {
  return createErrorSchema({
    statusCode: 400,
    path,
    message: "Bad Request",
    errorsExample: [
      "email must be an email",
      "password must be longer than or equal to 8 characters",
    ],
  });
}

export function createUnauthorizedErrorSchema(path: string, message: string) {
  return createErrorSchema({
    statusCode: 401,
    path,
    message,
    errorsExample: [],
  });
}

export function createForbiddenErrorSchema(path: string, message: string) {
  return createErrorSchema({
    statusCode: 403,
    path,
    message,
    errorsExample: [],
  });
}

export function createNotFoundErrorSchema(path: string, message: string) {
  return createErrorSchema({
    statusCode: 404,
    path,
    message,
    errorsExample: [],
  });
}

export function createConflictErrorSchema(path: string, message: string) {
  return createErrorSchema({
    statusCode: 409,
    path,
    message,
    errorsExample: [],
  });
}

/**
 * Success response schema wrapping BaseResponseDto — `dataDto` is the
 * response's `data` shape, or `null` for endpoints with no data payload.
 * `path` is accepted for call-site symmetry with the error-schema helpers
 * above but isn't part of the success envelope, so it's unused here.
 */
export function createSuccessResponseSchema(
  path: string,
  dataDto: Type<unknown> | null,
) {
  return {
    allOf: [
      { $ref: getSchemaPath(BaseResponseDto) },
      {
        properties: {
          success: { type: "boolean", example: true },
          requestId: { type: "string", example: REQUEST_ID_EXAMPLE },
          timestamp: { type: "string", example: TIMESTAMP_EXAMPLE },
          message: { type: "string", example: "Request successful" },
          data: dataDto
            ? { $ref: getSchemaPath(dataDto) }
            : { type: "null", nullable: true, example: null },
        },
      },
    ],
  };
}
