-- Normalizes the hotel booking schema:
--   providers  -> hotels  -> hotel_bookings (one row per booking attempt) -> hotel_booking_rooms
--   cancelled_flight_bookings keeps each PNR's allocation state and points at its confirmed booking.
-- Replaces hotel_allocations (dropped) and renames hotel_booking_attempts to hotel_bookings.
-- Supplier references and rate keys are kept once, on hotel_booking_rooms.
-- hotel_bookings holds booking facts only; hotel details are read from hotels.
-- hotel_booking_candidates is renamed to hotel_allocation_options.

-- ── Legacy allocation rows, with the provider they were booked through ─────
CREATE TEMP TABLE _alloc ON COMMIT DROP AS
SELECT a.*,
       a.status::text AS status_text,
       CASE
         WHEN a.booking_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-'
           OR EXISTS (SELECT 1 FROM public.hotel_booking_candidates c WHERE c.hotel_code = a.hotel_code)
           OR EXISTS (SELECT 1 FROM public.hotel_booking_attempts t WHERE t.hotel_code = a.hotel_code)
         THEN 'ratehawk'
         ELSE 'hotelbeds'
       END AS provider_code
  FROM public.hotel_allocations a;

-- ── providers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.providers (
  id serial PRIMARY KEY,
  code varchar(50) NOT NULL,
  name varchar(100) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_providers_code UNIQUE (code)
);

INSERT INTO public.providers (code, name)
VALUES ('ratehawk', 'RateHawk'), ('hotelbeds', 'Hotelbeds')
ON CONFLICT (code) DO NOTHING;

-- ── hotels: static hotel data per provider ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hotels (
  id serial PRIMARY KEY,
  provider_id integer NOT NULL REFERENCES public.providers (id),
  provider_hotel_id varchar(255) NOT NULL,
  name varchar(255) NOT NULL DEFAULT '',
  star_rating integer,
  kind varchar(50),
  address text,
  postal_code varchar(20),
  country_code varchar(2),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  contact jsonb,
  website text,
  image_url text,
  amenities jsonb,
  policies jsonb,
  is_active boolean NOT NULL DEFAULT true,
  content_updated_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_hotels_provider_hotel UNIQUE (provider_id, provider_hotel_id)
);

INSERT INTO public.hotels (
  provider_id, provider_hotel_id, name, star_rating, address,
  latitude, longitude, contact, website, image_url, amenities, policies, content_updated_at
)
SELECT DISTINCT ON (p.id, a.hotel_code)
       p.id, a.hotel_code, a.hotel_name,
       NULLIF(NULLIF(substring(a.category FROM '(\d+)'), '')::integer, 0),
       a.address, a.latitude, a.longitude, a.contact, a.website,
       a.image_url, a.amenities, a.hotel_policies, a.updated_at
  FROM _alloc a
  JOIN public.providers p ON p.code = a.provider_code
 WHERE a.hotel_code <> ''
 ORDER BY p.id, a.hotel_code, (a.address IS NOT NULL) DESC, a.updated_at DESC
ON CONFLICT (provider_id, provider_hotel_id) DO NOTHING;

INSERT INTO public.hotels (provider_id, provider_hotel_id, name, star_rating)
SELECT DISTINCT ON (c.hotel_code)
       p.id, c.hotel_code, c.hotel_name, NULLIF(c.stars, 0)
  FROM public.hotel_booking_candidates c
  JOIN public.providers p ON p.code = 'ratehawk'
 ORDER BY c.hotel_code, c.created_at DESC
ON CONFLICT (provider_id, provider_hotel_id) DO NOTHING;

INSERT INTO public.hotels (provider_id, provider_hotel_id, name, star_rating)
SELECT DISTINCT ON (t.provider, t.hotel_code)
       p.id, t.hotel_code, COALESCE(t.hotel_name, ''),
       NULLIF(NULLIF(substring(t.category FROM '(\d+)'), '')::integer, 0)
  FROM public.hotel_booking_attempts t
  JOIN public.providers p ON p.code = t.provider
 WHERE COALESCE(t.hotel_code, '') <> ''
 ORDER BY t.provider, t.hotel_code, t.id DESC
ON CONFLICT (provider_id, provider_hotel_id) DO NOTHING;

-- ── PNR allocation state (moved from hotel_allocations) ─────────────────────
ALTER TABLE public.cancelled_flight_bookings
  ADD COLUMN IF NOT EXISTS allocation_status varchar(50) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS allocation_reason text,
  ADD COLUMN IF NOT EXISTS confirmed_hotel_booking_id integer,
  ADD COLUMN IF NOT EXISTS processing_order integer,
  ADD COLUMN IF NOT EXISTS class_priority integer,
  ADD COLUMN IF NOT EXISTS plan_id varchar(64),
  ADD COLUMN IF NOT EXISTS planned_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS room_plan jsonb;

UPDATE public.cancelled_flight_bookings b
   SET allocation_status = a.status_text,
       allocation_reason = a.reason,
       processing_order = a.processing_order,
       class_priority = a.class_priority,
       plan_id = a.plan_id,
       planned_at = a.planned_at,
       room_plan = a.room_plan
  FROM _alloc a
 WHERE a.booking_id = b.id;

-- ── hotel_bookings: one row per booking attempt ─────────────────────────────
ALTER TABLE public.hotel_booking_attempts RENAME TO hotel_bookings;
ALTER INDEX IF EXISTS public.uq_hotel_booking_attempts_booking_order RENAME TO uq_hotel_bookings_booking_order;
ALTER INDEX IF EXISTS public.uq_hotel_booking_attempts_one_active RENAME TO uq_hotel_bookings_one_active;
ALTER INDEX IF EXISTS public.idx_hotel_booking_attempts_flight_status RENAME TO idx_hotel_bookings_flight_status;

ALTER TABLE public.hotel_bookings
  ADD COLUMN provider_id integer REFERENCES public.providers (id),
  ADD COLUMN hotel_id integer REFERENCES public.hotels (id),
  ADD COLUMN check_in_date date,
  ADD COLUMN check_out_date date,
  ADD COLUMN currency varchar(10),
  ADD COLUMN actual_price numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN buying_price numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN platform_fee_percentage numeric(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN platform_fee numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN total_price numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN earnings numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN completed_at timestamp without time zone,
  ADD COLUMN failed_at timestamp without time zone,
  ADD COLUMN legacy_allocation_id integer;

UPDATE public.hotel_bookings t SET provider_id = p.id FROM public.providers p WHERE p.code = t.provider;
UPDATE public.hotel_bookings t
   SET hotel_id = h.id
  FROM public.hotels h
 WHERE h.provider_id = t.provider_id AND h.provider_hotel_id = t.hotel_code;
UPDATE public.hotel_bookings SET completed_at = provider_response_received_at WHERE status = 'success';
UPDATE public.hotel_bookings SET failed_at = updated_at WHERE status = 'failed';

-- Stay and money for attempts that confirmed an allocation.
UPDATE public.hotel_bookings t
   SET legacy_allocation_id = a.id,
       check_in_date = a.check_in_date,
       check_out_date = a.check_out_date,
       actual_price = a.actual_price,
       buying_price = a.buying_price,
       platform_fee_percentage = a.platform_fee_percentage,
       platform_fee = a.platform_fee,
       total_price = a.total_price,
       earnings = a.earnings
  FROM _alloc a
 WHERE a.booking_id = t.booking_id
   AND t.status = 'success'
   AND a.status_text IN ('confirmed', 'completed', 'cancelled')
   AND a.booking_reference = t.provider_booking_reference;

UPDATE public.hotel_bookings t
   SET platform_fee_percentage = a.platform_fee_percentage
  FROM _alloc a
 WHERE a.booking_id = t.booking_id AND t.legacy_allocation_id IS NULL;

-- Allocations confirmed before booking attempts existed get one booking row each.
INSERT INTO public.hotel_bookings (
  cancelled_flight_id, booking_id, attempt_order, status, rate_keys,
  provider, provider_id, hotel_id, provider_booking_reference, provider_request_id,
  provider_request_sent_at, provider_response_received_at, completed_at, created_at, updated_at,
  check_in_date, check_out_date,
  actual_price, buying_price, platform_fee_percentage, platform_fee, total_price, earnings,
  legacy_allocation_id
)
SELECT a.cancelled_flight_id, a.booking_id,
       COALESCE((SELECT max(t.attempt_order) FROM public.hotel_bookings t WHERE t.booking_id = a.booking_id), 0) + 1,
       'success',
       COALESCE((SELECT jsonb_agg(r ->> 'rateKey') FROM jsonb_array_elements(COALESCE(a.rooms, '[]'::jsonb)) r WHERE r ? 'rateKey'), '[]'::jsonb),
       a.provider_code, p.id, h.id, a.booking_reference, 'legacy-' || a.id,
       a.created_at, a.updated_at, a.updated_at, a.created_at, a.updated_at,
       a.check_in_date, a.check_out_date,
       a.actual_price, a.buying_price, a.platform_fee_percentage, a.platform_fee, a.total_price, a.earnings,
       a.id
  FROM _alloc a
  JOIN public.providers p ON p.code = a.provider_code
  LEFT JOIN public.hotels h ON h.provider_id = p.id AND h.provider_hotel_id = a.hotel_code
 WHERE a.status_text IN ('confirmed', 'completed', 'cancelled')
   AND NOT EXISTS (SELECT 1 FROM public.hotel_bookings t WHERE t.legacy_allocation_id = a.id)
   AND NOT EXISTS (SELECT 1 FROM public.hotel_bookings t WHERE t.booking_id = a.booking_id AND t.status <> 'failed');

UPDATE public.hotel_bookings t
   SET check_in_date = f.cancellation_date,
       check_out_date = f.cancellation_date + 1
  FROM public.cancelled_flights f
 WHERE f.id = t.cancelled_flight_id AND t.check_in_date IS NULL;

UPDATE public.cancelled_flight_bookings b
   SET confirmed_hotel_booking_id = t.id
  FROM public.hotel_bookings t
 WHERE t.booking_id = b.id
   AND t.status = 'success'
   AND t.legacy_allocation_id IS NOT NULL
   AND b.allocation_status IN ('confirmed', 'completed', 'cancelled');

-- ── hotel_booking_rooms: one row per room (each room is its own supplier order) ──
CREATE TABLE IF NOT EXISTS public.hotel_booking_rooms (
  id serial PRIMARY KEY,
  hotel_booking_id integer NOT NULL REFERENCES public.hotel_bookings (id) ON DELETE CASCADE,
  room_no integer NOT NULL,
  room_name text NOT NULL DEFAULT '',
  board_name varchar(255) NOT NULL DEFAULT '',
  adults integer NOT NULL DEFAULT 0,
  children integer NOT NULL DEFAULT 0,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  buying_price numeric(10, 2) NOT NULL DEFAULT 0,
  rate_key text,
  taxes_at_property jsonb,
  partner_order_id varchar(255),
  provider_order_id varchar(255),
  status varchar(20) NOT NULL DEFAULT 'booked',
  failure_reason text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_hotel_booking_rooms_room UNIQUE (hotel_booking_id, room_no)
);

CREATE INDEX IF NOT EXISTS idx_hotel_booking_rooms_partner_order
  ON public.hotel_booking_rooms (partner_order_id);

-- Rooms recorded per supplier order (newer attempts).
INSERT INTO public.hotel_booking_rooms (
  hotel_booking_id, room_no, room_name, board_name, adults, children, price, buying_price,
  rate_key, taxes_at_property, partner_order_id, status, failure_reason
)
SELECT t.id, (o ->> 'room')::integer,
       COALESCE(o -> 'check' ->> 'roomName', ''), COALESCE(o -> 'check' ->> 'boardName', ''),
       COALESCE((o -> 'check' ->> 'adults')::integer, 0), COALESCE((o -> 'check' ->> 'children')::integer, 0),
       COALESCE((o -> 'check' ->> 'netPrice')::numeric, 0),
       COALESCE((o -> 'check' ->> 'buyingPrice')::numeric, (o -> 'check' ->> 'netPrice')::numeric, 0),
       o ->> 'rateKey', COALESCE(o -> 'check' -> 'taxesAtProperty', '[]'::jsonb),
       o ->> 'reference', COALESCE(o ->> 'status', 'pending'), o ->> 'failureReason'
  FROM public.hotel_bookings t, jsonb_array_elements(t.provider_orders) o
 WHERE t.provider_orders IS NOT NULL
ON CONFLICT (hotel_booking_id, room_no) DO NOTHING;

-- Final booked room details from the allocation override the rate-check snapshot.
UPDATE public.hotel_booking_rooms r
   SET room_name = COALESCE(x.room ->> 'roomName', r.room_name),
       board_name = COALESCE(x.room ->> 'boardName', r.board_name),
       price = COALESCE((x.room ->> 'price')::numeric, r.price),
       taxes_at_property = COALESCE(x.room -> 'taxesAtProperty', r.taxes_at_property)
  FROM (
    SELECT t.id AS hotel_booking_id, e.room_no, e.room
      FROM public.hotel_bookings t
      JOIN _alloc a ON a.id = t.legacy_allocation_id,
           jsonb_array_elements(COALESCE(a.rooms, '[]'::jsonb)) WITH ORDINALITY e(room, room_no)
  ) x
 WHERE r.hotel_booking_id = x.hotel_booking_id AND r.room_no = x.room_no;

-- Rooms for bookings that never recorded supplier orders (older bookings).
INSERT INTO public.hotel_booking_rooms (
  hotel_booking_id, room_no, room_name, board_name, adults, children, price, buying_price,
  rate_key, taxes_at_property, partner_order_id, status
)
SELECT t.id, e.room_no,
       COALESCE(e.room ->> 'roomName', ''), COALESCE(e.room ->> 'boardName', ''),
       COALESCE((e.room ->> 'adults')::integer, 0), COALESCE((e.room ->> 'children')::integer, 0),
       COALESCE((e.room ->> 'price')::numeric, 0),
       ROUND(COALESCE((e.room ->> 'price')::numeric, 0) * COALESCE(a.buying_price / NULLIF(a.actual_price, 0), 1), 2),
       e.room ->> 'rateKey', COALESCE(e.room -> 'taxesAtProperty', '[]'::jsonb),
       NULLIF(split_part(COALESCE(t.provider_booking_reference, ''), ',', e.room_no::integer), ''),
       'booked'
  FROM public.hotel_bookings t
  JOIN _alloc a ON a.id = t.legacy_allocation_id,
       jsonb_array_elements(COALESCE(a.rooms, '[]'::jsonb)) WITH ORDINALITY e(room, room_no)
 WHERE NOT EXISTS (SELECT 1 FROM public.hotel_booking_rooms r WHERE r.hotel_booking_id = t.id);

-- Rooms for attempts that never recorded supplier orders (e.g. failed before booking):
-- rate keys and references now live only on the room rows.
INSERT INTO public.hotel_booking_rooms (hotel_booking_id, room_no, rate_key, partner_order_id, status)
SELECT t.id, k.room_no, k.rate_key,
       NULLIF(split_part(COALESCE(t.provider_booking_reference, ''), ',', k.room_no::integer), ''),
       CASE t.status WHEN 'failed' THEN 'failed' WHEN 'success' THEN 'booked' ELSE 'pending' END
  FROM public.hotel_bookings t,
       jsonb_array_elements_text(COALESCE(t.rate_keys, '[]'::jsonb)) WITH ORDINALITY k(rate_key, room_no)
 WHERE NOT EXISTS (SELECT 1 FROM public.hotel_booking_rooms r WHERE r.hotel_booking_id = t.id);

-- Bookings with a reference but neither rooms nor rate keys keep the reference on one room.
INSERT INTO public.hotel_booking_rooms (hotel_booking_id, room_no, partner_order_id, status)
SELECT t.id, 1, t.provider_booking_reference, 'booked'
  FROM public.hotel_bookings t
 WHERE COALESCE(t.provider_booking_reference, '') <> ''
   AND NOT EXISTS (SELECT 1 FROM public.hotel_booking_rooms r WHERE r.hotel_booking_id = t.id);

-- ── hotel_allocation_options (was hotel_booking_candidates): reference hotels ──
ALTER TABLE public.hotel_booking_candidates RENAME TO hotel_allocation_options;
ALTER INDEX IF EXISTS public.uq_hotel_booking_candidates_plan_order RENAME TO uq_hotel_allocation_options_plan_order;

ALTER TABLE public.hotel_allocation_options
  ADD COLUMN hotel_id integer REFERENCES public.hotels (id),
  ADD COLUMN distance_from_airport_km numeric;

UPDATE public.hotel_allocation_options o
   SET hotel_id = h.id
  FROM public.hotels h
  JOIN public.providers p ON p.id = h.provider_id AND p.code = 'ratehawk'
 WHERE h.provider_hotel_id = o.hotel_code;

-- Distance to the airport belongs to the option a booking was made from.
UPDATE public.hotel_allocation_options o
   SET distance_from_airport_km = a.distance_from_airport_km
  FROM public.hotel_bookings t
  JOIN _alloc a ON a.id = t.legacy_allocation_id
 WHERE o.id = t.candidate_id AND a.distance_from_airport_km IS NOT NULL;

ALTER TABLE public.hotel_allocation_options
  ALTER COLUMN hotel_id SET NOT NULL,
  DROP COLUMN hotel_code,
  DROP COLUMN hotel_name,
  DROP COLUMN category,
  DROP COLUMN stars;

-- ── Finish hotel_bookings ───────────────────────────────────────────────────
ALTER TABLE public.hotel_bookings
  ALTER COLUMN provider_id SET NOT NULL,
  DROP COLUMN provider,
  DROP COLUMN hotel_code,
  DROP COLUMN hotel_name,
  DROP COLUMN category,
  DROP COLUMN plan_id,
  DROP COLUMN provider_orders,
  DROP COLUMN provider_idempotency_key,
  DROP COLUMN rate_keys,
  DROP COLUMN provider_booking_reference,
  DROP COLUMN legacy_allocation_id;

CREATE INDEX IF NOT EXISTS idx_hotel_bookings_hotel ON public.hotel_bookings (hotel_id);

ALTER TABLE public.cancelled_flight_bookings
  ADD CONSTRAINT fk_cancelled_flight_bookings_confirmed_hotel_booking
  FOREIGN KEY (confirmed_hotel_booking_id) REFERENCES public.hotel_bookings (id) ON DELETE SET NULL;

-- ── Remove the old per-PNR allocation table ─────────────────────────────────
DROP TABLE public.hotel_allocations;
DROP TYPE IF EXISTS public.hotel_allocations_status_enum;
