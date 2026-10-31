import { MAX_CHILD_AGE } from "@/src/lib/constants";

/*
 * Booking fields (cancelled flight wizard, step 2): labels, the form's rules
 * and the CSV template. The backend applies the same rules
 * (backend/src/cancelled-flights/dto/create-booking-request.dto.ts and
 * booking-import.ts) and labels (booking-notes.ts) - keep them in step.
 * CSV format: docs/bookings-csv-import.md.
 */

export const TRAVEL_CLASS_LABELS: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first_class: "First Class",
};

/** Preset Special Notes, in the order the form shows them. */
export const SPECIAL_NOTE_PRESETS = [
  "Wheelchair Assistance",
  "Medical Needs",
  "Infant",
  "Late Arrival",
  "Dietary Requirements",
  "Elderly Passenger",
] as const;

export const BOOKING_MESSAGES = {
  childAgeRequired: `Age is required for each child (0-${MAX_CHILD_AGE} years)`,
  childAgeInvalid: `Each child age must be a whole number from 0 to ${MAX_CHILD_AGE}`,
} as const;

// A PNR holds at most 9 passengers (backend MAX_PASSENGERS_PER_PNR default),
// so no more age inputs than that are drawn; the backend rejects the rest.
const MAX_CHILD_AGE_INPUTS = 9;

/** The comma-separated parts of a notes text, trimmed, empty parts dropped. */
export function splitNotes(text?: string | null): string[] {
  return (text ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

const noteKey = (value: string) =>
  value.trim().toLowerCase().replace(/[\s_-]+/g, "_");

/** Whether the notes text already lists this preset as one of its parts. */
export function notesInclude(text: string, preset: string): boolean {
  return splitNotes(text).some((part) => noteKey(part) === noteKey(preset));
}

/** Appends a preset to the notes text, comma-separated, unless already listed. */
export function appendNote(text: string, preset: string): string {
  if (notesInclude(text, preset)) return text;
  const trimmed = text.trim().replace(/,\s*$/, "");
  return trimmed ? `${trimmed}, ${preset}` : preset;
}

/** Error for one child age input, or "" when it is valid. */
export function validateChildAge(value: string): string {
  const v = value.trim();
  if (!v) return BOOKING_MESSAGES.childAgeRequired;
  if (!/^\d+$/.test(v) || Number(v) > MAX_CHILD_AGE) {
    return BOOKING_MESSAGES.childAgeInvalid;
  }
  return "";
}

/** The child age inputs resized to `count`, keeping the ages already entered. */
export function resizeChildAges(ages: string[], count: number): string[] {
  const safeCount =
    Number.isInteger(count) && count > 0
      ? Math.min(count, MAX_CHILD_AGE_INPUTS)
      : 0;
  return Array.from({ length: safeCount }, (_, i) => ages[i] ?? "");
}

// ── CSV template ─────────────────────────────────────────────────────────────

/** Columns in template order. */
export const BOOKING_CSV_HEADERS = [
  "PNR",
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Passport Country",
  "Travel Class",
  "Adults",
  "Children",
  "Child Ages",
  "Special Notes",
];

/** The columns with special rules or fixed values. */
export const BOOKING_CSV_RULES = [
  "Passport Country: country name or 2-letter code, e.g. Sri Lanka or LK.",
  "Travel Class: Economy, Premium Economy, Business or First Class.",
  `Child Ages: one age (0-${MAX_CHILD_AGE}) per child, e.g. 4,9`,
  "Special Notes: optional, e.g. Wheelchair Assistance, Medical Needs",
];

// Child Ages and Special Notes are the last columns, so their commas need no
// quotes: the backend reads as many ages as Children, the rest as notes.
const TEMPLATE_LINES = [
  BOOKING_CSV_HEADERS.join(","),
  "ABC123,John,Doe,john.doe@example.com,+1 555-0101,United States,Economy,2,0,,",
  "XYZ789,Jane,Smith,jane.smith@example.com,+44 20 7946 0958,GB,Premium Economy,2,2,4,9,Wheelchair Assistance, Needs a baby cot",
];

/** Downloads the bookings CSV template (header + two example rows). */
export function downloadBookingCsvTemplate(): void {
  const blob = new Blob([TEMPLATE_LINES.join("\r\n") + "\r\n"], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bookings_template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
