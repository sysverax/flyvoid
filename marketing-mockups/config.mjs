// Every value shown in the mock-ups lives here. All passenger, airline and figure
// data is fictional; flyverax.com and sysverax.com are our own domains.
// These are CONCEPT MOCK-UPS: nothing here sends email or SMS.

// Show the small "Concept preview" label on every exported image and video.
// Override without editing: SHOW_CONCEPT_LABEL=false npm run build
export const SHOW_CONCEPT_LABEL =
  (process.env.SHOW_CONCEPT_LABEL ?? "true").toLowerCase() !== "false";

// Placeholder only. Never replace with a real-looking supplier reference.
export const SUPPLIER_BOOKING_REFERENCE = "BOOKING-REF-123456";

// Values for the {{placeholders}} in templates/*.txt.
export const DATA = {
  airline_name: "SkyLine Airways",
  flight_number: "WA0021",
  cancellation_date: "Nov 26",
  passenger_first_name: "Amelia",
  passenger_last_name: "Martin",
  passenger_email: "amelia.martin@example.com",
  passenger_phone: "+1 555 010 0199",
  hotel_name: "Hotel Bachaumont",
  hotel_city: "Paris",
  checkin_date: "Nov 26",
  checkout_date: "Nov 27",
  supplier_booking_reference: SUPPLIER_BOOKING_REFERENCE,
  // Placeholder path: the real short-link format is not decided yet.
  details_url: "https://flyverax.com/h/7Kq2",

  // Airline invoice (sample figures: 42 x 160.00 = 6,720.00; 10% fee = 672.00)
  invoice_number: "FV-INV-000123",
  booking_count: "42",
  currency: "USD",
  hotel_cost: "6,720.00",
  platform_fee: "672.00",
  total: "7,392.00",
  support_email: "support@flyverax.com",
};

// Senders as they appear on the device (not template placeholders).
// Every notification comes from the product, Flyverax.
export const SENDERS = {
  // Alphanumeric SMS sender IDs are limited to 11 characters.
  sms: "Flyverax",
  email: { name: "Flyverax", address: "notifications@flyverax.com" },
  airlineContact: { name: "SkyLine Airways Finance", address: "finance@skyline-airways.example" },
};

// Lock-screen clock. Nov 26, 2026 is a Thursday.
export const DEVICE = {
  smsTime: "21:46",
  emailTime: "21:52",
  dateLabel: "Thursday, November 26",
};

// Full explainer video: end card.
export const FILM = {
  website: "flyverax.com",
  tagline: "Calm in every disruption",
  cta: "Request a demo",
};

export const BRAND = {
  navy: "#0B1B3F",
  blue: "#0A6CFF",
  cyan: "#00AEEF",
};
