# Time Frame API Guidelines

Any API that filters, groups or reports data by a time frame or date range
MUST follow these rules.

Paths below are relative to the repository root.

## Storage

- Store all timestamps in UTC (`timestamp without time zone` holding UTC, as
  the rest of the project does). Never store local time.
- The server and database session both run in UTC
  (`backend/src/config/timezone.ts`, `backend/src/database/database.module.ts`).

## Input

- Accept `timeFrame` and `timezone` using the shared `TimeFrameQueryDto`
  (`backend/src/common/dto/time-frame-query.dto.ts`). Do not redefine these
  fields.
  - Extend it when both are required:
    `export class MyQueryDto extends TimeFrameQueryDto {}`.
  - When `timeFrame` is optional, use the field decorators instead:
    `@TimeFrameField({ required: false })` and
    `@ValidateIf((q) => q.timeFrame !== undefined)` +
    `@TimezoneField({ required: true })`
    (see `GetCancelledFlightsSummaryQueryDto`).
- `timezone` is required whenever a time frame is used. It must be an IANA
  name (e.g. `"Asia/Colombo"`). Raw offsets like `"+05:30"` or `"UTC+5:30"`
  are rejected (`@IsIanaTimeZone()`): Postgres `AT TIME ZONE` reads raw
  offsets with the opposite sign.
- Never use the airline's stored timezone, the server timezone, or UTC as an
  implicit default for user-facing time frames. Invalid or missing
  timezone -> 400.
- Custom date ranges (`startDate`/`endDate`) follow
  [Custom date range filters](#custom-date-range-filters-startdate--enddate)
  below: the column type decides the format.

## Calculation

- Always use `resolveTimeFrameRange` / `buildTrendWindow` from
  `backend/src/common/utils/time-frame.util.ts`. Never write new range logic
  or manual offset math (e.g. adding 5.5 hours).
  - These helpers throw on an invalid timezone; they never fall back to UTC.
    Validate the request with `TimeFrameQueryDto` first.
  - `resolveTimeZone` (with its UTC fallback) is for stored data only, never
    for request input.
- Filter on the shared column `REPORTING_DATE_COLUMN` and statuses from
  `backend/src/cancelled-flights/cancelled-flight-reporting.constants.ts`
  when reporting on cancelled flights, so totals and trends stay equal.
- Queries use a half-open range: `column >= startUtc AND column < endUtc`.
  Pass bounds with `toUtcTimestampParam()`.
- Group chart buckets in SQL with
  `date_trunc(granularity, (column AT TIME ZONE 'UTC') AT TIME ZONE :timeZone)`,
  always passing the timezone as a parameter, never by string concatenation.
- Fill empty buckets with `fillTrendBuckets`.
- Never use the server's local time for calendar logic. `new Date()` is only
  used as "now" (an instant).
- A timezone Node accepts but Postgres does not is turned into
  400 `"Unsupported timezone"` by the global `DatabaseExceptionFilter`
  (`backend/src/common/filters/database-exception.filter.ts`, registered in
  `app.module.ts`); no per-repository handling is needed.

## Output

- Return `timeFrame`, `timezone`, `startDate` and `endDate` in the response so
  the frontend can show the exact range used. Build them with
  `describeTimeFrameRange()` and document them with
  `TimeFrameRangeResponseDto` (`backend/src/common/dto/time-frame-range-response.dto.ts`).
- `startDate`/`endDate`: local time with offset (`formatInTimeZone`), e.g.
  `"2026-10-16T00:00:00+05:30"`. `endDate` is the exclusive end minus
  1 second.
- Raw timestamps in data rows: UTC ISO 8601 with `"Z"`.
- Chart bucket keys: local wall-clock time (no offset), e.g.
  `"2026-10-21T14:00"`, `"2026-10-21"`, `"2026-10"`, `"2026"`.

## Time frame definitions

All in the timezone sent in `timezone`; start inclusive, end exclusive.

| timeFrame   | Range                                     | Buckets                                   |
|-------------|-------------------------------------------|-------------------------------------------|
| `today`     | 00:00 today -> 00:00 tomorrow             | hourly, from 00:00 up to the current hour |
| `yesterday` | 00:00 yesterday -> 00:00 today            | 24 hourly buckets (also on DST days)      |
| `week`      | rolling 7 days including today            | 7 daily buckets (not Monday-based)        |
| `month`     | last 12 months including the current month | 12 monthly buckets                       |
| `year`      | last 6 years including the current year   | 6 yearly buckets                          |

## Testing checklist for new time-frame APIs

- Missing / invalid / raw-offset timezone -> 400
- Same data gives different results for different timezones
- Non-whole-hour offset (`Asia/Kathmandu`, +05:45)
- Daylight saving transition day (`America/New_York`, e.g. 2026-11-01) -
  unit test via the `now` parameter of the helpers, since E2E runs on the
  real clock
- Half-open boundaries: a row exactly at the end is excluded
- E2E expectations: use `backend/test-e2e/helpers/time-zone.helper.ts`
  (Intl-based), never hardcoded offsets

## Custom date range filters (startDate / endDate)

Any API that filters by a custom date range MUST follow these rules.
The column type decides the input format.

The building blocks live in `backend/src/common/dto/date-range-query.dto.ts`
(parsing helpers in `backend/src/common/utils/date-range.util.ts`). Compose
them with pagination via `IntersectionType(PaginationQueryDto, ...)`.
Range order is validated in the DTO (`@IsDateRangeEnd`), which skips the
check when either bound is missing, so open-ended ranges work. Don't add
service-level range checks.

### Timestamp columns (exact moments: created_at, paid_at, updated_at...)

- Input: ISO 8601 timestamp WITH timezone information:
  `"Z"` (`2026-09-30T18:30:00.000Z`) or a numeric offset
  (`2026-10-01T00:00:00+05:30`). Offsets are converted to UTC.
- Values without timezone information are rejected with 400:
  date-only (`2026-10-01`) and no-offset (`2026-10-01T00:00:00`).
  Reason: they are ambiguous and silently shift results.
- startDate inclusive, endDate exclusive (start of the next day).
  Never use 23:59:59. Query: `column >= :startDate AND column < :endDate`,
  passing the Dates through `toUtcTimestampParam()`.
- The backend never assumes the user's timezone.
- Use `@TimestampWithTimezoneField` / `TimestampRangeQueryDto`.
  Examples: `GET /api/v1/wallets/transactions`,
  `GET /api/v1/hotel-bookings` and `GET /api/v1/hotel-bookings/summary`
  (hotel booking created_at).

### DATE columns (calendar dates: cancellation_date, check-in date...)

- Input: `"YYYY-MM-DD"`, both inclusive
  (`column >= :startDate AND column <= :endDate`).
- Never convert to UTC; a calendar date is timezone-independent.
- Use `@CalendarDateField` / `CalendarDateRangeQueryDto`.
  Example: `GET /api/v1/cancelled-flights`.

### How to choose

- The column stores a time of day -> timestamp rules.
- The column stores only a date -> DATE rules.
- New columns representing a moment must be timestamps in UTC,
  never local time.

### Frontend example (timestamp columns)

```ts
// User selects 1 Oct to 15 Oct in their local timezone
const start = new Date(2026, 9, 1);   // local midnight, 1 Oct
const end   = new Date(2026, 9, 16);  // local midnight, 16 Oct (day after last day)
params.startDate = start.toISOString(); // e.g. 2026-09-30T18:30:00.000Z in Colombo
params.endDate   = end.toISOString();
```

### Frontend example (DATE columns)

```ts
params.startDate = "2026-10-01";
params.endDate   = "2026-10-15";
```

### Testing checklist for new date-range filters

- Timestamp: row at startDate included, row at endDate excluded
- Timestamp: "Z" and offset versions of the same range give identical results
- Timestamp: date-only and no-timezone input return 400
- DATE: rows on both start and end dates included
- Reversed ranges return 400
- Only startDate and only endDate (open-ended) still work
