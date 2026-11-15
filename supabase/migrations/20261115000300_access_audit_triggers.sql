-- =============================================================================
-- PetroCore Supply — Migration 3: Audit access administration
-- =============================================================================
-- Writes an append-only audit event whenever a role assignment or location
-- grant is created or removed. Triggers are used rather than application calls
-- so the trail cannot be bypassed by a different client.
--
-- Operations performed without an authenticated tenant context (migrations,
-- seeds, administrative SQL) are not attributed and are skipped.
--
-- STATUS: APPLIED to the non-production project on 2026-11-15.
-- Migration history version: 20261115000300.
-- =============================================================================

begin;

create or replace function app.audit_tenant_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_action text;
  v_old jsonb;
  v_new jsonb;
begin
  if app.current_profile_id() is null or app.current_organisation_id() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_table_name = 'user_roles' then
    v_action := case tg_op when 'INSERT' then 'access.role_assigned' else 'access.role_revoked' end;
  elsif tg_table_name = 'user_location_access' then
    v_action := case tg_op when 'INSERT' then 'access.location_granted' else 'access.location_revoked' end;
  else
    v_action := tg_table_name || '.' || lower(tg_op);
  end if;

  if tg_op = 'DELETE' then
    v_id := old.id;
    v_old := to_jsonb(old);
  else
    v_id := new.id;
    v_new := to_jsonb(new);
  end if;

  perform app.record_audit(
    v_action,
    tg_table_name,
    v_id,
    v_old,
    v_new,
    null,
    null
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app.audit_tenant_access_change() from public;

create trigger user_roles_audit
  after insert or delete on public.user_roles
  for each row execute function app.audit_tenant_access_change();

create trigger user_location_access_audit
  after insert or delete on public.user_location_access
  for each row execute function app.audit_tenant_access_change();

commit;
