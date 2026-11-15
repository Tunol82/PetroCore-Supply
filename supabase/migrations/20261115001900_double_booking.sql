-- =============================================================================
-- PetroCore Supply — Migration 19: Double-booking prevention
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115001900.
--
-- A truck or driver cannot hold two active assignments at the same time.
--
-- Trip departure and arrival times are optional and stored at day granularity,
-- so an overlap test on those columns would silently allow double-booking for
-- undated trips. The invariant is therefore assignment-based: a truck and a
-- driver are busy until their assignment is released. Releasing is explicit so
-- the dispatcher stays in control of when a vehicle becomes available again.
--
-- Guarantees enforced here:
--   * inserting or reactivating an assignment checks the truck and the driver;
--   * the truck and driver rows are locked while checking, so two concurrent
--     assignments cannot both pass;
--   * cancelled trips do not block their vehicles: their active assignments are
--     released automatically;
--   * releasing is a trusted function, not a direct table update.
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
    return new;
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

create trigger trip_assignments_no_double_booking
  before insert or update on public.trip_assignments
  for each row execute function app.check_assignment_double_booking();

-- -----------------------------------------------------------------------------
-- Release
-- -----------------------------------------------------------------------------

create or replace function app.release_trip_assignment(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id uuid := app.current_organisation_id();
  v_profile_id uuid := app.current_profile_id();
  v_assignment public.trip_assignments%rowtype;
begin
  if v_organisation_id is null or v_profile_id is null then
    raise exception 'no active tenant context';
  end if;

  if not app.has_permission('transport.manage') then
    raise exception 'permission denied for transport assignments';
  end if;

  select *
    into v_assignment
  from public.trip_assignments
  where id = p_assignment_id
    and organisation_id = v_organisation_id
  for update;

  if not found then
    raise exception 'assignment not found for this organisation';
  end if;

  if v_assignment.released_at is not null then
    raise exception 'that assignment has already been released';
  end if;

  update public.trip_assignments
     set released_at = now()
   where id = p_assignment_id;

  perform app.record_audit(
    'dispatch.assignment_released',
    'trip_assignments',
    p_assignment_id,
    jsonb_build_object('released_at', v_assignment.released_at),
    jsonb_build_object('released_at', now()),
    null,
    null
  );

  return p_assignment_id;
end;
$$;

revoke all on function app.release_trip_assignment(uuid) from public;
grant execute on function app.release_trip_assignment(uuid) to authenticated;

create or replace function public.release_trip_assignment(p_assignment_id uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.release_trip_assignment(p_assignment_id)
$$;

revoke all on function public.release_trip_assignment(uuid) from public;
grant execute on function public.release_trip_assignment(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Cancelling a trip frees its vehicles
-- -----------------------------------------------------------------------------

create or replace function app.release_assignments_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.trip_assignments
       set released_at = now()
     where trip_id = new.id
       and organisation_id = new.organisation_id
       and released_at is null;

    if app.current_profile_id() is not null and app.current_organisation_id() is not null then
      perform app.record_audit(
        'dispatch.assignments_released_on_cancel',
        'trips',
        new.id,
        jsonb_build_object('status', old.status),
        jsonb_build_object('status', new.status),
        null,
        null
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.release_assignments_on_cancel() from public;

create trigger trips_release_assignments_on_cancel
  after update of status on public.trips
  for each row execute function app.release_assignments_on_cancel();

commit;
