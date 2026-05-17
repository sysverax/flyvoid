-- Renames airlines.country to airlines.country_code for PostgreSQL databases.
-- Safe to re-run: it only executes when the old column exists and the new one does not.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'airlines'
      AND column_name = 'country'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'airlines'
      AND column_name = 'country_code'
  ) THEN
    ALTER TABLE public.airlines RENAME COLUMN country TO country_code;
  END IF;
END
$$;
