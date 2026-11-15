# Migration 1 — Tenant & Access Foundation: Reconciliation Checklist

**Status:** Planning artefact. **No SQL, migration file or database change is authorised by this document.**  
**Scope:** Milestone 1 — authentication, tenant membership, roles, permissions, location access and audit.  
**Product:** PetroCore Supply. Deuces is a tenant, not the product name.  
**Prepared:** 2026-11-15.

## 1. Purpose

This checklist converts the approved logical decisions (D-001–D-005) and the Milestone 1 scope into the exact questions that must be answered before a physical schema is written. It deliberately contains no column definitions: those require the field-level Database Dictionary v1.2 and ERD v1.2, neither of which is in this repository.

Use it to review a proposed migration, not as a substitute for one.

## 2. Preconditions before any migration is drafted

- [x] Field-level Database Dictionary v1.2 available in `docs/database/` (Parts 1–2, proposal, owner-approved review baseline).
- [x] ERD v1.2 available in `docs/erd/` (reconstructed proposal, owner-approved with re-verification condition).
- [x] v1.1 Part 2 supplied (sections 12–25, including audit and platform controls).
- [ ] Business Rules & Financial Logic Specification and Technical Blueprint reconciled against both.
- [x] Reconciliation decision 25 resolved: **greenfield** (DR-25, 2026-11-15).
- [x] Canonical naming approved: retain v1.1 names (DR-16, 2026-11-15).
- [ ] Target Supabase project provisioned and confirmed **empty**; roles, extensions and storage configuration reviewed.
- [ ] Baseline backup taken after provisioning and a restore drill completed.
- [ ] Approval model approved (DR-20).
- [ ] Tenant/location ownership coverage approved (DR-24).
- [ ] Location model and hierarchy approved (DR-10).

Until these are closed, this document remains a checklist only. No migration may be drafted while DR-10, DR-20 or DR-24 is open.

## 3. Entities in scope

Every row below must be confirmed against the dictionary. "Approved" means the logical position is settled; "confirm" means the physical definition is not.

| Entity | Logical role | Approved position | Must confirm before migration |
|---|---|---|---|
| `organisations` | Tenant root and single tenant master | D-002 | Exact identity columns, status/deactivation model, uniqueness of tenant identity, soft-delete policy. |
| `business_settings` | Per-organisation settings | D-002 | One-to-one key with `organisations`, nullability, whether absent settings are allowed, default seeding policy. |
| `profiles` | Application user linked to `auth.users` | Milestone 1 §4 | Relationship to `auth.users`, one-profile-per-identity constraint, deactivation, how profile rows are provisioned (no public self-registration). |
| Membership link between profile and organisation | Basis of tenant access | D-001 | The exact entity representing membership, its uniqueness (one active tenant per ordinary user), status values, and how revocation is recorded. |
| `business_locations` | Tenant-owned operating locations | D-002, D-004 | Ownership FK to `organisations`, location status, whether locations can be reassigned, location type model (still open). |
| `roles` | Role master | Milestone 1 §4 | Tenant-scoped or global role definitions; whether system roles are seeded; uniqueness scope. |
| `permissions` | Permission master | Milestone 1 §4 | Canonical permission keys, especially the explicit tenant-wide access permission required by D-004. |
| `role_permissions` | Permissions granted to a role | Milestone 1 §4 | Uniqueness, role scope, whether tenant roles may diverge from system roles. |
| `user_roles` | Role assignment to a user | Milestone 1 §4 | Uniqueness per user/role/tenant, whether assignment is time-bounded, revocation history. |
| `user_location_access` | Explicit location grant | D-004 | Uniqueness per user/location, cross-tenant grant prevention, grant and revoke audit. |
| `audit_logs` | Immutable security and access events | Milestone 1 §4 | Append-only enforcement, actor/tenant/target columns, retention, whether Super Admin switches use the same table. |
| `approval_records` | Approval history | Milestone 1 §4 | Whether Milestone 1 needs this at all, or whether it belongs to a later approval model (report decision 20). |

No entity may be created twice under an alternative ERD name. If the ERD uses a different name, resolve it into one canonical table (report decision 16).

## 4. Cross-cutting invariants

Each invariant needs a database constraint, a policy, or a trusted server check. Where it cannot be enforced in the database, say so explicitly and explain why.

1. Every tenant-owned row resolves to exactly one `organisations` record, directly or through an enforced parent.
2. An ordinary user has at most one active tenant membership; multi-tenant membership is rejected by constraint, not just by UI (D-001).
3. A user's tenant context is derived server-side from membership; a client-supplied organisation identifier is never trusted.
4. A location grant cannot reference a location owned by another organisation (D-004).
5. Tenant-wide visibility requires the explicit permission; holding a role does not imply it (D-004).
6. Platform Super Admin authority is stored outside tenant membership and cannot be granted by any tenant role (D-003).
7. Every Super Admin tenant entry and exit is audited with actor, source context, destination organisation and timestamp (D-003).
8. Global reference catalogs are platform-owned: tenant users may read, never mutate (D-005).
9. Tenant custom values cannot shadow or mutate a canonical global value (D-005).
10. Deactivating a user, revoking a membership or disabling a location removes access without deleting history.
11. Audit records are append-only through ordinary application paths.
12. No service-role key is used to bypass RLS in ordinary user flows.

## 5. RLS policy model to design

For each table, define before writing SQL:

| Question | Required answer |
|---|---|
| Which rows may a tenant member select? | Must be scoped by resolved tenant context. |
| Which rows may a location-scoped user select? | Explicitly granted locations only, unless tenant-wide permission. |
| Who may insert/update/delete? | Deny by default; name the trusted path. |
| What happens with no membership? | No rows, no writes. |
| What happens to a deactivated membership? | Immediate loss of access. |
| Can a Super Admin read tenant rows? | Only inside an authorised switched context, audited. |
| How is cross-tenant access prevented at the database boundary? | Policy predicate on tenant ownership, not a client filter. |

Policies must be tested with two tenants whose identifiers are deliberately similar, including identical location names and overlapping numeric ranges.

## 6. Acceptance tests to add when the schema is approved

- [ ] T-001 Two tenants cannot read, write or infer each other's records.
- [ ] T-002 A client-supplied organisation identifier cannot change the resolved tenant.
- [ ] T-003 A user cannot hold two active ordinary memberships.
- [ ] T-004 A location grant for another tenant's location is rejected.
- [ ] T-005 An unassigned location is inaccessible without the tenant-wide permission.
- [ ] T-006 A tenant role cannot grant platform Super Admin authority.
- [ ] T-007 A Super Admin switch is refused without platform authority and audited when allowed.
- [ ] T-008 A revoked membership loses access on the next request.
- [ ] T-009 A disabled location becomes inaccessible without deleting its history.
- [ ] T-010 A tenant cannot mutate a global reference value.
- [ ] T-011 A tenant custom value does not alter the canonical value or another tenant's view.
- [ ] T-012 Audit rows cannot be modified through application paths.
- [ ] T-013 Anonymous and expired-session requests reach no tenant data.
- [ ] T-014 The unauthenticated workspace redirects to sign-in without exposing tenant state.

These extend, and do not replace, DB-001–DB-030 and the decision-specific tests recorded in the reconciliation report.

## 7. Sequence once approved

1. Canonical names are approved (DR-16). Confirm the physical definitions for every entity in Section 3 once DR-10, DR-20 and DR-24 close.
2. Provision an empty non-production Supabase project (DR-25 greenfield) and take a baseline backup.
3. Create the schema in that project only.
4. Enable RLS with deny-by-default and add the policies from Section 5.
5. Seed only the minimum reference data required by the approved dictionary.
6. Run Section 6 and the applicable DB-001–DB-030 tests.
7. Restore from the baseline backup in a second environment and verify.
8. Obtain sign-off before any production migration.

## 8. Explicitly out of scope

- Procurement, inventory, sales, dispatch, delivery and finance tables.
- Phase 3 general-ledger accounting.
- Self-service registration, invitations or automatic role assignment.
- Any production migration, however small.

## 9. Sign-off record

| Item | Value |
|---|---|
| Database Dictionary v1.2 version approved | v1.2 proposal review revision 3, owner-approved 2026-11-15 |
| ERD v1.2 version approved | Reconstructed ERD review revision 3, approved 2026-11-15 (re-verify if the original is produced) |
| Reconciliation decision 25 resolved | Yes — greenfield (DR-25) |
| Canonical naming resolved | Yes — retain v1.1 names (DR-16) |
| Approval model (DR-20) | _pending_ |
| Tenant/location ownership (DR-24) | _pending_ |
| Location model (DR-10) | _pending_ |
| Approved by (product owner) | Tunde Oladeji |
| Date | 2026-11-15 |
