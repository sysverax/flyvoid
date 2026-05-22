-- Add airports table and extend platform access-control assets with AIRPORTS.

CREATE TABLE IF NOT EXISTS public.airports (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(150) NOT NULL,
  iata_code varchar(3) NOT NULL UNIQUE,
  icao_code varchar(4) NOT NULL UNIQUE,
  country varchar(100) NOT NULL,
  city varchar(100) NOT NULL,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  timezone varchar(100) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  type varchar(20) NOT NULL,
  address varchar(255),
  postal_code varchar(20),
  created_by integer NOT NULL,
  updated_by integer,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_airports_created_by
    FOREIGN KEY (created_by)
    REFERENCES public.admins(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_airports_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES public.admins(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_airports_type
    CHECK (type IN ('INTERNATIONAL', 'DOMESTIC'))
);

CREATE INDEX IF NOT EXISTS idx_airports_country_city
  ON public.airports (country, city);

ALTER TABLE public.platform_access_controls
  DROP CONSTRAINT IF EXISTS chk_platform_access_controls_asset;

ALTER TABLE public.platform_access_controls
  ADD CONSTRAINT chk_platform_access_controls_asset
    CHECK (
      asset IN (
        'DASHBOARD',
        'AIRLINES',
        'AIRPORTS',
        'CANCELLED_FLIGHTS',
        'REVENUE',
        'PAYMENTS',
        'INVITES_ONBOARDING',
        'SYSTEM_SETTINGS',
        'AUDIT_LOGS',
        'PROFILE',
        'ADMIN_USERS'
      )
    );
