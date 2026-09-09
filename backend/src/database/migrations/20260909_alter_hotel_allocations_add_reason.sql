-- Adds a human-readable allocation rationale to each hotel allocation row
-- (why this hotel/room was chosen, plus any unverifiable special-need caveat).

ALTER TABLE public.hotel_allocations
  ADD COLUMN IF NOT EXISTS reason text;
