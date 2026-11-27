-- Phone number collected at Stripe Checkout. Safe to re-run.
alter table public.stag_steel_orders add column if not exists customer_phone text;
