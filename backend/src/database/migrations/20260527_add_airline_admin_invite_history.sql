-- Add airline_admin_invite_history table.
-- Records every state-changing event on an invitation: SENT, RESENT, REVOKED, ACCEPTED.
-- One invitation can have many history rows (one-to-many).

CREATE TYPE IF NOT EXISTS public.airline_invitation_history_event_enum
  AS ENUM ('SENT', 'RESENT', 'REVOKED', 'ACCEPTED');

CREATE TABLE IF NOT EXISTS public.airline_admin_invite_history (
  id                      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invitation_id           integer NOT NULL
    REFERENCES public.airline_admin_invites (id) ON DELETE CASCADE,
  event                   public.airline_invitation_history_event_enum NOT NULL,
  performed_by_admin_id   integer
    REFERENCES public.admins (id) ON DELETE SET NULL,
  created_at              timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_airline_admin_invite_history_invitation_id
  ON public.airline_admin_invite_history (invitation_id);
