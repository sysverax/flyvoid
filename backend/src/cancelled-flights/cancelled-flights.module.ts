import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AirlineEntity } from "../airline/entities/airline.entity";
import { AirportEntity } from "../airline/entities/airport.entity";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { BookingEntity } from "./entities/booking.entity";
import { CancelledFlightsController } from "./cancelled-flights.controller";
import { CancelledFlightsService } from "./cancelled-flights.service";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      CancelledFlightEntity,
      BookingEntity,
      AirlineEntity,
      AirportEntity,
    ]),
  ],
  controllers: [CancelledFlightsController],
  providers: [CancelledFlightsService, CancelledFlightsRepository],
  exports: [CancelledFlightsService],
})
export class CancelledFlightsModule {}
