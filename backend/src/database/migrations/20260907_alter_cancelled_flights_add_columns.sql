-- Adds columns present on CancelledFlightEntity but missing from the
-- original cancelled_flights table created in 20260516_create_all_tables.sql

ALTER TABLE public.cancelled_flights
  ADD COLUMN IF NOT EXISTS allocated_bookings integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_bookings integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_actual_price decimal(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_discounts decimal(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hotel_taxes decimal(10,2) NOT NULL DEFAULT 0;
