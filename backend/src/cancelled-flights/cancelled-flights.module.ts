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
import { HotelAllocationService } from "./hotel-allocation.service";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";
import { AiService } from "../common/ai/ai.service";
import { HOTEL_PROVIDER } from "./hotel-providers/hotel-provider.interface";
import { hotelProviderRegistration } from "./hotel-providers/hotel-provider.registry";

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
    HotelAllocationService,
    CancelledFlightsRepository,
    AiService,
    hotelProviderRegistration,
  ],
  exports: [
    CancelledFlightsService,
    HotelAllocationService,
    AiService,
    HOTEL_PROVIDER,
  ],
})
export class CancelledFlightsModule {}
