alter table public.vehicle_state
  alter column initial_full_tank_at drop not null;

alter table public.fuel_entries
  add column estimated_liters numeric(7, 3),
  add column reference_price_per_liter numeric(8, 3),
  add column reference_week_start date,
  add column reference_week_end date;

update public.fuel_entries
set estimated_liters = liters
where estimated_liters is null;

alter table public.fuel_entries
  alter column liters drop not null;
