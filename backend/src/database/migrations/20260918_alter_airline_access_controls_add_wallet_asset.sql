-- Adds WALLET to the allowed asset list for airline_access_controls.
-- AirlineAsset.WALLET was added in code (access-control.constants.ts) for the
-- new wallet APIs; without this, creating an airline admin fails, because
-- buildAirlineAdminAccessControls() grants every AirlineAsset value and the
-- insert for 'WALLET' would violate the old CHECK constraint.

ALTER TABLE public.airline_access_controls
  DROP CONSTRAINT IF EXISTS chk_airline_access_controls_asset;

ALTER TABLE public.airline_access_controls
  ADD CONSTRAINT chk_airline_access_controls_asset
    CHECK (
      asset IN (
        'DASHBOARD',
        'WALLET',
        'AIRPORTS',
        'CANCELLED_FLIGHTS',
        'BOOKINGS',
        'PAYMENTS',
        'SETTINGS',
        'AIRLINE',
        'PROFILE',
        'AIRLINE_USERS'
      )
    );
