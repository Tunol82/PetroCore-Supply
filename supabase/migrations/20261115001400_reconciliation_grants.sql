-- =============================================================================
-- PetroCore Supply — Migration 14: Append-only grants for reconciliation
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115001400.
--
-- Supabase's default privileges granted UPDATE on the reconciliation item and
-- investigation tables. RLS had no update policy, so writes were blocked, but
-- the privileges should not exist for append-only evidence.
-- =============================================================================

begin;

revoke update, delete, truncate on public.trip_reconciliation_items,
  public.discrepancy_investigations from authenticated, anon;

commit;
