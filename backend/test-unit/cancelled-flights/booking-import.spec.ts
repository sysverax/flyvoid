import { describe, expect, it } from "@jest/globals";
import {
  BookingCsvFormatError,
  ImportedBooking,
  bookingRuleErrors,
  matchesSavedBooking,
  parseBookingCsv,
} from "../../src/cancelled-flights/booking-import";
import {
  deriveSpecialNotes,
  parseTravelClass,
} from "../../src/cancelled-flights/booking-notes";
import { SpecialNote, TravelClass } from "../../src/cancelled-flights/entities/enums";

const HEADER =
  "PNR,First Name,Last Name,Email,Phone,Passport Country,Travel Class,Adults,Children,Child Ages,Special Notes";
const LEGACY_HEADER =
  "PNR,First Name,Last Name,Email,Phone,Passport Country,Travel Class,Adults,Children,Special Notes,Additional Notes";
const MAX = 9;

const csv = (...lines: string[]) => lines.join("\n");
const fieldsOf = (errors: { field: string | null }[]) =>
  errors.map((error) => error.field);

describe("parseBookingCsv", () => {
  it("imports a valid row with labels, ages and notes", () => {
    const [row] = parseBookingCsv(
      csv(
        HEADER,
        'ABC123,John,Doe,john@example.com,+1 555-0101,United States,Premium Economy,2,2,"4, 9","Wheelchair Assistance, Needs a baby cot"',
      ),
      MAX,
    );
    expect(row.rowNumber).toBe(2);
    expect(row.errors).toEqual([]);
    expect(row.booking).toEqual({
      pnr: "ABC123",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+1 555-0101",
      residency: "US",
      travelClass: TravelClass.PREMIUM_ECONOMY,
      adults: 2,
      children: 2,
      childAges: [4, 9],
      specialNotes: "Wheelchair Assistance, Needs a baby cot",
    });
  });

  it("accepts enum codes, any header case and a byte order mark", () => {
    const [row] = parseBookingCsv(
      "﻿" +
        csv(
          HEADER.toUpperCase(),
          "ABC123,John,Doe,john@example.com,14165550101,ca,first_class,1,0,,",
        ),
      MAX,
    );
    expect(row.errors).toEqual([]);
    expect(row.booking?.travelClass).toBe(TravelClass.FIRST_CLASS);
    expect(row.booking?.residency).toBe("CA");
  });

  it("keeps bad rows apart without stopping the good ones", () => {
    const rows = parseBookingCsv(
      csv(
        HEADER,
        "A1,John,Smith,john.smith1example.com,14165550101,CA,bbejjucjjonomy,2,0,,",
        "A2,Ann,Lee,ann@example.com,14165550102,CA,Economy,1,0,,",
        ",,,,,,,,,,", // empty line: ignored
        "A3,Mike,Brown,mike@example.com,14165550103,Atlantis,Economy,2,2,,",
      ),
      MAX,
    );
    expect(rows.map((row) => row.rowNumber)).toEqual([2, 3, 5]);
    expect(fieldsOf(rows[0].errors)).toEqual(["email", "travelClass"]);
    expect(rows[0].errors[0].message).toBe("Invalid email format");
    expect(rows[0].booking).toBeNull();
    expect(rows[1].booking).not.toBeNull();
    expect(fieldsOf(rows[2].errors)).toEqual(["residency", "childAges"]);
    // Failed values are kept for editing, normalised where they parsed.
    expect(rows[0].values.residency).toBe("CA");
    expect(rows[0].values.travelClass).toBe("bbejjucjjonomy");
  });

  it("reports missing required values instead of using defaults", () => {
    const [row] = parseBookingCsv(csv(HEADER, "A1,,Doe,,,,,,,,"), MAX);
    expect(row.errors.map((error) => error.message)).toEqual([
      "First Name is required",
      "Email is required",
      "Phone is required",
      "Passport Country is required",
      "Travel Class is required",
      "Adults is required",
      "Children is required",
    ]);
  });

  it("checks child ages: one per child, whole numbers 0-12", () => {
    const rows = parseBookingCsv(
      csv(
        HEADER,
        "A1,J,D,j@example.com,14165550101,US,Economy,1,2,5,",
        "A2,J,D,j@example.com,14165550101,US,Economy,1,1,13,",
        "A3,J,D,j@example.com,14165550101,US,Economy,1,1,abc,",
        "A4,J,D,j@example.com,14165550101,US,Economy,1,0,4,",
        "A5,J,D,j@example.com,14165550101,US,Economy,1,2,0,12",
      ),
      MAX,
    );
    expect(rows[0].errors[0].message).toMatch(/2 children, 1 age given/);
    expect(rows[1].errors[0].message).toMatch(/from 0 to 12/);
    // Not a number, so not an age: it is read as notes and the age is missing.
    expect(rows[2].errors[0].message).toMatch(/1 child, 0 ages given/);
    expect(rows[2].values.specialNotes).toBe("abc");
    expect(rows[3].errors[0].field).toBe("childAges");
    expect(rows[4].booking?.childAges).toEqual([0, 12]);
  });

  it("reads Child Ages and Special Notes without quotes", () => {
    const rows = parseBookingCsv(
      csv(
        HEADER,
        "A1,J,D,j@example.com,14165550101,US,Economy,2,2,4,9,Wheelchair Assistance, Needs a baby cot",
        "A2,J,D,j@example.com,14165550101,US,Economy,2,0,,Late Arrival, Window seat",
        "A3,J,D,j@example.com,14165550101,US,Economy,2,1,7",
        "A4,J,D,j@example.com,14165550101,US,Economy,2,0,Infant, Late Arrival",
        'A5,J,D,j@example.com,14165550101,US,Economy,2,2,"4, 9","Medical Needs, Quiet room"',
      ),
      MAX,
    );
    expect(rows.map((row) => row.errors)).toEqual([[], [], [], [], []]);
    expect(rows[0].booking?.childAges).toEqual([4, 9]);
    expect(rows[0].booking?.specialNotes).toBe("Wheelchair Assistance, Needs a baby cot");
    expect(rows[1].booking?.childAges).toEqual([]);
    expect(rows[1].booking?.specialNotes).toBe("Late Arrival, Window seat");
    expect(rows[2].booking?.childAges).toEqual([7]);
    expect(rows[2].booking?.specialNotes).toBeNull();
    // Children 0 with the empty Child Ages value left out: all of it is notes.
    expect(rows[3].booking?.specialNotes).toBe("Infant, Late Arrival");
    // Quoted values still work.
    expect(rows[4].booking?.childAges).toEqual([4, 9]);
    expect(rows[4].booking?.specialNotes).toBe("Medical Needs, Quiet room");
  });

  it("fails a row with a missing child age but keeps its notes", () => {
    const [row] = parseBookingCsv(
      csv(HEADER, "A1,J,D,j@example.com,14165550101,US,Economy,2,2,5,Wheelchair Assistance, Late Arrival"),
      MAX,
    );
    expect(row.booking).toBeNull();
    expect(row.errors).toEqual([
      { field: "childAges", message: expect.stringMatching(/2 children, 1 age given/) },
    ]);
    expect(row.values.childAges).toEqual(["5"]);
    expect(row.values.specialNotes).toBe("Wheelchair Assistance, Late Arrival");
  });

  it("fails rows with extra values it can't place", () => {
    const [row] = parseBookingCsv(
      csv(LEGACY_HEADER, "A1,J,D,j@example.com,14165550101,US,economy,1,0,infant,Window, aisle"),
      MAX,
    );
    expect(row.booking).toBeNull();
    expect(row.errors[0]).toEqual({
      field: null,
      message: expect.stringMatching(/12 values but the file has 11 columns/),
    });
  });

  it("rejects non-integer counts and the passenger limit", () => {
    const rows = parseBookingCsv(
      csv(
        HEADER,
        "A1,J,D,j@example.com,14165550101,US,Economy,1.5,0,,",
        "A2,J,D,j@example.com,14165550101,US,Economy,0,0,,",
        'A3,J,D,j@example.com,14165550101,US,Economy,8,2,"1,2",',
      ),
      MAX,
    );
    expect(rows[0].errors[0]).toEqual({
      field: "adults",
      message: "Adults must be a whole number, at least 1",
    });
    expect(rows[1].errors[0].field).toBe("adults");
    expect(rows[2].errors[0].message).toMatch(/at most 9 passengers/);
  });

  it("fails repeated PNRs after their first row", () => {
    const rows = parseBookingCsv(
      csv(
        HEADER,
        "A1,J,D,j@example.com,14165550101,US,Economy,1,0,,",
        "A1,K,D,k@example.com,14165550101,US,Economy,1,0,,",
      ),
      MAX,
    );
    expect(rows[0].booking).not.toBeNull();
    expect(rows[1].booking).toBeNull();
    expect(rows[1].errors[0].message).toMatch(/already used on row 2/);
  });

  it("reads older files: preset codes plus Additional Notes", () => {
    const rows = parseBookingCsv(
      csv(
        LEGACY_HEADER,
        'A1,J,D,j@example.com,14165550101,US,economy,1,0,"wheelchair_assistance,infant",Window please',
        "A2,J,D,j@example.com,14165550101,US,economy,1,0,vegan,",
      ),
      MAX,
    );
    expect(rows[0].booking?.specialNotes).toBe(
      "Wheelchair Assistance, Infant, Window please",
    );
    expect(deriveSpecialNotes(rows[0].booking?.specialNotes)).toEqual([
      SpecialNote.WHEELCHAIR_ASSISTANCE,
      SpecialNote.INFANT,
    ]);
    expect(rows[1].errors[0].field).toBe("specialNotes");
    expect(rows[1].errors[0].message).toMatch(/'vegan' not recognised/);
  });

  it("rejects files it cannot read as a whole", () => {
    expect(() => parseBookingCsv("", MAX)).toThrow(BookingCsvFormatError);
    expect(() => parseBookingCsv(HEADER, MAX)).toThrow(/no booking rows/);
    expect(() => parseBookingCsv(`${HEADER},Seat\nA1`, MAX)).toThrow(
      /Unknown column\(s\) 'Seat'/,
    );
    expect(() =>
      parseBookingCsv("PNR,First Name\nA1,J", MAX),
    ).toThrow(/Missing required column\(s\): Last Name/);
  });
});

describe("booking rules and notes", () => {
  it("requires one age per child", () => {
    expect(bookingRuleErrors({ adults: 1, children: 1, childAges: [] }, MAX)).toHaveLength(1);
    expect(bookingRuleErrors({ adults: 1, children: 1, childAges: [3] }, MAX)).toEqual([]);
  });

  it("derives presets only from whole comma-separated parts", () => {
    expect(
      deriveSpecialNotes("late arrival, needs a wheelchair, Late_Arrival, MEDICAL NEEDS"),
    ).toEqual([SpecialNote.LATE_ARRIVAL, SpecialNote.MEDICAL_NEEDS]);
    expect(deriveSpecialNotes(null)).toEqual([]);
  });

  it("matches travel classes by code or label only", () => {
    expect(parseTravelClass("first class")).toBe(TravelClass.FIRST_CLASS);
    expect(parseTravelClass("Economy Plus")).toBeNull();
  });
});

describe("matchesSavedBooking", () => {
  const row: ImportedBooking = {
    pnr: "ABC123",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "14165550101",
    residency: "CA",
    travelClass: TravelClass.FIRST_CLASS,
    adults: 2,
    children: 1,
    childAges: [7],
    specialNotes: null,
  };

  it("matches the same booking, ignoring email case and empty notes", () => {
    expect(
      matchesSavedBooking(row, {
        ...row,
        email: "John@Example.com",
        specialNotes: "",
      }),
    ).toBe(true);
  });

  it.each([
    ["first name", { firstName: "Jon" }],
    ["travel class", { travelClass: TravelClass.ECONOMY }],
    ["adults", { adults: 1 }],
    ["child ages", { childAges: [8] }],
    ["special notes", { specialNotes: "Late Arrival" }],
  ])("does not match when %s differs", (_label, change) => {
    expect(matchesSavedBooking(row, { ...row, ...change })).toBe(false);
  });
});

describe("PNR case", () => {
  const row = (pnr: string) =>
    `${pnr},John,Doe,john@example.com,14165550101,ca,economy,1,0,,`;

  it("stores the PNR trimmed and uppercase", () => {
    const [parsed] = parseBookingCsv([HEADER, row(" abc123 ")].join("\n"), 9);
    expect(parsed.booking?.pnr).toBe("ABC123");
    expect(parsed.values.pnr).toBe("ABC123");
  });

  it("treats PNRs that differ only in case as duplicates in one file", () => {
    const [first, second] = parseBookingCsv(
      [HEADER, row("ABC123"), row("abc123")].join("\n"),
      9,
    );
    expect(first.booking).not.toBeNull();
    expect(second.booking).toBeNull();
    expect(second.errors[0].message).toContain("Duplicate PNR 'ABC123'");
  });

  it("matches a saved booking whose PNR differs only in case", () => {
    const [parsed] = parseBookingCsv([HEADER, row("abc123")].join("\n"), 9);
    expect(
      matchesSavedBooking(parsed.booking!, { ...parsed.booking!, pnr: "abc123" }),
    ).toBe(true);
  });
});
