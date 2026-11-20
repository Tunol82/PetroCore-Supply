-- -----------------------------------------------------------------------------
-- PetroCore Supply - Migration: derive truck capacity
--
-- Truck capacity is the sum of compartment capacities. The manual column is
-- removed so it can never disagree with the compartments again.
--
-- Applied to the non-production project on 2026-11-20.
-- Migration history version: 20261120000100.
-- -----------------------------------------------------------------------------

begin;

alter table public.trucks drop column if exists capacity;

comment on table public.trucks is
  'Truck assets. Capacity is derived from truck_compartments.capacity and is not stored here.';

commit;
