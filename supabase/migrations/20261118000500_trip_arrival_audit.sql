-- -----------------------------------------------------------------------------
-- PetroCore Supply - Migration: audit arrival changes
--
-- Arrival and odometer readings can be corrected after they are first recorded.
-- This trigger keeps a trail of every change, with the previous and new values.
--
-- Applied to the non-production project on 2026-11-18.
-- Migration history version: 20261118000500.
-- -----------------------------------------------------------------------------

begin;

create or replace function app.audit_trip_arrival()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.current_profile_id() is null or app.current_organisation_id() is null then
    return new;
  end if;

  perform app.record_audit(
    'transport.trip_arrival_recorded',
    'trips',
    new.id,
    jsonb_build_object(
      'actual_arrival', old.actual_arrival,
      'odometer_end', old.odometer_end
    ),
    jsonb_build_object(
      'actual_arrival', new.actual_arrival,
      'odometer_end', new.odometer_end
    ),
    null,
    null
  );

  return new;
end;
$$;

revoke all on function app.audit_trip_arrival() from public;

create trigger trips_arrival_audit
  after update of actual_arrival, odometer_end on public.trips
  for each row
  when (
    new.actual_arrival is distinct from old.actual_arrival
    or new.odometer_end is distinct from old.odometer_end
  )
  execute function app.audit_trip_arrival();

commit;
