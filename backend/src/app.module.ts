import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AdminModule } from "./admin/admin.module";
import { DatabaseExceptionFilter } from "./common/filters/database-exception.filter";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { LoggerModule } from "./common/logger/logger.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { AirlineModule } from "./airline/airline.module";
import { AirportModule } from "./airline/airport.module";
import { CancelledFlightsModule } from "./cancelled-flights/cancelled-flights.module";
import { HotelBookingsModule } from "./hotel-bookings/hotel-bookings.module";
import { HotelAvailabilityModule } from "./hotel-availability/hotel-availability.module";
import { DashboardModule } from "./dashboard/dashboard.module";

@Module({
  providers: [{ provide: APP_FILTER, useClass: DatabaseExceptionFilter }],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    AdminModule,
    AirlineModule,
    AirportModule,
    CancelledFlightsModule,
    HotelBookingsModule,
    HotelAvailabilityModule,
    DashboardModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
