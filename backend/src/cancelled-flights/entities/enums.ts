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
  PAID = "paid",
  PUBLISHED = "published",
}

export enum HotelAllocationStatus {
  DRAFT = "draft",
  IN_PROGRESS = "in_progress",
  CONFIRMED = "confirmed",
  FAILED = "failed",
  MANUAL_CHECK = "manual_check",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
}

export enum HotelBookingAttemptStatus {
  PENDING = "pending",
  SUCCESS = "success",
  FAILED = "failed",
  MANUAL_CHECK = "manual_check",
}

export enum HotelBookingFailureCode {
  INVALID_PASSENGER_DATA = "invalid_passenger_data",
  NO_CANDIDATES = "no_candidates",
  MAX_ATTEMPTS = "max_attempts",
  RATE_CHECK_FAILED = "rate_check_failed",
  RATE_MISMATCH = "rate_mismatch",
  MIXED_HOTELS = "mixed_hotels",
  SUPPLIER_REJECTED = "supplier_rejected",
  OUTCOME_UNKNOWN = "outcome_unknown",
  PARTIAL_BOOKING = "partial_booking",
  PROVIDER_UNCONFIRMED = "provider_unconfirmed",
  SAVE_FAILED = "save_failed",
  INTERRUPTED_BEFORE_REQUEST = "interrupted_before_request",
  INTERRUPTED_AFTER_REQUEST = "interrupted_after_request",
}
