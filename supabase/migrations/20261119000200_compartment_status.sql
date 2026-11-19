-- -----------------------------------------------------------------------------
-- PetroCore Supply - Migration: compartment status
--
-- Adds an active/inactive lifecycle to truck compartments. Existing rows are
-- active. Deactivated compartments remain on historical loading records but are
-- hidden from new loading capture.
--
-- Applied to the non-production project on 2026-11-19.
-- Migration history version: 20261119000200.
-- -----------------------------------------------------------------------------

begin;

alter table public.truck_compartments
  add column if not exists status varchar(20) not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'truck_compartments_status_check'
  ) then
    alter table public.truck_compartments
      add constraint truck_compartments_status_check
      check (status::text = any (array['active'::character varying, 'inactive'::character varying]::text[]));
  end if;
end $$;

comment on column public.truck_compartments.status is
  'Active/inactive lifecycle. Inactive compartments stay on historical loading records but are not offered for new loading.';

commit;
