import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { WinstonModule } from "nest-winston";
import { winstonModuleOptions } from "./logger.config";
import { RequestIdMiddleware } from "./request-id.middleware";
import { LoggingInterceptor } from "./logging.interceptor";
import { GlobalExceptionFilter } from "./global-exception.filter";

@Global()
@Module({
  imports: [WinstonModule.forRoot(winstonModuleOptions)],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  exports: [WinstonModule],
})
export class LoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
