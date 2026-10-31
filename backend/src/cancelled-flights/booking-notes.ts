import { SpecialNote, TravelClass } from "./entities/enums";

/**
 * Display labels. The airline portal shows the same labels
 * (frontend/airline/src/lib/booking-fields.ts) - keep them in step.
 */
export const SPECIAL_NOTE_LABELS: Record<SpecialNote, string> = {
  [SpecialNote.WHEELCHAIR_ASSISTANCE]: "Wheelchair Assistance",
  [SpecialNote.MEDICAL_NEEDS]: "Medical Needs",
  [SpecialNote.INFANT]: "Infant",
  [SpecialNote.LATE_ARRIVAL]: "Late Arrival",
  [SpecialNote.DIETARY_REQUIREMENTS]: "Dietary Requirements",
  [SpecialNote.ELDERLY_PASSENGER]: "Elderly Passenger",
};

export const TRAVEL_CLASS_LABELS: Record<TravelClass, string> = {
  [TravelClass.ECONOMY]: "Economy",
  [TravelClass.PREMIUM_ECONOMY]: "Premium Economy",
  [TravelClass.BUSINESS]: "Business",
  [TravelClass.FIRST_CLASS]: "First Class",
};

// "Premium Economy", "premium_economy" and "PREMIUM-ECONOMY" share one key.
const matchKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s_-]+/g, "_");

function enumByCodeOrLabel<T extends string>(
  labels: Record<T, string>,
): Map<string, T> {
  const index = new Map<string, T>();
  for (const [code, label] of Object.entries(labels) as [T, string][]) {
    index.set(matchKey(code), code);
    index.set(matchKey(label), code);
  }
  return index;
}

const TRAVEL_CLASS_INDEX = enumByCodeOrLabel(TRAVEL_CLASS_LABELS);
const SPECIAL_NOTE_INDEX = enumByCodeOrLabel(SPECIAL_NOTE_LABELS);

/** A travel class from its code or label, any case; null when it is neither. */
export function parseTravelClass(value: string): TravelClass | null {
  return TRAVEL_CLASS_INDEX.get(matchKey(value)) ?? null;
}

/** A preset note from its code or label, any case; null when it is neither. */
export function parseSpecialNote(value: string): SpecialNote | null {
  return SPECIAL_NOTE_INDEX.get(matchKey(value)) ?? null;
}

/** The comma-separated parts of a notes text, trimmed, empty parts dropped. */
export function splitNotes(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Trimmed notes text, or null when it is empty. */
export function normalizeNotes(text: string | null | undefined): string | null {
  const trimmed = (text ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The preset notes a notes text lists. Only a whole comma-separated part that
 * is a preset's label or code counts ("Wheelchair Assistance" does, "needs a
 * wheelchair" does not), so free text never turns into a preset by accident.
 */
export function deriveSpecialNotes(
  text: string | null | undefined,
): SpecialNote[] {
  const notes: SpecialNote[] = [];
  for (const part of splitNotes(text)) {
    const note = parseSpecialNote(part);
    if (note && !notes.includes(note)) notes.push(note);
  }
  return notes;
}
