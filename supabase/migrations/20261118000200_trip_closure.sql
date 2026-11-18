-- -----------------------------------------------------------------------------
-- PetroCore Supply - Migration: trip closure
--
-- Implements the closure guard described in the operating policy. The policy is
-- read per organisation (default: warn, 7 days, transport.manage override):
--
--   allow : close regardless of unresolved reconciliation items.
--   warn  : close regardless, and audit how many items were unresolved.
--   block : refuse closure while unresolved items exist, unless the caller holds
--           the configured override permission and supplies a reason.
--
-- Unresolved means an item status of open, flagged or under_investigation.
-- Closing sets trips.status to 'closed'; a cancelled trip cannot be closed.
--
-- Applied to the non-production project on 2026-11-18.
-- Migration history version: 20261118000200.
-- -----------------------------------------------------------------------------

begin;

create or replace function app.close_trip(p_trip_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organisation_id uuid := app.current_organisation_id();
  v_profile_id uuid := app.current_profile_id();
  v_trip public.trips%rowtype;
  v_policy public.operating_policies%rowtype;
  v_policy_exists boolean := true;
  v_unresolved integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_organisation_id is null or v_profile_id is null then
    raise exception 'no active tenant context';
  end if;

  if not app.has_permission('transport.manage') then
    raise exception 'permission denied to close trips';
  end if;

  select *
    into v_trip
  from public.trips
  where id = p_trip_id
    and organisation_id = v_organisation_id
  for update;

  if not found then
    raise exception 'trip not found for this organisation';
  end if;

  if v_trip.status = 'closed' then
    raise exception 'that trip is already closed';
  end if;

  if v_trip.status = 'cancelled' then
    raise exception 'a cancelled trip cannot be closed';
  end if;

  select *
    into v_policy
  from public.operating_policies
  where organisation_id = v_organisation_id;

  if not found then
    v_policy_exists := false;
    v_policy.trip_closure_policy := 'warn';
    v_policy.closure_override_permission := 'transport.manage';
    v_policy.unresolved_aging_days := 7;
  end if;

  select count(*)
    into v_unresolved
  from public.trip_reconciliation_items item
  join public.trip_reconciliations reconciliation
    on reconciliation.id = item.reconciliation_id
  where reconciliation.organisation_id = v_organisation_id
    and reconciliation.trip_id = p_trip_id
    and item.reconciliation_status in ('open', 'flagged', 'under_investigation');

  if v_unresolved > 0 and v_policy.trip_closure_policy = 'block' then
    if not app.has_permission(v_policy.closure_override_permission) then
      raise exception 'trip closure blocked: % unresolved item(s) need the % permission to override',
        v_unresolved, v_policy.closure_override_permission;
    end if;

    if v_reason is null or length(v_reason) < 3 then
      raise exception 'a reason is required to close a trip with unresolved items';
    end if;
  end if;

  update public.trips
     set status = 'closed',
         updated_at = now()
   where id = p_trip_id;

  perform app.record_audit(
    'transport.trip_closed',
    'trips',
    p_trip_id,
    null,
    jsonb_build_object(
      'status', 'closed',
      'unresolved_items', v_unresolved,
      'policy', v_policy.trip_closure_policy,
      'policy_saved', v_policy_exists,
      'override_used', v_policy.trip_closure_policy = 'block' and v_unresolved > 0
    ),
    v_reason,
    null
  );

  return p_trip_id;
end;
$$;

revoke all on function app.close_trip(uuid, text) from public;
grant execute on function app.close_trip(uuid, text) to authenticated;

create or replace function public.close_trip(p_trip_id uuid, p_reason text default null)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.close_trip(p_trip_id, p_reason)
$$;

revoke all on function public.close_trip(uuid, text) from public;
grant execute on function public.close_trip(uuid, text) to authenticated;

commit;
