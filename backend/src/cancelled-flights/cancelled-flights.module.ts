import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { AirlineEntity } from "../airline/entities/airline.entity";
import { AirportEntity } from "../airline/entities/airport.entity";
import { CancelledFlightEntity } from "./entities/cancelled-flight.entity";
import { BookingEntity } from "./entities/booking.entity";
import { HotelAllocationOptionEntity } from "./entities/hotel-allocation-option.entity";
import { HotelBookingEntity } from "./entities/hotel-booking.entity";
import { HotelBookingRoomEntity } from "./entities/hotel-booking-room.entity";
import { HotelEntity } from "./entities/hotel.entity";
import { ProviderEntity } from "./entities/provider.entity";
import { SupplierWebhookTokenEntity } from "./entities/supplier-webhook-token.entity";
import { HotelSupplierWebhooksController } from "./hotel-supplier-webhooks.controller";
import { CancelledFlightsController } from "./cancelled-flights.controller";
import { CancelledFlightsService } from "./cancelled-flights.service";
import { HotelAllocationService } from "./hotel-allocation.service";
import { HotelContentService } from "./hotel-content.service";
import { CancelledFlightsRepository } from "./cancelled-flights.repository";
import { AiService } from "../common/ai/ai.service";
import { HOTEL_PROVIDER } from "./hotel-providers/hotel-provider.interface";
import { hotelProviderRegistration } from "./hotel-providers/hotel-provider.registry";
import { PdfService } from "../common/pdf/pdf.service";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      CancelledFlightEntity,
      BookingEntity,
      ProviderEntity,
      HotelEntity,
      HotelAllocationOptionEntity,
      HotelBookingEntity,
      HotelBookingRoomEntity,
      SupplierWebhookTokenEntity,
      AirlineEntity,
      AirportEntity,
    ]),
  ],
  controllers: [CancelledFlightsController, HotelSupplierWebhooksController],
  providers: [
    CancelledFlightsService,
    HotelAllocationService,
    HotelContentService,
    CancelledFlightsRepository,
    AiService,
    hotelProviderRegistration,
    PdfService,
  ],
  exports: [
    CancelledFlightsService,
    HotelAllocationService,
    AiService,
    HOTEL_PROVIDER,
  ],
})
export class CancelledFlightsModule {}
