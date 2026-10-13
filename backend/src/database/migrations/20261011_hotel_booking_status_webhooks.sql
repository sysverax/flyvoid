ALTER TABLE public.hotel_booking_attempts
  ADD COLUMN IF NOT EXISTS provider_order_info jsonb,
  ADD COLUMN IF NOT EXISTS provider_order_info_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS provider_orders jsonb;

ALTER TABLE public.hotel_allocations
  ADD COLUMN IF NOT EXISTS hotel_policies jsonb;

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
