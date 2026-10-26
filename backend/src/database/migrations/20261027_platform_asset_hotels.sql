-- New platform asset HOTELS: the admin hotel availability page (VIEW) and its
-- CSV export (EXPORT).

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
        'HOTELS',
        'REVENUE',
        'PAYMENTS',
        'INVITES_ONBOARDING',
        'SYSTEM_SETTINGS',
        'AUDIT_LOGS',
        'PROFILE',
        'ADMIN_USERS'
      )
    );

-- Existing super admins get full HOTELS access, like the rows written for
-- every asset when a super admin is created (VIEW, EDIT, EXPORT).
INSERT INTO public.platform_access_controls (admin_id, asset, access_action)
SELECT admin.id, 'HOTELS', action.name
  FROM public.admins admin
 CROSS JOIN (VALUES ('VIEW'), ('EDIT'), ('EXPORT')) AS action(name)
 WHERE admin.role = 'SUPER_ADMIN'
ON CONFLICT (admin_id, asset, access_action) DO NOTHING;
