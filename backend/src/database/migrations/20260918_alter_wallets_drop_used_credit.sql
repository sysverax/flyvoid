-- Drops wallets.used_credit — it was never updated after wallet creation
-- (always 0) and duplicated data already derivable from balance. A wallet
-- is only "using credit" once its balance dips below zero, so used credit
-- is simply -balance for any wallet currently in that state; the app now
-- computes it on read instead of storing it.

ALTER TABLE public.wallets
  DROP COLUMN IF EXISTS used_credit;
