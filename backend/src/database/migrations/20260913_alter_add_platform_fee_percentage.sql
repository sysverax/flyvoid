-- Adds platform fee percentage to airlines and their pending invitations.
-- Value is set at invite time, carried into the airline record on acceptance,
-- and editable afterwards. Must be > 0 and < 100, up to 2 decimal places.
-- Existing rows are backfilled with the platform-wide default (10%) so the
-- new CHECK constraint can be applied without breaking existing data.

ALTER TABLE public.meta_airline_invites
  ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric(5, 2) NOT NULL DEFAULT 10.00;

ALTER TABLE public.airlines
  ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric(5, 2) NOT NULL DEFAULT 10.00;

ALTER TABLE public.meta_airline_invites
  ADD CONSTRAINT chk_meta_airline_invites_platform_fee_percentage
    CHECK (platform_fee_percentage > 0 AND platform_fee_percentage < 100);

ALTER TABLE public.airlines
  ADD CONSTRAINT chk_airlines_platform_fee_percentage
    CHECK (platform_fee_percentage > 0 AND platform_fee_percentage < 100);


ALTER TABLE public.cancelled_flights
  ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric(5, 2) NOT NULL DEFAULT 10.00;

ALTER TABLE public.cancelled_flights
  ADD CONSTRAINT chk_cancelled_flights_platform_fee_percentage
    CHECK (platform_fee_percentage > 0 AND platform_fee_percentage < 100);

ALTER TABLE public.hotel_allocations
  ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric(5, 2) NOT NULL DEFAULT 10.00;

ALTER TABLE public.hotel_allocations
  ADD CONSTRAINT chk_hotel_allocations_platform_fee_percentage
    CHECK (platform_fee_percentage > 0 AND platform_fee_percentage < 100);
