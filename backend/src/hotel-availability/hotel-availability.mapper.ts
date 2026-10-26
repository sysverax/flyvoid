import { distanceKm } from "../common/utils/geo.util";
import { HotelProviderCode } from "../common/constants/hotel-provider.constants";
import {
  AvailabilityHotel,
  AvailabilityRoomRate,
  TaxAtProperty,
} from "../cancelled-flights/hotel-providers/hotel-provider.interface";
import {
  HotelAvailabilityHotelDto,
  HotelAvailabilityOptionDto,
  HotelAvailabilityTaxDto,
} from "./dto/hotel-availability-response.dto";

/** Stored static content we use for a search result (hotels table row). */
export interface StoredHotelContent {
  name?: string | null;
  starRating?: number | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  isActive?: boolean;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toTaxes = (taxes: TaxAtProperty[] | undefined): HotelAvailabilityTaxDto[] =>
  (taxes ?? []).map((tax) => ({
    name: tax.name,
    amount: round2(tax.amount),
    currency: tax.currencyCode,
  }));

/**
 * Free cancellation deadline and the first penalty after it. RateHawk gives
 * the deadline directly (freeCancellationBefore, null = non-refundable);
 * other suppliers only list penalties, which start at the deadline.
 */
export function cancellationOf(rate: AvailabilityRoomRate): {
  freeUntil: string | null;
  penaltyAmount: number | null;
} {
  const penalties = [...(rate.cancellationPolicies ?? [])]
    .filter((policy) => policy.from && Number.isFinite(policy.amount))
    .sort((a, b) => Date.parse(a.from) - Date.parse(b.from));
  const freeUntil =
    rate.freeCancellationBefore !== undefined
      ? rate.freeCancellationBefore
      : (penalties[0]?.from ?? null);
  if (!freeUntil) return { freeUntil: null, penaltyAmount: null };
  const firstPenalty =
    penalties.find((policy) => Date.parse(policy.from) >= Date.parse(freeUntil)) ??
    penalties[0];
  return {
    freeUntil,
    penaltyAmount: firstPenalty ? round2(firstPenalty.amount) : null,
  };
}

/** One supplier rate as a room option; prices are the supplier net price. */
export function toOption(
  rate: AvailabilityRoomRate,
  nights: number,
): HotelAvailabilityOptionDto {
  const totalPrice = round2(rate.netPrice);
  return {
    roomType: rate.roomName,
    mealPlan: rate.boardName,
    maxGuests: rate.maxGuests ?? null,
    pricePerNight: round2(totalPrice / Math.max(1, nights)),
    totalPrice,
    currency: rate.currency,
    taxesIncluded: toTaxes(rate.taxesIncluded),
    taxesAtProperty: toTaxes(rate.taxesAtProperty),
    cancellation: cancellationOf(rate),
    roomsAvailable: rate.allotment ?? null,
    features: rate.features ?? [],
  };
}

/**
 * A supplier hotel as a result row: stored content (name, stars, address,
 * coordinates) wins over search data; options cheapest first. Null when the
 * hotel has no usable rate.
 */
export function toHotelItem(
  hotel: AvailabilityHotel,
  stored: StoredHotelContent | undefined,
  airport: { latitude: number | string; longitude: number | string },
  nights: number,
  providerCode: string,
): HotelAvailabilityHotelDto | null {
  const options = hotel.rates
    .filter((rate) => Number.isFinite(rate.netPrice) && rate.netPrice > 0)
    .map((rate) => toOption(rate, nights))
    .sort((a, b) => a.totalPrice - b.totalPrice);
  if (options.length === 0) return null;

  const latitude = toNumberOrNull(stored?.latitude) ?? toNumberOrNull(hotel.latitude);
  const longitude = toNumberOrNull(stored?.longitude) ?? toNumberOrNull(hotel.longitude);
  const airportLat = toNumberOrNull(airport.latitude);
  const airportLon = toNumberOrNull(airport.longitude);
  const distance =
    latitude !== null && longitude !== null && airportLat !== null && airportLon !== null
      ? distanceKm({ latitude: airportLat, longitude: airportLon }, { latitude, longitude })
      : null;

  // Latest deadline across options: the most flexible way to book this hotel.
  const deadlines = options
    .map((option) => option.cancellation.freeUntil)
    .filter((value): value is string => !!value)
    .sort((a, b) => Date.parse(b) - Date.parse(a));

  const cheapest = options[0];
  const hid =
    providerCode.toLowerCase() === HotelProviderCode.RATEHAWK
      ? toNumberOrNull(hotel.hotelCode)
      : null;
  return {
    hid,
    hotelCode: hotel.hotelCode,
    name: stored?.name || hotel.hotelName,
    stars: toNumberOrNull(stored?.starRating) ?? hotel.stars ?? 0,
    address: stored?.address ?? (hotel.address || null),
    distanceKm: distance,
    currency: cheapest.currency,
    lowestPricePerNight: cheapest.pricePerNight,
    lowestTotalPrice: cheapest.totalPrice,
    freeCancellationUntil: deadlines[0] ?? null,
    options,
  };
}

/** Nearest first (unknown distance last), then cheapest. */
export function compareHotelItems(
  a: HotelAvailabilityHotelDto,
  b: HotelAvailabilityHotelDto,
): number {
  const distanceA = a.distanceKm ?? Number.POSITIVE_INFINITY;
  const distanceB = b.distanceKm ?? Number.POSITIVE_INFINITY;
  return distanceA - distanceB || a.lowestTotalPrice - b.lowestTotalPrice;
}

/** Search radius in config.hotelSearch.unit for a radius given in km. */
export function radiusInUnit(radiusKm: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized === "mi") return radiusKm / 1.609344;
  if (normalized === "m") return radiusKm * 1000;
  return radiusKm;
}

/** A radius in config.hotelSearch.unit, in km. */
export function radiusToKm(radius: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized === "mi") return Math.round(radius * 1.609344);
  if (normalized === "m") return Math.round(radius / 1000);
  return radius;
}
