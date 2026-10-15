-- MANUAL_CHECK recovery: how often the supplier status of an attempt was checked.
ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS status_check_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_status_check_at timestamp without time zone;

-- User-started allocation runs per flight: the first run plus one retry.
ALTER TABLE public.cancelled_flights
  ADD COLUMN IF NOT EXISTS hotel_allocation_runs integer NOT NULL DEFAULT 0;

-- Flights already allocated once keep their one retry.
UPDATE public.cancelled_flights f
   SET hotel_allocation_runs = 1
 WHERE f.hotel_allocation_runs = 0
   AND EXISTS (SELECT 1 FROM public.hotel_bookings hb
                WHERE hb.cancelled_flight_id = f.id);
