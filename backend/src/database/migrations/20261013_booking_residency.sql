ALTER TABLE public.cancelled_flight_bookings
  ADD COLUMN IF NOT EXISTS residency varchar(2);

UPDATE public.cancelled_flight_bookings
  SET residency = 'US'
  WHERE residency IS NULL;

ALTER TABLE public.cancelled_flight_bookings
  ALTER COLUMN residency SET NOT NULL;
