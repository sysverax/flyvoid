## Time frame / date range APIs
Any API that filters or groups data by time frame or date range must
follow docs/guidelines/time-frame-apis.md:
- timeFrame presets: use TimeFrameQueryDto (requires an IANA
  `timezone`) and the helpers in backend/src/common/utils/time-frame.util.ts.
- startDate/endDate on timestamp columns: use TimestampRangeQueryDto
  (ISO 8601 with "Z" or offset required; end exclusive).
- startDate/endDate on DATE columns: use CalendarDateRangeQueryDto
  (YYYY-MM-DD; both inclusive; no timezone conversion).
- Never write new date-range logic, never default to the airline or
  server timezone, and never accept timestamps without timezone info.
