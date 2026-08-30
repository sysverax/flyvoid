export enum CancellationReason {
  WEATHER_DISRUPTION = "weather_disruption",
  TECHNICAL_ISSUE = "technical_issue",
  CREW_UNAVAILABILITY = "crew_unavailability",
  OPERATIONAL_ISSUE = "operational_issue",
  AIR_TRAFFIC_CONTROL = "air_traffic_control",
  OTHER = "other",
}

export enum TravelClass {
  ECONOMY = "economy",
  BUSINESS = "business",
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
