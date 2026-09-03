import { Module } from "@nestjs/common";
import { HotelBedService } from "./hotel-beds.service";
@Module({
  providers: [HotelBedService],
  exports: [HotelBedService],
})
export class HotelBedModule {}
