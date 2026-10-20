// Relative reporting windows used by the dashboard trend charts.
export const TIME_FRAME = {
  TODAY: "today",
  YESTERDAY: "yesterday",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
} as const;
export type TimeFrame = (typeof TIME_FRAME)[keyof typeof TIME_FRAME];

// Size of a single chart bucket. Values double as Postgres date_trunc units.
export const TREND_GRANULARITY = {
  HOUR: "hour",
  DAY: "day",
  MONTH: "month",
  YEAR: "year",
} as const;
export type TrendGranularity =
  (typeof TREND_GRANULARITY)[keyof typeof TREND_GRANULARITY];
