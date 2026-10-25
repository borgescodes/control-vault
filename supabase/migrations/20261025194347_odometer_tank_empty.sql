-- Additive marker for a physically observed empty tank.
-- Historical readings default to false without changing mileage or timestamps.
alter table public.odometer_readings
  add column if not exists tank_empty boolean not null default false;
