## Time frame / date range APIs
Any API that filters or groups data by time frame or date range must
follow docs/guidelines/time-frame-apis.md. Use TimeFrameQueryDto
(backend/src/common/dto/time-frame-query.dto.ts; requires `timeFrame` +
IANA `timezone`) and the helpers in
backend/src/common/utils/time-frame.util.ts. Never add new range logic or
default to the airline/server timezone.
