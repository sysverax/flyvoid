import { TravelClass } from "../../cancelled-flights/entities/enums";

// Hotel stars per travel class: the minimum is searched for up to the max
// search radius (never below HOTEL_SEARCH_MIN_RATE). Allocation ranks the most
// stars first (5, then 4, ...), the cheapest within the same stars. Hotels
// below the minimum come last: a PNR gets one only when no hotel meeting the
// minimum has rooms left. `preferred` no longer changes the ranking.
export const HOTEL_STARS_BY_CLASS: Record<
  TravelClass,
  { min: number; preferred: number }
> = {
  [TravelClass.FIRST_CLASS]: { min: 5, preferred: 5 },
  [TravelClass.BUSINESS]: { min: 4, preferred: 5 },
  [TravelClass.PREMIUM_ECONOMY]: { min: 3, preferred: 4 },
  [TravelClass.ECONOMY]: { min: 3, preferred: 4 },
};
