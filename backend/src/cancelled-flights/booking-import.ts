import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { toCountryCode } from "./passport-country";
import {
  SPECIAL_NOTE_LABELS,
  normalizeNotes,
  parseSpecialNote,
  parseTravelClass,
  splitNotes,
} from "./booking-notes";
import { MAX_CHILD_AGE } from "./cancelled-flights.constants";
import {
  BOOKING_MESSAGES,
  CreateBookingDto,
} from "./dto/create-booking-request.dto";
import { TravelClass } from "./entities/enums";

/*
 * Bookings CSV import (wizard step 2). Each row is checked on its own with the
 * same rules as the API (CreateBookingDto + bookingRuleErrors). A bad row never
 * stops the others: it comes back with its errors and is kept as a failed
 * booking. Only a problem with the file itself (no header, unknown or missing
 * columns, no rows) rejects the whole file.
 * Format: docs/bookings-csv-import.md.
 */

export type BookingField =
  | "pnr"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "residency"
  | "travelClass"
  | "adults"
  | "children"
  | "childAges"
  | "specialNotes";

export interface BookingFieldError {
  /** The field the message is about; null when it is about the whole row. */
  field: BookingField | null;
  message: string;
}

/**
 * A row's values as text, so a failed row can be shown and edited as it was.
 * Values that parsed are normalised (passport country as its code, travel
 * class as its enum value); others stay exactly as in the file.
 */
export interface FailedBookingValues {
  pnr: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  residency: string;
  travelClass: string;
  adults: string;
  children: string;
  childAges: string[];
  specialNotes: string;
}

/** A valid row, ready to save. */
export interface ImportedBooking {
  pnr: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  residency: string;
  travelClass: TravelClass;
  adults: number;
  children: number;
  childAges: number[];
  /** Special Notes text; null when empty. */
  specialNotes: string | null;
}

export interface ParsedBookingRow {
  /** Row in the file, header = row 1 (as a spreadsheet numbers it). */
  rowNumber: number;
  values: FailedBookingValues;
  errors: BookingFieldError[];
  /** Set only when the row has no errors. */
  booking: ImportedBooking | null;
}

/** The file itself can't be read as a bookings CSV; nothing is imported. */
export class BookingCsvFormatError extends Error {}

type CsvColumn = BookingField | "additionalNotes";

interface ColumnSpec {
  key: CsvColumn;
  header: string;
  required: boolean;
}

/** Columns in template order. Headers match by name, any case or spacing. */
export const BOOKING_CSV_COLUMNS: ColumnSpec[] = [
  { key: "pnr", header: "PNR", required: true },
  { key: "firstName", header: "First Name", required: true },
  { key: "lastName", header: "Last Name", required: true },
  { key: "email", header: "Email", required: true },
  { key: "phone", header: "Phone", required: true },
  { key: "residency", header: "Passport Country", required: true },
  { key: "travelClass", header: "Travel Class", required: true },
  { key: "adults", header: "Adults", required: true },
  { key: "children", header: "Children", required: true },
  { key: "childAges", header: "Child Ages", required: false },
  { key: "specialNotes", header: "Special Notes", required: false },
  // Older files: Special Notes held preset codes only, free text went here.
  { key: "additionalNotes", header: "Additional Notes", required: false },
];

const FIELD_LABELS: Record<BookingField, string> = {
  pnr: "PNR",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  residency: "Passport Country",
  travelClass: "Travel Class",
  adults: "Adults",
  children: "Children",
  childAges: "Child Ages",
  specialNotes: "Special Notes",
};

const headerKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const COLUMN_BY_HEADER = new Map(
  BOOKING_CSV_COLUMNS.map((column) => [headerKey(column.header), column]),
);

const WHOLE_NUMBER = /^\d+$/;

/**
 * Business rules on top of the field rules, shared by the API, the CSV import
 * and fixing a failed row.
 */
export function bookingRuleErrors(
  booking: { adults: number; children: number; childAges: number[] },
  maxPassengersPerPnr: number,
): BookingFieldError[] {
  const errors: BookingFieldError[] = [];
  const passengers = booking.adults + booking.children;
  if (passengers > maxPassengersPerPnr) {
    errors.push({
      field: "adults",
      message: `A PNR can have at most ${maxPassengersPerPnr} passengers (adults and children combined); this one has ${passengers}. Split larger groups across separate PNRs.`,
    });
  }
  if (booking.childAges.length !== booking.children) {
    errors.push({
      field: "childAges",
      message: `Age is required for each child (0-${MAX_CHILD_AGE} years): ${booking.children} ${booking.children === 1 ? "child" : "children"}, ${booking.childAges.length} ${booking.childAges.length === 1 ? "age" : "ages"} given`,
    });
  }
  return errors;
}

/**
 * Field errors from class-validator, one per field. With stopAtFirstError each
 * property carries only its first failed rule.
 */
function validateBookingDto(dto: object): BookingFieldError[] {
  return validateSync(dto, { stopAtFirstError: true }).map((error) => ({
    field: error.property as BookingField,
    message:
      Object.values(error.constraints ?? {})[0] ??
      `${FIELD_LABELS[error.property as BookingField] ?? error.property} is invalid`,
  }));
}

// Minimal RFC 4180 parser: handles quoted fields (so a comma-separated
// Special Notes or Child Ages cell doesn't shift later columns) and "" escapes.
export function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = content
    .replace(/^﻿/, "") // Excel's UTF-8 byte order mark
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function mapHeader(
  header: string[],
  dataRows: string[][],
): Map<CsvColumn, number> {
  const indexByKey = new Map<CsvColumn, number>();
  const unknown: string[] = [];
  const repeated: string[] = [];

  header.forEach((cell, index) => {
    const name = cell.trim();
    if (!name) {
      const hasData = dataRows.some((row) => (row[index] ?? "").trim() !== "");
      if (hasData) {
        throw new BookingCsvFormatError(
          `Column ${index + 1} has values but no header. Give every column one of the template headers.`,
        );
      }
      return;
    }
    const column = COLUMN_BY_HEADER.get(headerKey(name));
    if (!column) {
      unknown.push(`'${name}'`);
    } else if (indexByKey.has(column.key)) {
      repeated.push(`'${name}'`);
    } else {
      indexByKey.set(column.key, index);
    }
  });

  const expected = BOOKING_CSV_COLUMNS.filter(
    (column) => column.key !== "additionalNotes",
  )
    .map((column) => column.header)
    .join(", ");
  if (unknown.length > 0) {
    throw new BookingCsvFormatError(
      `Unknown column(s) ${unknown.join(", ")}. Use the template columns: ${expected}.`,
    );
  }
  if (repeated.length > 0) {
    throw new BookingCsvFormatError(
      `Column(s) ${repeated.join(", ")} appear more than once.`,
    );
  }
  const missing = BOOKING_CSV_COLUMNS.filter(
    (column) => column.required && !indexByKey.has(column.key),
  ).map((column) => column.header);
  if (missing.length > 0) {
    throw new BookingCsvFormatError(
      `Missing required column(s): ${missing.join(", ")}. Use the template columns: ${expected}.`,
    );
  }
  return indexByKey;
}

/**
 * Notes text from a row. New files: Special Notes is the text as is. Older
 * files (with an Additional Notes column): Special Notes lists preset codes,
 * which must all be valid, and the free text follows from Additional Notes.
 */
function notesFromRow(
  specialNotesCell: string,
  additionalNotesCell: string | null,
  errors: BookingFieldError[],
): string {
  if (additionalNotesCell === null) return specialNotesCell;

  const labels: string[] = [];
  const invalid: string[] = [];
  for (const part of splitNotes(specialNotesCell)) {
    const note = parseSpecialNote(part);
    if (note) labels.push(SPECIAL_NOTE_LABELS[note]);
    else invalid.push(`'${part}'`);
  }
  if (invalid.length > 0) {
    errors.push({
      field: "specialNotes",
      message: `Special note(s) ${invalid.join(", ")} not recognised. With an Additional Notes column, Special Notes must list only: ${Object.values(SPECIAL_NOTE_LABELS).join(", ")}`,
    });
  }
  return [...labels, additionalNotesCell.trim()].filter(Boolean).join(", ");
}

function parseChildAges(
  cell: string,
  errors: BookingFieldError[],
): number[] | null {
  const parts = cell
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.some((part) => !WHOLE_NUMBER.test(part))) {
    errors.push({ field: "childAges", message: BOOKING_MESSAGES.childAgesInvalid });
    return null;
  }
  return parts.map(Number);
}

function parseRow(
  rowNumber: number,
  cell: (key: CsvColumn) => string | null,
  maxPassengersPerPnr: number,
): ParsedBookingRow {
  const text = (key: CsvColumn) => (cell(key) ?? "").trim();
  const errors: BookingFieldError[] = [];

  const residencyRaw = text("residency");
  const residency = toCountryCode(residencyRaw);
  const travelClassRaw = text("travelClass");
  const travelClass = parseTravelClass(travelClassRaw);
  const adultsRaw = text("adults");
  const childrenRaw = text("children");
  const childAgesRaw = text("childAges");
  const notes = notesFromRow(
    cell("specialNotes") ?? "",
    cell("additionalNotes"),
    errors,
  );

  const values: FailedBookingValues = {
    pnr: text("pnr"),
    firstName: text("firstName"),
    lastName: text("lastName"),
    email: text("email"),
    phone: text("phone"),
    residency: residency ?? residencyRaw,
    travelClass: travelClass ?? travelClassRaw,
    adults: adultsRaw,
    children: childrenRaw,
    childAges: childAgesRaw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
    specialNotes: normalizeNotes(notes) ?? "",
  };

  // Required cells first, so an empty cell says "required", not "invalid".
  const required: BookingField[] = [
    "pnr",
    "firstName",
    "lastName",
    "email",
    "phone",
    "residency",
    "travelClass",
    "adults",
    "children",
  ];
  for (const field of required) {
    if (!values[field as keyof FailedBookingValues]) {
      errors.push({ field, message: `${FIELD_LABELS[field]} is required` });
    }
  }

  const childAges = parseChildAges(childAgesRaw, errors);
  const dto = plainToInstance(CreateBookingDto, {
    pnr: values.pnr,
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: values.phone,
    residency: values.residency,
    travelClass: values.travelClass,
    // A non-number stays text, so the DTO rule reports it.
    adults: WHOLE_NUMBER.test(adultsRaw) ? Number(adultsRaw) : adultsRaw,
    children: WHOLE_NUMBER.test(childrenRaw) ? Number(childrenRaw) : childrenRaw,
    childAges: childAges ?? [],
    specialNotes: values.specialNotes || undefined,
  });

  const reported = new Set(errors.map((error) => error.field));
  for (const error of validateBookingDto(dto)) {
    if (!reported.has(error.field)) errors.push(error);
  }

  const countsValid =
    typeof dto.adults === "number" &&
    typeof dto.children === "number" &&
    !errors.some((error) =>
      ["adults", "children", "childAges"].includes(error.field ?? ""),
    );
  if (countsValid) {
    errors.push(
      ...bookingRuleErrors(
        { adults: dto.adults, children: dto.children, childAges: childAges ?? [] },
        maxPassengersPerPnr,
      ),
    );
  }

  const booking: ImportedBooking | null =
    errors.length === 0
      ? {
          pnr: dto.pnr,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          residency: dto.residency,
          travelClass: dto.travelClass,
          adults: dto.adults,
          children: dto.children,
          childAges: childAges ?? [],
          specialNotes: normalizeNotes(dto.specialNotes),
        }
      : null;

  return { rowNumber, values, errors, booking };
}

/**
 * Lines a row up with the header. When Child Ages and Special Notes are the
 * last two columns (as in the template) they need no quotes: the numbers after
 * Children are the ages (up to `Children` of them) and everything after them
 * is the notes text. Quoted values ("4, 9") read the same way. Any other extra
 * values can't be placed, so the row fails.
 */
function fitRowToHeader(
  row: string[],
  headerLength: number,
  indexByKey: Map<CsvColumn, number>,
): { cells: string[]; error: string | null } {
  const agesAt = indexByKey.get("childAges");
  const notesAt = indexByKey.get("specialNotes");
  const children = (row[indexByKey.get("children")!] ?? "").trim();
  if (
    agesAt === headerLength - 2 &&
    notesAt === headerLength - 1 &&
    WHOLE_NUMBER.test(children)
  ) {
    const parts = row
      .slice(agesAt)
      .flatMap((cell) => cell.split(","))
      .map((part) => part.trim());
    // Ages are the leading numbers (or empty values), at most `Children` of
    // them (one when Children is 0, for its empty Child Ages value). A missing
    // age stops there, so the notes stay intact and the row fails with
    // "N children, M ages given", to be fixed under Failed Bookings.
    const maxAges = Math.max(Number(children), 1);
    let agesCount = 0;
    while (
      agesCount < maxAges &&
      agesCount < parts.length &&
      (parts[agesCount] === "" || WHOLE_NUMBER.test(parts[agesCount]))
    ) {
      agesCount += 1;
    }
    return {
      cells: [
        ...row.slice(0, agesAt),
        parts.slice(0, agesCount).filter(Boolean).join(","),
        parts.slice(agesCount).filter(Boolean).join(", "),
      ],
      error: null,
    };
  }

  const cells = [...row];
  while (cells.length > headerLength && cells[cells.length - 1].trim() === "") {
    cells.pop();
  }
  if (cells.length <= headerLength) return { cells, error: null };
  return {
    cells: cells.slice(0, headerLength),
    error: `This row has ${cells.length} values but the file has ${headerLength} columns. Put values that contain commas in double quotes (only Child Ages and Special Notes, as the last two columns, can do without).`,
  };
}

/**
 * Parses and validates a bookings CSV. Throws BookingCsvFormatError when the
 * file can't be read as one; otherwise returns every non-empty row, valid or
 * not. PNRs repeated within the file fail after their first row; PNRs already
 * on the flight are checked by the caller.
 */
export function parseBookingCsv(
  content: string,
  maxPassengersPerPnr: number,
): ParsedBookingRow[] {
  const rows = parseCsvRows(content);
  const header = rows[0];
  if (!header || header.every((cell) => cell.trim() === "")) {
    throw new BookingCsvFormatError(
      "The file is empty. The first row must be the column headers.",
    );
  }

  const dataRows = rows
    .map((row, index) => ({ row, rowNumber: index + 1 }))
    .slice(1)
    .filter(({ row }) => row.some((value) => value.trim() !== ""));
  const indexByKey = mapHeader(
    header,
    dataRows.map(({ row }) => row),
  );
  if (dataRows.length === 0) {
    throw new BookingCsvFormatError(
      "The file has no booking rows below the header.",
    );
  }

  // Columns up to the last named header (trailing empty headers don't count).
  const headerLength = header.reduce(
    (length, cell, index) => (cell.trim() ? index + 1 : length),
    0,
  );
  const firstRowByPnr = new Map<string, number>();
  return dataRows.map(({ row, rowNumber }) => {
    const { cells, error } = fitRowToHeader(row, headerLength, indexByKey);
    const parsed = parseRow(
      rowNumber,
      (key) => {
        const index = indexByKey.get(key);
        return index === undefined ? null : (cells[index] ?? "");
      },
      maxPassengersPerPnr,
    );
    if (error) {
      parsed.errors.unshift({ field: null, message: error });
      parsed.booking = null;
    }

    const pnr = parsed.values.pnr;
    if (pnr) {
      const firstRow = firstRowByPnr.get(pnr);
      if (firstRow !== undefined) {
        parsed.errors.unshift({
          field: "pnr",
          message: `Duplicate PNR '${pnr}': already used on row ${firstRow} of this file`,
        });
        parsed.booking = null;
      } else {
        firstRowByPnr.set(pnr, rowNumber);
      }
    }
    return parsed;
  });
}
