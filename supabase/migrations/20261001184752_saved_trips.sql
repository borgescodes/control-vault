create table public.saved_trips (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  origin text not null check (char_length(trim(origin)) between 1 and 80),
  destination text not null check (char_length(trim(destination)) between 1 and 80),
  outbound_distance_km numeric(10, 1) not null check (outbound_distance_km > 0),
  return_distance_km numeric(10, 1) check (return_distance_km is null or return_distance_km > 0),
  deleted_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index saved_trips_user_updated_at_idx
  on public.saved_trips (user_id, updated_at desc);

alter table public.saved_trips enable row level security;

revoke all on table public.saved_trips from public, anon, authenticated;
grant select, insert, update on table public.saved_trips to authenticated;

create policy "Users can select their saved trips"
  on public.saved_trips
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their saved trips"
  on public.saved_trips
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their saved trips"
  on public.saved_trips
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
