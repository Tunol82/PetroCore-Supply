-- =============================================================================
-- PetroCore Supply — Migration 21: Reject assignments to cancelled trips
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115002100.
--
-- Migration 19 skipped the double-booking check for cancelled trips so that a
-- cancellation could release its vehicles. That also let a cancelled trip take
-- a new assignment, which would leave the truck and driver unavailable for no
-- operational reason. Cancelled trips now reject new assignments.
-- =============================================================================

begin;

create or replace function app.check_assignment_double_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_status varchar(30);
begin
  if new.released_at is not null then
    return new;
  end if;

  select status
    into v_trip_status
  from public.trips
  where id = new.trip_id
    and organisation_id = new.organisation_id;

  if v_trip_status is null then
    raise exception 'trip not found for this organisation';
  end if;

  if v_trip_status = 'cancelled' then
    raise exception 'cancelled trips cannot be assigned';
  end if;

  -- Serialise concurrent assignments for the same truck and the same driver.
  perform 1
  from public.trucks
  where id = new.truck_id
    and organisation_id = new.organisation_id
  for update;

  if not found then
    raise exception 'truck not found for this organisation';
  end if;

  perform 1
  from public.drivers
  where id = new.driver_id
    and organisation_id = new.organisation_id
  for update;

  if not found then
    raise exception 'driver not found for this organisation';
  end if;

  if exists (
    select 1
    from public.trip_assignments ta
    join public.trips t
      on t.id = ta.trip_id
     and t.organisation_id = ta.organisation_id
    where ta.organisation_id = new.organisation_id
      and ta.id <> new.id
      and ta.released_at is null
      and ta.truck_id = new.truck_id
      and t.status <> 'cancelled'
  ) then
    raise exception 'truck already has an active assignment';
  end if;

  if exists (
    select 1
    from public.trip_assignments ta
    join public.trips t
      on t.id = ta.trip_id
     and t.organisation_id = ta.organisation_id
    where ta.organisation_id = new.organisation_id
      and ta.id <> new.id
      and ta.released_at is null
      and ta.driver_id = new.driver_id
      and t.status <> 'cancelled'
  ) then
    raise exception 'driver already has an active assignment';
  end if;

  return new;
end;
$$;

revoke all on function app.check_assignment_double_booking() from public;

commit;
