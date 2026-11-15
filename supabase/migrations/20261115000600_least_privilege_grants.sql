-- =============================================================================
-- PetroCore Supply — Migration 6: Least-privilege table grants
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-15.
-- Migration history version: 20261115000600.
--
-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated. RLS already blocked the unintended operations, but the grants
-- should not exist in the first place. This migration revokes write privileges
-- where the application has no write path.
-- =============================================================================

begin;

-- Platform reference data is read-only to tenants.
revoke insert, update, delete, truncate on public.permissions from authenticated, anon;

-- Audit rows are written only by security-definer functions and triggers.
revoke insert, update, delete, truncate on public.audit_logs from authenticated, anon;

-- Procurement batches are append-only; insert stays, update and delete go.
revoke update, delete, truncate on public.procurement_batches from authenticated, anon;

commit;
