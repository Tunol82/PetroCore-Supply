# Draft migrations (not applied)

SQL in this folder is a **review artefact only**. It is deliberately outside
`supabase/migrations/` so that `supabase db push`, CI and any future deployment
cannot apply it by accident.

## Rules

1. Nothing here may be moved to `supabase/migrations/` until the Decision
   Register records the relevant approvals and the physical definitions are
   signed off.
2. A non-production Supabase project must exist and be confirmed **empty**
   before the first migration is applied.
3. Every migration must be reviewed against the field-level dictionary and the
   ERD, and must carry RLS tests before promotion.
4. No draft here may be treated as the source of truth. The dictionary and ERD
   are authoritative.

## Current drafts

None.

## Promoted

| Migration | Scope | State |
|---|---|---|
| `20261115000100_tenant_access_core.sql` | Organisations, settings, locations, profiles, roles, permissions, role permissions, user roles, location access, audit log, RLS | Applied 2026-11-15; T-001 to T-014 passed |
| `20261115000200_tenant_access_rpc.sql` | Public RPC wrappers for permission and tenant checks | Applied 2026-11-15 |
| `20261115000300_access_audit_triggers.sql` | Audit triggers on role assignments and location grants | Applied 2026-11-15 |
| `20261115000400_platform_admin.sql` | Platform admins, switch sessions, platform audit | Applied 2026-11-15; PA-001 to PA-012 passed |
| `20261115000500_procurement_core.sql` | Suppliers, supplier depots, products, append-only procurement batches | Applied 2026-11-15; live create and isolation checks passed |
| `20261115000600_least_privilege_grants.sql` | Revokes unused write grants on permissions, audit and batches | Applied 2026-11-15 |
