import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AirlineEntity } from "../airline/entities/airline.entity";
import { AirportEntity } from "../airline/entities/airport.entity";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { BookingEntity } from "./entities/booking.entity";
import { HotelAllocationEntity } from "./entities/hotel-allocation.entity";
import { CancelledFlightsController } from "./cancelled-flights.controller";
import { CancelledFlightsService } from "./cancelled-flights.service";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";
import { AiService } from "../common/ai/ai.service";
import { HotelPartnerService } from "./hotel-partner.service";

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
    AiService,
    HotelPartnerService,
  ],
  exports: [CancelledFlightsService, AiService, HotelPartnerService],
})
export class CancelledFlightsModule {}
