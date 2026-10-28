-- A cancellation's platform fee is frozen at its first allocation run, so
-- later runs and retries keep it even if the airline's fee changes. The fee
-- column defaults to 0, and 0% is now a valid fee, so a separate timestamp
-- says whether it is frozen. NULL: not frozen yet, the airline's fee applies.

ALTER TABLE public.cancelled_flights
  ADD COLUMN IF NOT EXISTS platform_fee_locked_at timestamptz;

-- Flights that already started allocation keep their current fee: frozen at
-- their first hotel booking attempt. Flights never allocated stay unfrozen.
UPDATE public.cancelled_flights flight
   SET platform_fee_locked_at = first_attempt.created_at
  FROM (
        SELECT cancelled_flight_id, MIN(created_at) AS created_at
          FROM public.hotel_bookings
         GROUP BY cancelled_flight_id
       ) first_attempt
 WHERE first_attempt.cancelled_flight_id = flight.id
   AND flight.platform_fee_locked_at IS NULL;
