-- Add is_revoked flag for airline admin invitations.
-- This supports revoked invitation lifecycle and matrix reporting.

ALTER TABLE IF EXISTS public.airline_admin_invites
  ADD COLUMN IF NOT EXISTS is_revoked boolean NOT NULL DEFAULT false;
