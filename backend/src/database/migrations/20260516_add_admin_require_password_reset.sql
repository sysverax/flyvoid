ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS require_password_reset boolean NOT NULL DEFAULT false;
