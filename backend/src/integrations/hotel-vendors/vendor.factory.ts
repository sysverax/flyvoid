import { BadRequestException, Injectable } from "@nestjs/common";
import { HotelBedService } from "./hotel-bed/hotel-beds.service";
import { HOTEL_VENDORS } from "../../common/constants/app.constants";
import { HotelVendorInterface } from "./hotel-vendor.interface";

@Injectable()
export class VendorFactory {
  constructor(private readonly hotelBed: HotelBedService) {}

  create(provider: keyof typeof HOTEL_VENDORS): HotelVendorInterface {
    switch (provider) {
      case HOTEL_VENDORS.HOTEL_BED:
        return this.hotelBed;
      default:
        throw new BadRequestException(`Unsupported hotel vendor: ${provider}`);
    }
  }
}
