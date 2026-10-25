-- Hotel stay dates of a cancelled flight, entered in the cancellation wizard.
-- Calendar dates at the hotel (no timezone). Existing flights get the stay the
-- allocation already used: check-in = cancellation date, one night.

ALTER TABLE public.cancelled_flights
  ADD COLUMN IF NOT EXISTS check_in_date date,
  ADD COLUMN IF NOT EXISTS check_out_date date;

UPDATE public.cancelled_flights
   SET check_in_date = cancellation_date
 WHERE check_in_date IS NULL;

UPDATE public.cancelled_flights
   SET check_out_date = check_in_date + 1
 WHERE check_out_date IS NULL;

ALTER TABLE public.cancelled_flights
  ALTER COLUMN check_in_date SET NOT NULL,
  ALTER COLUMN check_out_date SET NOT NULL;

-- At least one night.
ALTER TABLE public.cancelled_flights
  DROP CONSTRAINT IF EXISTS chk_cancelled_flights_stay_dates;
ALTER TABLE public.cancelled_flights
  ADD CONSTRAINT chk_cancelled_flights_stay_dates
    CHECK (check_out_date > check_in_date);
