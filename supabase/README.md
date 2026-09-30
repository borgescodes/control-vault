# Supabase

Target project: `control-vault` (`zlvabzvosmzapvznemiu`, `sa-east-1`).

## Schema changes

Create migrations with the Supabase CLI and keep them in `supabase/migrations`.
Apply migrations to the target project through the connected Supabase tooling.

The MVP exposes only these application tables through the Data API:

- `vehicle_state`
- `odometer_readings`
- `fuel_entries`

All three tables use row level security. The `authenticated` role has only
`select`, `insert`, and `update`; `anon` has no table privileges. Policies bind
every operation to `auth.uid() = user_id`. Delete is intentionally unavailable.

## Authentication

Create the single personal account manually in Supabase Auth. Keep public signup
disabled and anonymous sign-ins disabled. Do not store account credentials or
privileged keys in this repository.

The browser application may use only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
