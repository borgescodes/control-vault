alter table public.odometer_readings
  alter column created_at drop default,
  alter column updated_at drop default;

alter table public.fuel_entries
  alter column created_at drop default,
  alter column updated_at drop default;
