-- =============================================================================
-- PetroCore Supply — Migration 26: Least-privilege sweep
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115002600.
--
-- A schema-wide privilege audit found four classes of excess grants left by
-- Supabase default privileges and by ordinary PostgreSQL function defaults:
--
--   1. `anon` could execute the tenant RPCs (post issue, reverse, release). The
--      functions reject an anonymous caller because there is no tenant context,
--      but the privilege should not exist.
--   2. `authenticated` and `anon` held TRUNCATE on twenty tables. RLS does not
--      apply to TRUNCATE, so this was the only privilege able to destroy data
--      without passing a policy.
--   3. DELETE was granted on tables whose policies never allow a delete.
--   4. Write privileges were granted on read-only views, and direct UPDATE on
--      `inventory_batches` let any permitted user move stock without a ledger
--      entry.
--
-- Delete is revoked only where no DELETE or ALL policy exists, so legitimate
-- master-data deletion keeps working.
-- =============================================================================

begin;

-- 1. No anonymous execution of tenant functions.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app')
  loop
    execute format('revoke execute on function %s from anon', v_function);
  end loop;
end;
$$;

-- 2 to 4. Table and view privileges.
do $$
declare
  v_table record;
begin
  for v_table in
    select c.relname, c.relkind::text as kind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'v')
  loop
    execute format('revoke truncate on public.%I from authenticated, anon', v_table.relname);

    if v_table.kind = 'v' then
      execute format('revoke insert, update, delete on public.%I from authenticated, anon', v_table.relname);
    elsif not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_table.relname
        and p.cmd in ('DELETE', 'ALL')
    ) then
      execute format('revoke delete on public.%I from authenticated, anon', v_table.relname);
    end if;
  end loop;
end;
$$;

-- 5. Stock moves only through the receipt, issue and reversal functions.
revoke update on public.inventory_batches from authenticated, anon;

commit;
