ALTER TABLE public.hotel_allocations
  ADD COLUMN IF NOT EXISTS booking_attempt jsonb;

CREATE INDEX IF NOT EXISTS idx_hotel_allocations_flight_status
  ON public.hotel_allocations (cancelled_flight_id, status);

ALTER TABLE public.cancelled_flights
  ADD COLUMN IF NOT EXISTS hotel_allocation_run_id varchar(64),
  ADD COLUMN IF NOT EXISTS hotel_allocation_error text;
