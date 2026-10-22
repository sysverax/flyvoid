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
- Custom date ranges (from/to) must be sent as full UTC ISO 8601 timestamps
  with `"Z"`, using an exclusive end (start of the next day), not
  `"23:59:59"`.

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

## Known exception

`GET /api/v1/cancelled-flights/summary` still accepts the older
`startDate`/`endDate` filters: inclusive `YYYY-MM-DD` dates on the DATE
column `cancellation_date`. They predate these rules and are kept for
existing callers; don't copy that pattern into new APIs.
