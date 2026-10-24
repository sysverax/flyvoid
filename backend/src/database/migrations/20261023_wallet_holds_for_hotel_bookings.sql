-- Wallet payment for cancelled-flight hotel bookings
-- (docs/wallet-cancellation-payment.md).
--
-- An allocation run locks the estimated cost of the PNRs it is about to book
-- (wallet_holds, one per run; wallet_hold_items, one per PNR). Each PNR is
-- charged when the supplier confirms its hotel and its share is released when
-- it does not get booked.

CREATE TABLE IF NOT EXISTS public.wallet_holds (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id integer NOT NULL,
  cancelled_flight_id integer NOT NULL,
  run_id varchar(64) NOT NULL,
  initial_amount numeric(12,2) NOT NULL DEFAULT 0,
  remaining_amount numeric(12,2) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_wallet_holds_run_id UNIQUE (run_id),
  CONSTRAINT fk_wallet_holds_wallet
    FOREIGN KEY (wallet_id)
    REFERENCES public.wallets(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_wallet_holds_cancelled_flight
    FOREIGN KEY (cancelled_flight_id)
    REFERENCES public.cancelled_flights(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_wallet_holds_status
    CHECK (status IN ('OPEN', 'CLOSED')),
  CONSTRAINT chk_wallet_holds_amounts
    CHECK (initial_amount >= 0 AND remaining_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wallet_holds_cancelled_flight_id
  ON public.wallet_holds (cancelled_flight_id);

CREATE TABLE IF NOT EXISTS public.wallet_hold_items (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hold_id integer NOT NULL,
  booking_id integer NOT NULL,
  amount numeric(12,2) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'HELD',
  hotel_booking_id integer,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT uq_wallet_hold_items_hold_booking UNIQUE (hold_id, booking_id),
  CONSTRAINT fk_wallet_hold_items_hold
    FOREIGN KEY (hold_id)
    REFERENCES public.wallet_holds(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_wallet_hold_items_booking
    FOREIGN KEY (booking_id)
    REFERENCES public.cancelled_flight_bookings(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_wallet_hold_items_hotel_booking
    FOREIGN KEY (hotel_booking_id)
    REFERENCES public.hotel_bookings(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_wallet_hold_items_status
    CHECK (status IN ('HELD', 'CHARGED', 'RELEASED')),
  CONSTRAINT chk_wallet_hold_items_amount
    CHECK (amount >= 0)
);

-- A PNR has at most one HELD share at a time, across all holds of its flight.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_hold_items_held_booking
  ON public.wallet_hold_items (booking_id)
  WHERE status = 'HELD';

-- ── hotel_bookings: payment status of each booking attempt ─────────────────
ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS payment_status varchar(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS paid_at timestamp without time zone;

ALTER TABLE public.hotel_bookings
  DROP CONSTRAINT IF EXISTS chk_hotel_bookings_payment_status;
ALTER TABLE public.hotel_bookings
  ADD CONSTRAINT chk_hotel_bookings_payment_status
    CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED'));

-- ── wallet_transactions: each hotel booking is charged at most once ─────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_transactions_booking_debit
  ON public.wallet_transactions (reference_type, reference_id)
  WHERE reference_type = 'BOOKING' AND type = 'DEBIT';
