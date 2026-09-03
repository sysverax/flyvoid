export interface Hotel {
  id: string;
  name: string;
}

export interface HotelVendorInterface {
  getHotels(): Promise<Hotel[]>;
}
