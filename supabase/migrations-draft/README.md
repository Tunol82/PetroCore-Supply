# Draft migrations (not applied)

SQL in this folder is a **review artefact only**. It is deliberately outside
`supabase/migrations/` so that `supabase db push`, CI and any future deployment
cannot apply it by accident.

## Rules

1. Nothing here may be moved to `supabase/migrations/` until the Decision
   Register records approval of DR-10, DR-20 and DR-24 and the physical
   definitions are signed off.
2. A non-production Supabase project must exist and be confirmed **empty**
   before the first migration is applied (DR-25 greenfield).
3. Every migration must be reviewed against the field-level dictionary and the
   ERD, and must carry RLS tests before sign-off.
4. No draft here may be treated as the source of truth. The dictionary and ERD
   are authoritative.

## Current drafts

| Draft | Scope | Blocked by |
|---|---|---|
| `0001_tenant_access_core.sql` | Organisations, settings, locations, profiles, roles, permissions, role permissions, user roles, location access, audit log, RLS | DR-10, DR-20, DR-24; physical sign-off |

## Later migrations

The remaining v1.1 Part 2 platform tables are defined in the dictionary but are
not in this draft: documents, document links and requirements, reporting, data
imports, notifications, document number sequences, offline devices and sync,
and idempotency records. They belong to later migrations and must not be added
to the tenant/access migration.
