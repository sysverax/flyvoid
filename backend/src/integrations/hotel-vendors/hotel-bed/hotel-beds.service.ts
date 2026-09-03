import { Injectable } from "@nestjs/common";
import { config } from "../../../config/config";
import { Hotel, HotelVendorInterface } from "../hotel-vendor.interface";

@Injectable()
export class HotelBedService implements HotelVendorInterface {
  constructor() {}
  async getHotels(): Promise<Hotel[]> {
    const tempHotel: Hotel = { id: "test", name: "test" };
    return [tempHotel];
  }
}
