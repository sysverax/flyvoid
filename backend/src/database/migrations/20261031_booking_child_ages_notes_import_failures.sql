-- Bookings & Passengers (wizard step 2):
--  1. Child ages per booking (one age per child, 0-12).
--  2. Special Notes become one editable text in special_notes (preset labels
--     and free text, comma-separated). It used to hold preset codes only, with
--     free text in additional_notes; both are merged and additional_notes is
--     dropped. Hotel allocation reads the presets from the text.
--  3. CSV rows that fail validation are kept as failed bookings so the user
--     can fix or delete them; they are never imported silently.
--  4. One booking per PNR per cancelled flight, ignoring case and spaces,
--     enforced by a unique index.

-- 1. Child ages ---------------------------------------------------------------
ALTER TABLE public.cancelled_flight_bookings
  ADD COLUMN IF NOT EXISTS child_ages jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Special Notes text -----------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'cancelled_flight_bookings'
       AND column_name = 'additional_notes'
  ) THEN
    -- special_notes held comma-separated preset codes: turn them into their
    -- labels, then append the additional notes text.
    UPDATE public.cancelled_flight_bookings b
       SET special_notes = NULLIF(
             concat_ws(', ',
               NULLIF((
                 SELECT string_agg(
                          CASE trim(tag)
                            WHEN 'wheelchair_assistance' THEN 'Wheelchair Assistance'
                            WHEN 'medical_needs' THEN 'Medical Needs'
                            WHEN 'infant' THEN 'Infant'
                            WHEN 'late_arrival' THEN 'Late Arrival'
                            WHEN 'dietary_requirements' THEN 'Dietary Requirements'
                            WHEN 'elderly_passenger' THEN 'Elderly Passenger'
                            ELSE trim(tag)
                          END,
                          ', ' ORDER BY ord)
                   FROM unnest(string_to_array(coalesce(b.special_notes, ''), ','))
                        WITH ORDINALITY AS t(tag, ord)
                  WHERE trim(tag) <> ''
               ), ''),
               NULLIF(trim(b.additional_notes), '')
             ),
             '')
     WHERE coalesce(trim(b.special_notes), '') <> ''
        OR coalesce(trim(b.additional_notes), '') <> '';

    ALTER TABLE public.cancelled_flight_bookings DROP COLUMN additional_notes;
  END IF;
END $$;

-- 3. Failed CSV rows ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cancelled_flight_booking_import_failures (
  id serial PRIMARY KEY,

  cancelled_flight_id integer NOT NULL,

  -- Name of the uploaded file and the row's line in it (header = row 1).
  file_name varchar(255),
  row_number integer NOT NULL,

  -- The row's values, keyed by booking field, normalised where they parsed
  -- (e.g. passport country as a code), otherwise exactly as in the file.
  "values" jsonb NOT NULL,

  -- [{ "field": "email", "message": "..." }, ...]
  errors jsonb NOT NULL,

  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),

  CONSTRAINT fk_booking_import_failures_flight
    FOREIGN KEY (cancelled_flight_id)
    REFERENCES public.cancelled_flights(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_booking_import_failures_flight_id
  ON public.cancelled_flight_booking_import_failures (cancelled_flight_id);

-- 4. Unique PNR per flight ----------------------------------------------------
-- PNRs (record locators) are case-insensitive, so the key is the trimmed,
-- uppercase PNR: "abc123" and "ABC123" are the same booking. The API stores
-- PNRs in that form; older rows are left as entered and the index still
-- compares them in that form. The index also closes the race where two
-- requests (two imports, or an import and a fix) both pass the PNR check and
-- both insert.

-- Stop with a list if a flight already has the same PNR twice: those must be
-- merged or deleted by hand first (which one to keep is a business decision).
DO $$
DECLARE
  duplicates text;
BEGIN
  SELECT string_agg(
           format('flight %s: %s (booking ids %s)',
                  cancelled_flight_id, pnr_key, ids),
           '; ')
    INTO duplicates
    FROM (
          SELECT cancelled_flight_id,
                 upper(btrim(pnr)) AS pnr_key,
                 string_agg(id::text, ', ' ORDER BY id) AS ids
            FROM public.cancelled_flight_bookings
           GROUP BY cancelled_flight_id, upper(btrim(pnr))
          HAVING count(*) > 1
         ) d;
  IF duplicates IS NOT NULL THEN
    RAISE EXCEPTION
      'Duplicate PNRs on cancelled flights (ignoring case): %. Merge or delete them, then run this migration again.',
      duplicates;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cancelled_flight_bookings_flight_pnr
  ON public.cancelled_flight_bookings (cancelled_flight_id, upper(btrim(pnr)));
