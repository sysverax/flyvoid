import { TravelClass } from "../../cancelled-flights/entities/enums";

// Hotel stars per travel class: the minimum is searched for up to the max
// search radius (never below HOTEL_SEARCH_MIN_RATE). Allocation ranks the most
// stars first (5, then 4, ...) down to the minimum, the cheapest within the
// same stars, and never books below it;
// `preferred` no longer changes the ranking.
export const HOTEL_STARS_BY_CLASS: Record<
  TravelClass,
  { min: number; preferred: number }
> = {
  [TravelClass.FIRST_CLASS]: { min: 5, preferred: 5 },
  [TravelClass.BUSINESS]: { min: 4, preferred: 5 },
  [TravelClass.PREMIUM_ECONOMY]: { min: 3, preferred: 4 },
  [TravelClass.ECONOMY]: { min: 3, preferred: 4 },
};
