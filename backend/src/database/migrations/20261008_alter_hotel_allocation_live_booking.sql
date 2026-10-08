CREATE INDEX IF NOT EXISTS idx_hotel_allocations_flight_status
  ON public.hotel_allocations (cancelled_flight_id, status);

ALTER TABLE public.hotel_allocations
  ADD COLUMN IF NOT EXISTS processing_order integer,
  ADD COLUMN IF NOT EXISTS class_priority integer,
  ADD COLUMN IF NOT EXISTS plan_id varchar(64),
  ADD COLUMN IF NOT EXISTS planned_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS room_plan jsonb;

ALTER TABLE public.cancelled_flights
  ADD COLUMN IF NOT EXISTS hotel_allocation_run_id varchar(64),
  ADD COLUMN IF NOT EXISTS hotel_allocation_error text;

CREATE TABLE IF NOT EXISTS public.hotel_booking_candidates (
  id serial PRIMARY KEY,

  cancelled_flight_id integer NOT NULL,

  booking_id integer NOT NULL,

  plan_id varchar(64) NOT NULL,

  candidate_order integer NOT NULL,

  hotel_code varchar(255) NOT NULL,

  hotel_name varchar(255) NOT NULL,

  category varchar(255) NOT NULL,

  stars integer NOT NULL,

  tier varchar(20) NOT NULL,

  estimated_price decimal(10,2) NOT NULL,

  currency varchar(10),

  rooms jsonb NOT NULL,

  created_at timestamp without time zone NOT NULL DEFAULT now(),

  CONSTRAINT fk_hotel_booking_candidates_flight
    FOREIGN KEY (cancelled_flight_id)
    REFERENCES public.cancelled_flights(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_hotel_booking_candidates_booking
    FOREIGN KEY (booking_id)
    REFERENCES public.cancelled_flight_bookings(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hotel_booking_candidates_plan_order
  ON public.hotel_booking_candidates (plan_id, booking_id, candidate_order);

CREATE TABLE IF NOT EXISTS public.hotel_booking_attempts (
  id serial PRIMARY KEY,

  cancelled_flight_id integer NOT NULL,

  booking_id integer NOT NULL,

  candidate_id integer,

  plan_id varchar(64),

  run_id varchar(64),

  attempt_order integer NOT NULL,

  status varchar(20) NOT NULL,

  hotel_code varchar(255),

  hotel_name varchar(255),

  category varchar(255),

  rate_keys jsonb NOT NULL,

  provider varchar(50) NOT NULL,

  provider_status varchar(50),

  provider_booking_reference varchar(255),

  provider_request_id varchar(64) NOT NULL,

  provider_idempotency_key varchar(255),

  provider_request_sent_at timestamp without time zone,

  provider_response_received_at timestamp without time zone,

  failure_code varchar(50),

  failure_reason text,

  created_at timestamp without time zone NOT NULL DEFAULT now(),

  updated_at timestamp without time zone NOT NULL DEFAULT now(),

  CONSTRAINT fk_hotel_booking_attempts_flight
    FOREIGN KEY (cancelled_flight_id)
    REFERENCES public.cancelled_flights(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_hotel_booking_attempts_booking
    FOREIGN KEY (booking_id)
    REFERENCES public.cancelled_flight_bookings(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_hotel_booking_attempts_candidate
    FOREIGN KEY (candidate_id)
    REFERENCES public.hotel_booking_candidates(id)
    ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hotel_booking_attempts_booking_order
  ON public.hotel_booking_attempts (booking_id, attempt_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hotel_booking_attempts_one_active
  ON public.hotel_booking_attempts (booking_id)
  WHERE status <> 'failed';

CREATE INDEX IF NOT EXISTS idx_hotel_booking_attempts_flight_status
  ON public.hotel_booking_attempts (cancelled_flight_id, status);
