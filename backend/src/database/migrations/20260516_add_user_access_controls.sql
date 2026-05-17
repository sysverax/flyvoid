-- Adds user-scoped access-control storage for platform and airline domains.

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
