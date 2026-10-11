ALTER TABLE public.hotel_booking_attempts
  ADD COLUMN IF NOT EXISTS provider_orders jsonb;

CREATE TABLE IF NOT EXISTS public.supplier_webhook_tokens (
  id serial PRIMARY KEY,

  provider varchar(50) NOT NULL,

  token varchar(255) NOT NULL,

  received_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_webhook_tokens_provider_token
  ON public.supplier_webhook_tokens (provider, token);

CREATE INDEX IF NOT EXISTS idx_hotel_booking_attempts_provider_orders
  ON public.hotel_booking_attempts USING gin (provider_orders jsonb_path_ops);
