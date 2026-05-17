import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

type RequestWithId = Request & { requestId?: string };

export const RequestId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithId>();
    return request.requestId ?? "N/A";
  },
);
