-- =============================================================================
-- PetroCore Supply — Migration 20: Assignment release privileges
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115002000.
--
-- Supabase's default privileges granted UPDATE on trip_assignments. Releasing an
-- assignment is a trusted operation that must write an audit event, so the
-- direct UPDATE grant is revoked; release goes through
-- public.release_trip_assignment.
-- =============================================================================

begin;

revoke update, delete, truncate on public.trip_assignments from authenticated, anon;

commit;
