-- Packing choice and customer note from the cart. Safe to re-run.
alter table public.stag_steel_orders add column if not exists packaging text;
alter table public.stag_steel_orders add column if not exists customer_note text;
alter table public.stag_steel_orders add column if not exists boxes integer;
