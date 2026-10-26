import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { CancelledFlightsModule } from "../cancelled-flights/cancelled-flights.module";
import { HotelBookingEntity } from "../cancelled-flights/entities/hotel-booking.entity";
import { BookingEntity } from "../cancelled-flights/entities/booking.entity";
import { CancelledFlightEntity } from "../cancelled-flights/entities/cancelled-flight.entity";
import { AirlineEntity } from "../airline/entities/airline.entity";
import { AirportEntity } from "../airline/entities/airport.entity";
import { ProviderEntity } from "../cancelled-flights/entities/provider.entity";
import { HotelBookingsController } from "./hotel-bookings.controller";
import { HotelProvidersController } from "./hotel-providers.controller";
import { HotelBookingsService } from "./hotel-bookings.service";
import { HotelBookingsRepository } from "./hotel-bookings.repository";
import { PdfService } from "../common/pdf/pdf.service";

@Module({
  imports: [
    AuthModule,
    CancelledFlightsModule,
    TypeOrmModule.forFeature([
      HotelBookingEntity,
      BookingEntity,
      CancelledFlightEntity,
      AirlineEntity,
      AirportEntity,
      ProviderEntity,
    ]),
  ],
  controllers: [HotelBookingsController, HotelProvidersController],
  providers: [HotelBookingsService, HotelBookingsRepository, PdfService],
})
export class HotelBookingsModule {}
