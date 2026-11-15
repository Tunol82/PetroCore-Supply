# Migration 1 — Tenant & Access Physical Proposal

**Status:** Physical design approved and **applied to the non-production Supabase project on 2026-11-15**.  
**Migration:** `supabase/migrations/20261115000100_tenant_access_core.sql` (version `20261115000100`).  
**Prepared:** 2026-11-15.  
**Depends on:** Database Dictionary v1.2 (Parts 1–2); ERD v1.2; Decision Register.  
**Decisions:** DR-10 (a) flat typed locations, DR-24 (a) direct ownership, DR-20 (c) approvals deferred, and the five permission keys were **approved by the product owner on 2026-11-15**.

## 1. Baseline completeness

The v1.1 field-level baseline is now complete: Appendix A contains Parts 1 and 2 (sections 1–25), including finance and payments, documents, reporting, imports, notifications, numbering, offline sync, audit and idempotency.

Two consequences for this migration:

- `audit_logs` can be defined from the supplied baseline (§17.1) rather than derived, so it is included in Migration 1a.
- The remaining platform tables are in scope for **later** migrations, not the tenant/access migration. Adding them now would blur the milestone boundary.

Part 2 provenance still requires the same owner confirmation as Part 1 (see the dictionary document control).

## 2. Table inventory and ownership classification

DR-24 option (a): every tenant-owned table carries `organisation_id` directly. Junctions use composite foreign keys to the tenant key of their parents, so a cross-tenant parent is structurally impossible. `permissions` is the only platform-global table here (D-005).

| Table | Ownership | Enforcement |
|---|---|---|
| `organisations` | Tenant root | `id` is the tenant key |
| `business_settings` | Direct, one per tenant | `organisation_id` unique, FK to organisations |
| `business_locations` | Direct | `organisation_id`; `unique (id, organisation_id)` as a composite parent key |
| `profiles` | Direct, one tenant per user | `auth_user_id` unique globally (D-001) |
| `roles` | Direct | `organisation_id`; `unique (organisation_id, name)`; `unique (id, organisation_id)` |
| `permissions` | Platform-global | No `organisation_id`; tenant read-only |
| `role_permissions` | Direct + composite FK | `(role_id, organisation_id) → roles` |
| `user_roles` | Direct + composite FK | `(user_id, organisation_id) → profiles`; `(role_id, organisation_id) → roles` |
| `user_location_access` | Direct + composite FK | profile and location both constrained to the same tenant |
| `audit_logs` | Direct | `organisation_id`; append-only trigger; `device_id` has no FK until offline tables exist |

## 3. Invariants enforced structurally

1. One user has at most one profile, therefore one tenant (D-001), via `profiles.auth_user_id unique`.
2. One tenant has at most one `business_settings` record via `organisation_id unique`.
3. A role cannot be assigned to a user in another tenant: `user_roles` references `(profiles.id, organisation_id)` and `(roles.id, organisation_id)`.
4. A location grant cannot cross tenants: `user_location_access` references both parent tenant keys.
5. Role permission grants cannot mix tenants: `role_permissions` references `(roles.id, organisation_id)`.
6. Location codes are unique inside a tenant, not globally.
7. Role names are unique inside a tenant, not globally.
8. `updated_at` is maintained by trigger, not by the client.
9. Audit rows cannot be updated or deleted, even by a role that bypasses RLS.

## 4. Row Level Security model

Deny by default. RLS is enabled on every table in scope. Helper functions are `security definer` with an empty `search_path` and are executable only by `authenticated`.

| Table | Select | Insert / update / delete |
|---|---|---|
| `organisations` | Own tenant only | Update with `organisation.manage`; no insert/delete policy (platform operation, deferred) |
| `business_settings` | Own tenant | Update with `organisation.manage`; provisioning inserts outside tenant flow |
| `business_locations` | Own tenant **and** (`locations.view_all` **or** explicit `view` grant) | `locations.manage` |
| `profiles` | Own profile **or** `users.manage` | Own profile **or** `users.manage`; tenant key cannot change |
| `roles` | Own tenant | `users.manage` |
| `permissions` | Any authenticated user (global reference) | None (platform only) |
| `role_permissions` | Own tenant | `users.manage` |
| `user_roles` | Own assignments **or** `users.manage` | `users.manage` |
| `user_location_access` | Own grants **or** `users.manage` | `users.manage` |
| `audit_logs` | Own tenant with `audit.view` | No direct writes; `app.record_audit()` only; no update/delete policy and an append-only trigger |

The authenticated tenant comes only from `auth.uid()` → `profiles`. No client-supplied tenant identifier is consulted anywhere.

## 5. Approved permission keys

These keys are approved (2026-11-15) and are seeded by the migration.

| Key | Purpose | Source |
|---|---|---|
| `organisation.manage` | Update tenant profile and settings | New |
| `users.manage` | Manage roles, assignments and location grants | New |
| `locations.manage` | Create and change locations | v1.1 example key |
| `locations.view_all` | Tenant-wide location visibility (D-004) | New; implements the distinct permission D-004 requires |
| `audit.view` | Read the tenant audit trail | New |

Renaming a key later requires a migration and an update to every policy that references it.

## 6. Known unverified items

- The draft has **not been executed**. No Docker, local PostgreSQL or Supabase CLI runtime is available in this environment.
- Supabase's `auth.users` FK, `auth.uid()` behaviour and default grants must be verified in the target project.
- `security definer` functions must be reviewed for privilege escalation; they are owned by the migration role.
- Index choices are based on expected access patterns, not measured queries.
- Status value sets (`active`, `suspended`, `inactive`) and `access_level` values are taken from the v1.1 text and remain candidates for confirmation.
- `assigned_by` on `user_roles` and `user_location_access` is intentionally not a foreign key, because a composite FK with `set null` would null the non-null tenant column.
- `audit_logs.device_id` has no FK until `offline_devices` is created; the FK must be added in that migration.
- Audit writes go through `app.record_audit()`; direct insert has been revoked. The function derives actor and tenant from `auth.uid()`, so it must be reviewed for search-path and definer safety in the target project.

## 7. Acceptance coverage

| Test | How this design addresses it |
|---|---|
| T-001 cross-tenant isolation | RLS predicates + composite tenant FKs |
| T-002 forged tenant identifier | Tenant resolved only from `auth.uid()`; no client tenant input in any predicate |
| T-003 two active memberships | `profiles.auth_user_id unique` |
| T-004 cross-tenant location grant | Composite FK on `(location_id, organisation_id)` |
| T-005 unassigned location | `locations.view_all` **or** explicit grant |
| T-006 tenant role cannot grant platform admin | No platform authority table in 1a |
| T-007 Super Admin switch audited | Deferred with the D-003 security design; `audit_logs` now exists to record it |
| T-008 revoked membership loses access | `profiles.status = 'active'` in helper functions; `user_location_access.status` |
| T-009 disabled location | `business_locations.status`; add `status = 'active'` to the visibility predicate before sign-off |
| T-010 tenant cannot mutate global data | No write policy on `permissions`; grants revoked from `anon` |
| T-011 custom value cannot shadow global | Not applicable to 1a; applies to D-005 catalogs |
| T-012 audit append-only | No update/delete policy plus `app.prevent_audit_mutation()` trigger |
| T-013 anonymous access | All policies target `authenticated`; `anon` revoked |
| T-014 unauthenticated workspace | Application route already redirects; helper functions return null |

## 8. Approval checklist

Before the draft may move into `supabase/migrations/`:

- [x] DR-10 approved (flat typed locations).
- [x] DR-24 approved (direct ownership).
- [x] DR-20 approved (approvals deferred).
- [x] Permission keys approved.
- [x] Status and access-level value sets approved.
- [x] `business_locations.status` added to the visibility predicate.
- [x] Audit write routed through the `app.record_audit()` security-definer function; direct insert revoked.
- [x] Non-production Supabase project provisioned and confirmed empty.
- [x] Migration executed and RLS tested, including T-001, T-004, T-008 and T-012.
- [x] Sign-off recorded in the Migration 1 checklist.

## 9. Execution evidence (2026-11-15)

Applied to an empty non-production project (PostgreSQL 17.11). Verification results:

| Test | Result |
|---|---|
| T-001 Tenant A sees only its organisation | Pass — `ORG-A` only |
| T-001b Cross-tenant update attempted by Tenant A | Pass — 0 rows affected |
| T-001c Other tenant's location fetched by direct ID | Pass — 0 rows |
| T-002 Tenant context follows the authenticated identity | Pass — Bob sees `ORG-B` only |
| T-003 Profile visibility | Pass — own profile only without `users.manage` |
| T-004 Cross-tenant location grant | Pass — rejected by composite FK |
| T-005 Unassigned location visibility | Pass — 0 before grant |
| T-008 Explicit grant | Pass — 1 after grant |
| T-009 Disabled location | Pass — 0 once inactive |
| T-010 Tenant mutating global permissions | Pass — blocked by RLS |
| T-012 Audit append-only | Pass — update rejected by trigger |
| T-013 Anonymous access | Pass — permission denied |
| T-014 `app.record_audit()` attribution | Pass — correct organisation and actor |

Defect found and fixed during execution: `authenticated` lacked `USAGE` on schema `app`, which broke every policy that calls a helper. The fix (`grant usage on schema app to authenticated`) is in the applied migration.

Not exercised: Super Admin tenant switching (D-003 security design still pending).

Browser verification: signed in against the live non-production project with a provisioned tenant administrator. `/workspace` resolved and rendered the organisation (`Alpha`, `ORG-A`) with no console errors; no tenant identifier was supplied by the browser. The signed-out and unconfigured states remain covered by the Playwright suite.
