-- Adds airline auth persistence schema for 2FA, refresh tokens, and forgot-password OTP.
-- PostgreSQL idempotent script.

ALTER TABLE public.airline_users
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS two_factor_temp_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS two_factor_recovery_code_hashes text;

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
