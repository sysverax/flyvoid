-- Add airline_airports mapping table.
-- One airline can have many airports; one airport can belong to many airlines.
-- Supports active/inactive assignment state for enable/disable operations.

CREATE TABLE IF NOT EXISTS public.airline_airports (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  airline_id integer NOT NULL
    REFERENCES public.airlines (id) ON DELETE CASCADE,
  airport_id integer NOT NULL
    REFERENCES public.airports (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  assigned_by_admin_id integer NOT NULL
    REFERENCES public.admins (id) ON DELETE RESTRICT,
  assigned_at timestamp without time zone NOT NULL DEFAULT now(),
  disabled_by_admin_id integer
    REFERENCES public.admins (id) ON DELETE SET NULL,
  disabled_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_airline_airports_airline_airport
    UNIQUE (airline_id, airport_id)
);

CREATE INDEX IF NOT EXISTS idx_airline_airports_airline_id_is_active
  ON public.airline_airports (airline_id, is_active);

CREATE INDEX IF NOT EXISTS idx_airline_airports_airport_id
  ON public.airline_airports (airport_id);
