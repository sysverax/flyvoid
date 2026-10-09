import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { HotelAllocationEntity } from "../cancelled-flights/entities/hotel-allocation.entity";
import { BookingEntity } from "../cancelled-flights/entities/booking.entity";
import { CancelledFlightEntity } from "../cancelled-flights/entities/cancelled-flight.entity";
import { AirlineEntity } from "../airline/entities/airline.entity";
import { AirportEntity } from "../airline/entities/airport.entity";
import { HotelBookingsController } from "./hotel-bookings.controller";
import { HotelBookingsService } from "./hotel-bookings.service";
import { HotelBookingsRepository } from "./hotel-bookings.repository";
import { PdfService } from "../common/pdf/pdf.service";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      HotelAllocationEntity,
      BookingEntity,
      CancelledFlightEntity,
      AirlineEntity,
      AirportEntity,
    ]),
  ],
  controllers: [HotelBookingsController],
  providers: [HotelBookingsService, HotelBookingsRepository, PdfService],
})
export class HotelBookingsModule {}
