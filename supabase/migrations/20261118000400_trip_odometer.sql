-- -----------------------------------------------------------------------------
-- PetroCore Supply - Migration: trip odometer
--
-- Adds optional odometer readings at departure and arrival so distance, fuel
-- efficiency (km/L) and cost per km can be derived. Readings are plain numbers;
-- no unit conversion is applied.
--
-- Applied to the non-production project on 2026-11-18.
-- Migration history version: 20261118000400.
-- -----------------------------------------------------------------------------

begin;

alter table public.trips
  add column if not exists odometer_start numeric(12,1) check (odometer_start is null or odometer_start >= 0),
  add column if not exists odometer_end   numeric(12,1) check (odometer_end is null or odometer_end >= 0);

alter table public.trips
  add constraint trips_odometer_order
  check (odometer_start is null or odometer_end is null or odometer_end >= odometer_start);

commit;
