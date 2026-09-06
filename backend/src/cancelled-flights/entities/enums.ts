export enum CancellationReason {
  WEATHER_DISRUPTION = "weather_disruption",
  TECHNICAL_ISSUE = "technical_issue",
  CREW_UNAVAILABILITY = "crew_unavailability",
  OPERATIONAL_ISSUE = "operational_issue",
  AIR_TRAFFIC_CONTROL = "air_traffic_control",
  OTHER = "other",
}

export enum TravelClass {
  FIRST_CLASS = "first_class",
  BUSINESS = "business",
  PREMIUM_ECONOMY = "premium_economy",
  ECONOMY = "economy",
}

export enum SpecialNote {
  WHEELCHAIR_ASSISTANCE = "wheelchair_assistance",
  MEDICAL_NEEDS = "medical_needs",
  INFANT = "infant",
  LATE_ARRIVAL = "late_arrival",
  DIETARY_REQUIREMENTS = "dietary_requirements",
  ELDERLY_PASSENGER = "elderly_passenger",
}

export enum FlightStatus {
  DRAFT = "draft",
  IN_PROGRESS = "in_progress",
  PASSENGERS_BOOKING_CONFIRMED = "passengers_booking_confirmed",
  HOTEL_ALLOCATION_IN_PROGRESS = "hotel_allocation_in_progress",
  ALLOCATED = "allocated",
  PUBLISHED = "published",
}

export enum HotelAllocationStatus {
  DRAFT = "draft",
  IN_PROGRESS = "in_progress",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
}
