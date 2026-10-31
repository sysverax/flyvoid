# Bookings CSV import

How the cancelled-flight wizard's **Bookings & Passengers** step (step 2)
imports bookings from a CSV file, and how rows that fail are kept and fixed.

- Parser and row rules: `backend/src/cancelled-flights/booking-import.ts`
- Field rules (shared with the API): `backend/src/cancelled-flights/dto/create-booking-request.dto.ts`
- Notes and label matching: `backend/src/cancelled-flights/booking-notes.ts`
- Portal: `frontend/airline/src/lib/booking-fields.ts` (form rules, template,
  guidelines) and `frontend/airline/src/components/bookings/`

## File format

- `.csv`, UTF-8 (a byte order mark from Excel is fine), max 10MB.
- The first row is the header. Columns are matched **by header name**, in any
  order, ignoring case, spaces and punctuation (`first name`, `FirstName` and
  `First Name` all work).
- **Child Ages and Special Notes need no quotes** when they are the last two
  columns (as in the template): after Children come the ages, one number per
  child (`4,9` for 2 children; nothing, or one empty value, for 0), and
  everything after the ages is the Special Notes text, commas included:
  `XYZ789,...,2,2,4,9,Wheelchair Assistance, Needs a baby cot`. Only leading
  numbers count as ages, so a missing age leaves the notes intact and fails the
  row ("2 children, 1 age given") to be fixed under Failed Bookings.
- Any other value with a comma must be in double quotes; quoted values
  (`"4, 9"`) also work for the last two columns. A quote inside a quoted value
  is written twice (`""`). A row with more values than columns that can't be
  placed this way fails.
- Empty rows are ignored. Row numbers in errors count the header as row 1, as a
  spreadsheet does.

| Column | Required | Accepted values |
|---|---|---|
| PNR | Yes | Up to 20 characters. Trimmed and uppercased (`abc123` is saved as `ABC123`). Unique within the file and the flight, ignoring case |
| First Name | Yes | Up to 100 characters |
| Last Name | Yes | Up to 100 characters |
| Email | Yes | A valid email address, up to 255 characters |
| Phone | Yes | 7-20 digits, spaces, dashes or brackets, optionally starting with `+` |
| Passport Country | Yes | English country name or ISO 3166-1 alpha-2 code (`United States`, `US`, `United States (US)`), plus common aliases (`UK`, `USA`, ...) |
| Travel Class | Yes | `Economy`, `Premium Economy`, `Business`, `First Class`, or the codes `economy`, `premium_economy`, `business`, `first_class` (any case) |
| Adults | Yes | Whole number, 1 or more |
| Children | Yes | Whole number, 0 or more |
| Child Ages | When Children > 0 | One age per child, each a whole number 0-12, comma-separated: `4,9`. Empty when Children is 0 |
| Special Notes | No | Last column. Comma-separated text: preset labels and/or free text, e.g. `Wheelchair Assistance, Needs a baby cot` |

Adults + Children may not exceed the backend's `MAX_PASSENGERS_PER_PNR`
(default 9) per PNR.

The portal's **Download template** button gives these headers with two example
rows.

### Special Notes

Special Notes is one text, stored as entered in one column
(`cancelled_flight_bookings.special_notes`, API field `specialNotes`). The
presets are **Wheelchair Assistance, Medical Needs, Infant, Late Arrival,
Dietary Requirements, Elderly Passenger**. Hotel allocation reads the presets
from the text (`deriveSpecialNotes` in `booking-notes.ts`) to group, order and
rank bookings: only a comma-separated part that is exactly a preset's label or
code (any case) counts. Other text is kept but is not a preset:
`needs a wheelchair` is free text, `Wheelchair Assistance` is the preset.

### Older files

Files from before this format still import:

- **Additional Notes column present:** Special Notes must then list only
  presets (labels or codes; anything else is a row error, as before), and the
  notes text becomes the presets' labels followed by the Additional Notes text.
- **No Child Ages column:** rows with Children > 0 fail with "Age is required
  for each child" and can be fixed in the portal.

## What is rejected where

**Whole file** (HTTP 400, nothing imported): empty file, no rows below the
header, a header that isn't one of the columns above, a column given twice, a
required column missing, or a column with values but no header.

**Single row** (kept as a failed booking, other rows still imported): any
missing required value, any invalid value (the rules above), a PNR repeated in
the file (rows after the first), or a PNR already on the flight with different
details. There are no fallback values: an empty or invalid cell is always an
error, never a default.

**Uploading again**: the corrected file can be uploaded again as a whole.
- A row whose PNR is already on the flight with the same details is skipped
  (`summary.skippedBookings`), not failed. "Same" compares every column, with
  email ignoring case and an empty Special Notes equal to none.
- Failed rows from earlier uploads whose PNR (trimmed, any case) appears in the
  new file are deleted first; that row is then imported, skipped, or failed
  again with fresh errors.
- A failed row whose PNR is not in the new file (for example, the PNR itself
  was the typo and has since changed) stays; delete it under Failed Bookings.

**Duplicate PNRs**: the database has a unique index on
`(cancelled_flight_id, UPPER(BTRIM(pnr)))` (migration 20261031), so a PNR is
saved once per flight even when two requests (two imports, or an import and a
fix) run at the same time. The one that loses gets HTTP 409; for an import,
nothing from that file is saved and it can simply be uploaded again.

## Failed bookings

Failed rows are stored in `cancelled_flight_booking_import_failures` with the
file name, row number, the row's values (normalised where they parsed, e.g. the
country code, otherwise as in the file) and a list of `{ field, message }`
errors.

| Endpoint | Does |
|---|---|
| `POST /cancelled-flights/:id/bookings/import` | Imports valid rows, stores failed rows; returns `bookings`, `failedBookings`, `summary` |
| `GET /cancelled-flights/:id/booking-import-failures` | Lists failed rows |
| `POST /cancelled-flights/:id/booking-import-failures/:failureId/resolve` | Body: a full `CreateBookingDto`. Saves the booking and deletes the failed row in one transaction |
| `DELETE /cancelled-flights/:id/booking-import-failures/:failureId` | Deletes one failed row |
| `DELETE /cancelled-flights/:id/booking-import-failures` | Deletes all failed rows of the flight |

While a flight has failed rows, `POST /cancelled-flights/:id/bookings/confirm`
returns 400, and the portal disables **Continue** on step 2.

In the portal, failed rows appear as a **Failed Bookings** tab (shown first)
next to **Bookings**; without failed rows only the bookings table is shown.
Editing a failed row loads it into the Add Manually form with its errors;
**Save Booking** calls `resolve`, and the row moves to Bookings.
