import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Logger } from 'winston';
import { winstonInstance } from '../../logger/logger.config';
import { BackendRequest } from '../../auth/interfaces/authenticated-request.interface';

export const RequestLogger = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Logger => {
    const request = ctx.switchToHttp().getRequest<BackendRequest>();
    return request.logger ?? winstonInstance;
  },
);
