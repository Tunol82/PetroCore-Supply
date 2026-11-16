-- =============================================================================
-- PetroCore Supply — Migration 27: Revoke PUBLIC function execution
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115002700.
--
-- PostgreSQL grants EXECUTE to PUBLIC by default. Migration 26 revoked EXECUTE
-- from the `anon` role, but that does not remove a PUBLIC grant, so `anon` kept
-- inherited execution on the two trigger functions.
--
-- This migration revokes EXECUTE from PUBLIC wherever it still exists. Functions
-- that need authenticated callers already carry an explicit grant.
-- =============================================================================

begin;

do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app')
      and exists (
        select 1
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0
          and a.privilege_type = 'EXECUTE'
      )
  loop
    execute format('revoke execute on function %s from public', v_function);
  end loop;
end;
$$;

commit;
