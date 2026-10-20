-- Supports the airline dashboard trend queries
-- (GET /dashboard/airline/*-trend), which filter one airline's cancelled
-- flights by a created_at range and group them into time buckets.
-- Status is filtered on the rows this index returns.

CREATE INDEX IF NOT EXISTS idx_cancelled_flights_airline_id_created_at
  ON public.cancelled_flights (airline_id, created_at);
