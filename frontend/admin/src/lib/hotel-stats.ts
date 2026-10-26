import type { HotelAvailabilityHotel } from "@/src/services/hotel-availability.service";

export interface HotelCapacityStats {
  hotels: number;
  /** Rooms the suppliers report as available. */
  rooms: number;
  /** Hotels whose options report rooms available. */
  hotelsWithRooms: number;
  /** Guests those rooms sleep (rooms × max guests per room). */
  passengers: number;
  /** Hotels whose options report both rooms available and max guests. */
  hotelsWithPassengers: number;
}

/**
 * Capacity from what suppliers report. Several rates often sell the same
 * room type (meal plans, cancellation terms), so each room type counts once,
 * with its highest reported availability. Options without the data are skipped.
 */
export function hotelCapacityStats(hotels: HotelAvailabilityHotel[]): HotelCapacityStats {
  const stats: HotelCapacityStats = {
    hotels: hotels.length,
    rooms: 0,
    hotelsWithRooms: 0,
    passengers: 0,
    hotelsWithPassengers: 0,
  };
  for (const hotel of hotels) {
    const byRoomType = new Map<string, { rooms: number; guests: number | null }>();
    for (const option of hotel.options) {
      if (option.roomsAvailable == null || option.roomsAvailable <= 0) continue;
      const key = option.roomType.trim().toLowerCase();
      const current = byRoomType.get(key);
      byRoomType.set(key, {
        rooms: Math.max(current?.rooms ?? 0, option.roomsAvailable),
        guests: option.maxGuests ?? current?.guests ?? null,
      });
    }
    if (byRoomType.size === 0) continue;
    stats.hotelsWithRooms += 1;
    let hotelGuests = 0;
    for (const { rooms, guests } of byRoomType.values()) {
      stats.rooms += rooms;
      if (guests) hotelGuests += rooms * guests;
    }
    if (hotelGuests > 0) {
      stats.passengers += hotelGuests;
      stats.hotelsWithPassengers += 1;
    }
  }
  return stats;
}
