-- =============================================================================
-- PetroCore Supply — Migration 2: Tenant access RPC wrappers
-- =============================================================================
-- Exposes read-only tenant-context helpers to PostgREST. The `app` schema
-- stays unexposed; these wrappers are security definer and return only data
-- for the authenticated caller.
--
-- STATUS: APPLIED to the non-production project on 2026-11-15.
-- Migration history version: 20261115000200.
-- =============================================================================

begin;

create or replace function public.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_permission(p_permission_key)
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select app.current_organisation_id()
$$;

revoke all on function public.current_tenant_id() from public;
grant execute on function public.current_tenant_id() to authenticated;

commit;
