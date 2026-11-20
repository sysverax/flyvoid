-- Hotel split preview (test API): POST /cancelled-flights/plan-preview/splits
-- starts a background search per room split; GET .../splits/:id reads the
-- result. Rows expire after 5 days and are deleted when a new preview starts.
CREATE TABLE IF NOT EXISTS public.hotel_split_previews (
  -- The preview id returned by the POST (requestId in its response).
  id uuid PRIMARY KEY,

  -- RUNNING | COMPLETED | FAILED
  status varchar(20) NOT NULL,

  -- The POST body, and the result once the searches finish.
  request jsonb NOT NULL,
  result jsonb,
  error text,

  -- Who asked: airline users only read their own airline's previews.
  airline_id integer,
  user_id integer,

  expires_at timestamp without time zone NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotel_split_previews_expires_at
  ON public.hotel_split_previews (expires_at);
