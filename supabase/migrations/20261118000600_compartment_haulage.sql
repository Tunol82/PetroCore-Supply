-- -----------------------------------------------------------------------------
-- PetroCore Supply - Migration: compartment haulage quote
--
-- Adds an optional per-compartment haulage cost to a loading record. This is
-- the amount agreed for that tank on that lift, not a billed invoice line. The
-- trip statement compares it with the invoice split by loaded volume.
--
-- Applied to the non-production project on 2026-11-18.
-- Migration history version: 20261118000600.
-- -----------------------------------------------------------------------------

begin;

alter table public.trip_loading_records
  add column if not exists haulage_cost numeric(18,2)
  check (haulage_cost is null or haulage_cost >= 0);

commit;
