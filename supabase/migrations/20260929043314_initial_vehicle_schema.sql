create table public.vehicle_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tank_capacity_liters numeric(6, 3) not null check (tank_capacity_liters > 0),
  initial_odometer_km numeric(10, 1) not null check (initial_odometer_km >= 0),
  initial_full_tank_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.odometer_readings (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  reading_km numeric(10, 1) not null check (reading_km >= 0),
  recorded_at timestamptz not null,
  source text not null check (source in ('manual', 'fuel_entry')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index odometer_readings_user_recorded_at_idx
  on public.odometer_readings (user_id, recorded_at desc);

create table public.fuel_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  odometer_km numeric(10, 1) not null check (odometer_km >= 0),
  amount_cents integer not null check (amount_cents > 0),
  liters numeric(7, 3) not null check (liters > 0),
  full_tank boolean not null default false,
  fueled_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fuel_entries_user_fueled_at_idx
  on public.fuel_entries (user_id, fueled_at desc);

alter table public.vehicle_state enable row level security;
alter table public.odometer_readings enable row level security;
alter table public.fuel_entries enable row level security;

revoke all on table public.vehicle_state from public, anon, authenticated;
revoke all on table public.odometer_readings from public, anon, authenticated;
revoke all on table public.fuel_entries from public, anon, authenticated;

grant select, insert, update on table public.vehicle_state to authenticated;
grant select, insert, update on table public.odometer_readings to authenticated;
grant select, insert, update on table public.fuel_entries to authenticated;

create policy "Users can select their vehicle state"
  on public.vehicle_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their vehicle state"
  on public.vehicle_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their vehicle state"
  on public.vehicle_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can select their odometer readings"
  on public.odometer_readings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their odometer readings"
  on public.odometer_readings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their odometer readings"
  on public.odometer_readings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can select their fuel entries"
  on public.fuel_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their fuel entries"
  on public.fuel_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their fuel entries"
  on public.fuel_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
