-- Full Flyvoid schema creation script (PostgreSQL).
-- Creates all application tables in dependency-safe order.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admins (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'STAFF',
  is_active boolean NOT NULL DEFAULT true,
  require_password_reset boolean NOT NULL DEFAULT false,
  last_login_at timestamp without time zone,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  two_factor_secret_encrypted text,
  two_factor_temp_secret_encrypted text,
  two_factor_recovery_code_hashes text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT chk_admins_role
    CHECK (
      role IN (
        'SUPER_ADMIN',
        'STAFF'
      )
    )
);

CREATE TABLE IF NOT EXISTS public.airlines (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(150) NOT NULL,
  code varchar(20) NOT NULL UNIQUE,
  country_code varchar(2) NOT NULL,
  company_registration_number varchar(100) NOT NULL,
  website varchar(255),
  contact_email varchar(255),
  contact_phone varchar(30),
  timezone varchar(50) NOT NULL,
  currency varchar(10) NOT NULL,
  address varchar(255),
  logo varchar(255),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.airline_users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  airline_id integer NOT NULL,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  job_title varchar(100),
  password_hash varchar(255) NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'AIRLINE_STAFF',
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamp without time zone,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  two_factor_secret_encrypted text,
  two_factor_temp_secret_encrypted text,
  two_factor_recovery_code_hashes text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_airline_users_airline
    FOREIGN KEY (airline_id)
    REFERENCES public.airlines(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_airline_users_role
    CHECK (
      role IN (
        'AIRLINE_ADMIN',
        'AIRLINE_STAFF'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_airline_users_airline_id
  ON public.airline_users (airline_id);

CREATE TABLE IF NOT EXISTS public.airports (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(150) NOT NULL,
  iata_code varchar(3) NOT NULL UNIQUE,
  icao_code varchar(4) NOT NULL UNIQUE,
  country_code varchar(2) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_airports_country_code_city
  ON public.airports (country_code, city);

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id integer NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamp without time zone NOT NULL,
  is_revoked boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_refresh_tokens_admin
    FOREIGN KEY (admin_id)
    REFERENCES public.admins(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_admin_id
  ON public.refresh_tokens (admin_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
  ON public.refresh_tokens (expires_at);

CREATE TABLE IF NOT EXISTS public.admin_password_reset_otps (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id integer NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamp without time zone NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_admin_password_reset_otps_admin
    FOREIGN KEY (admin_id)
    REFERENCES public.admins(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_password_reset_otps_admin_id
  ON public.admin_password_reset_otps (admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_password_reset_otps_expires_at
  ON public.admin_password_reset_otps (expires_at);

CREATE TABLE IF NOT EXISTS public.airline_refresh_tokens (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  airline_user_id integer NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamp without time zone NOT NULL,
  is_revoked boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_airline_refresh_tokens_airline_user
    FOREIGN KEY (airline_user_id)
    REFERENCES public.airline_users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_airline_refresh_tokens_user_id
  ON public.airline_refresh_tokens (airline_user_id);

CREATE INDEX IF NOT EXISTS idx_airline_refresh_tokens_expires_at
  ON public.airline_refresh_tokens (expires_at);

CREATE TABLE IF NOT EXISTS public.airline_password_reset_otps (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  airline_user_id integer NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamp without time zone NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_airline_password_reset_otps_airline_user
    FOREIGN KEY (airline_user_id)
    REFERENCES public.airline_users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_airline_password_reset_otps_user_id
  ON public.airline_password_reset_otps (airline_user_id);

CREATE INDEX IF NOT EXISTS idx_airline_password_reset_otps_expires_at
  ON public.airline_password_reset_otps (expires_at);

CREATE TABLE IF NOT EXISTS public.airline_admin_invites (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  airline_id integer NOT NULL,
  invited_by_admin_id integer NOT NULL,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  email varchar(255) NOT NULL,
  job_title varchar(100) NOT NULL,
  token_lookup varchar(64) NOT NULL UNIQUE,
  token_hash text NOT NULL,
  expires_at timestamp without time zone NOT NULL,
  is_accepted boolean NOT NULL DEFAULT false,
  is_revoked boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_airline_admin_invites_airline
    FOREIGN KEY (airline_id)
    REFERENCES public.airlines(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_airline_admin_invites_admin
    FOREIGN KEY (invited_by_admin_id)
    REFERENCES public.admins(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_airline_admin_invites_airline_id
  ON public.airline_admin_invites (airline_id);

CREATE INDEX IF NOT EXISTS idx_airline_admin_invites_admin_id
  ON public.airline_admin_invites (invited_by_admin_id);

CREATE INDEX IF NOT EXISTS idx_airline_admin_invites_email
  ON public.airline_admin_invites (email);

CREATE INDEX IF NOT EXISTS idx_airline_admin_invites_expires_at
  ON public.airline_admin_invites (expires_at);

CREATE TABLE IF NOT EXISTS public.platform_access_controls (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id integer NOT NULL,
  asset varchar(50) NOT NULL,
  access_action varchar(30) NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_platform_access_controls_admin
    FOREIGN KEY (admin_id)
    REFERENCES public.admins(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_platform_access_controls_asset
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
    ),
  CONSTRAINT chk_platform_access_controls_action
    CHECK (
      access_action IN (
        'VIEW',
        'EDIT',
        'DELETE',
        'EXPORT'
      )
    ),
  CONSTRAINT uq_platform_access_controls_admin_asset_action
    UNIQUE (admin_id, asset, access_action)
);

CREATE INDEX IF NOT EXISTS idx_platform_access_controls_admin_id
  ON public.platform_access_controls (admin_id);

CREATE TABLE IF NOT EXISTS public.airline_access_controls (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  airline_user_id integer NOT NULL,
  asset varchar(50) NOT NULL,
  access_action varchar(30) NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_airline_access_controls_user
    FOREIGN KEY (airline_user_id)
    REFERENCES public.airline_users(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_airline_access_controls_asset
    CHECK (
      asset IN (
        'DASHBOARD',
        'AIRPORTS',
        'CANCELLED_FLIGHTS',
        'BOOKINGS',
        'PAYMENTS',
        'SETTINGS',
        'AIRLINE',
        'PROFILE',
        'AIRLINE_USERS'
      )
    ),
  CONSTRAINT chk_airline_access_controls_action
    CHECK (
      access_action IN (
        'VIEW',
        'EDIT',
        'DELETE',
        'EXPORT'
      )
    ),
  CONSTRAINT uq_airline_access_controls_user_asset_action
    UNIQUE (airline_user_id, asset, access_action)
);

CREATE INDEX IF NOT EXISTS idx_airline_access_controls_airline_user_id
  ON public.airline_access_controls (airline_user_id);

CREATE TABLE IF NOT EXISTS public.health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamp without time zone NOT NULL DEFAULT now(),
  status varchar(50) NOT NULL,
  uptime_seconds integer NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);
