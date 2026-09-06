import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AirlineEntity } from "../airline/entities/airline.entity";
import { AirportEntity } from "../airline/entities/airport.entity";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { BookingEntity } from "./entities/booking.entity";
import { HotelAllocationEntity } from "./entities/hotel-allocation.entity";
import { CancelledFlightsController } from "./cancel-flights.controller";
import { CancelledFlightsService } from "./cancel-flights.service";
import { CancelledFlightsRepository } from "./cancel-flights.repository";
import { GroqService } from "../common/groq/groq.service";
import { HotelPartnerService } from "./hotel-partners.service";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      CancelledFlightEntity,
      BookingEntity,
      HotelAllocationEntity,
      AirlineEntity,
      AirportEntity,
    ]),
  ],
  controllers: [CancelledFlightsController],
  providers: [
    CancelledFlightsService,
    CancelledFlightsRepository,
    GroqService,
    HotelPartnerService,
  ],
  exports: [CancelledFlightsService, GroqService, HotelPartnerService],
})
export class CancelledFlightsModule {}
