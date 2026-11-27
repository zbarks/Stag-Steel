-- Columns the /portal uses. Safe to re-run.
alter table public.orders add column if not exists exclude_from_revenue boolean not null default false;
