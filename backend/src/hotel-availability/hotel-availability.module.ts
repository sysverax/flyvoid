import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AirportEntity } from "../airline/entities/airport.entity";
import { ProviderEntity } from "../cancelled-flights/entities/provider.entity";
import { CancelledFlightsModule } from "../cancelled-flights/cancelled-flights.module";
import { HotelAvailabilityController } from "./hotel-availability.controller";
import { HotelAvailabilityService } from "./hotel-availability.service";

// Supplier adapters and hotel content come from CancelledFlightsModule, so
// each supplier keeps one instance (and one rate limiter) app-wide.
@Module({
  imports: [
    AuthModule,
    CancelledFlightsModule,
    TypeOrmModule.forFeature([ProviderEntity, AirportEntity]),
  ],
  controllers: [HotelAvailabilityController],
  providers: [HotelAvailabilityService],
})
export class HotelAvailabilityModule {}
