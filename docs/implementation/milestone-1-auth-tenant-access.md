# Milestone 1 — Authentication, Tenant Management & Access Control

**Product:** PetroCore Supply  
**Status:** Approved implementation milestone; physical database design remains gated  
**Alignment:** Revised 2026-11-15 to match approved decisions D-001–D-005 in the Database v1.2 Reconciliation Report. The earlier draft allowed ordinary users to hold multiple tenant memberships and select a tenant; that model is superseded.  
**Target:** Establish a secure multi-tenant identity and access foundation before operational modules are built.

## 1. Outcome

A user can securely sign in, establish an authenticated session, have their tenant company resolved on the server, and access only the locations and actions permitted by their membership and role. An ordinary user account belongs to exactly one tenant. Platform Super Admins may enter a tenant context only through the separate privileged, audited switch process described in D-003.

The product identity remains **PetroCore Supply**. Deuces is an example tenant/customer company, not the product name.

## 2. Architecture constraints

- Next.js App Router, React and TypeScript.
- Supabase Auth for identity and session management.
- Supabase PostgreSQL for tenant membership, roles, permissions, locations and audit records.
- Server-side session verification and trusted tenant resolution.
- PostgreSQL Row Level Security (RLS) is the final data-access boundary; hiding records in the UI is never sufficient.
- Tenant context must be derived on the server from the authenticated user's membership. Never trust a tenant ID supplied by the browser (D-001, D-002).
- The platform is a modular monolith. Do not introduce microservices for this milestone.
- PetroCore Supply remains a separate application from PetroCore Operations. Do not create cross-application foreign keys.
- No production credentials, service-role key or other secrets may be committed.

## 3. Scope

### Included
1. Supabase Auth integration and session lifecycle.
2. Sign-in and sign-out experience.
3. Authenticated application route protection.
4. Server-validated resolution of the user's single tenant membership.
5. Tenant-scoped role and permission resolution.
6. Location access resolution and company-wide management visibility where explicitly authorised.
7. Audit events for security- and access-relevant actions.
8. Automated tests for authentication boundaries and cross-tenant isolation.

### Excluded
- Operational business transactions (procurement, sales, inventory, dispatch, delivery and finance).
- Production business-table migrations before the physical schema is reconciled.
- Phase 3 general-ledger accounting.
- Unapproved self-service invitations, public tenant registration or automatic role assignment.
- Treating offline/pending work as an authenticated or officially posted server transaction.
- Tenant switching for ordinary users. D-001 permits switching only for platform Super Admins through the privileged, audited path.
- The Super Admin privilege model, MFA and emergency-access procedure. D-003 requires these to be defined in a separate security design; no Super Admin capability may be implemented as ordinary tenant membership.

## 4. Canonical data-model alignment

The prior logical design identifies these canonical concepts and names to reconcile against the complete Database Dictionary v1.2 before migrations:

- `organisations`: the single authoritative tenant identity and tenant master (D-002).
- `business_settings`: configurable business preferences belonging to exactly one organisation; it must never become a competing tenant master (D-002).
- `profiles`: application user profile linked to the authenticated identity.
- `business_locations`: tenant-owned operating locations.
- `user_roles`: role assignments within a tenant.
- `role_permissions`: permissions granted to roles.
- `user_location_access`: location-level access grants.
- `approval_records`: approval history where applicable.
- `audit_logs`: immutable audit events.

These names are a reconciliation checklist, **not authorisation to invent columns, keys, constraints or SQL**. Confirm exact field definitions, cardinality, deletion rules, indexes and RLS policies against the full Database Dictionary v1.2 and ERD v1.2 before creating migrations.

Supabase Auth's managed `auth.users` identity is distinct from the application profile and tenant membership records.

## 5. Tenant and access rules

1. An ordinary user account belongs to exactly one tenant company. Multiple ordinary-user memberships and tenant switching are not permitted (D-001).
2. A membership is the basis for tenant access; an authenticated user without an active membership has no tenant workspace access.
3. Tenant context is resolved on the server from that membership. It is never selected by, or accepted from, the browser (D-001).
4. Every tenant-owned query and mutation must be tenant-scoped and protected by RLS.
5. Location-scoped users may access only explicitly granted locations within their own tenant (D-004).
6. Company-wide visibility is a distinct permission, not an assumption attached to every role (D-004).
7. Roles and permissions are tenant-scoped unless the approved dictionary explicitly establishes a different model.
8. Never accept role, permission, tenant or location authority from client-submitted values.
9. Deactivated users, revoked memberships and disabled locations must lose access promptly.
10. Administrative access and role changes must be auditable.
11. Platform Super Admin authority is separate from tenant roles and is never granted by tenant membership. Tenant entry requires the privileged, audited switch defined in D-003.

## 6. Security implementation requirements

- Use Supabase SSR-compatible clients for browser and server contexts.
- Refresh sessions using the framework-supported request proxy mechanism.
- Verify identity and membership on the server for protected pages and server actions.
- Keep the Supabase service-role key server-only; do not use it as a shortcut around RLS in normal user flows.
- Apply least privilege and deny-by-default access.
- Enable RLS on every tenant-owned table.
- Add explicit tests proving that Tenant A cannot read, modify or infer Tenant B's records.
- Test unauthorised location access, revoked membership, inactive user, forged tenant-context attempts and location grants pointing at another tenant (D-004).
- Record actor, tenant context, action, target, timestamp and relevant before/after metadata for auditable security changes, subject to the final dictionary.
- Do not log passwords, access tokens, secrets or unnecessary personal data.

## 7. UX acceptance criteria

- Sign-in screen clearly identifies PetroCore Supply.
- Validation and authentication errors are understandable and do not expose sensitive account details.
- Loading, success, empty-membership and expired-session states are handled.
- Users with an active membership proceed to that tenant's workspace after server validation.
- Ordinary users are never shown a tenant chooser and cannot switch tenant (D-001).
- A Super Admin enters a tenant only through the explicit privileged switch and can exit back to the platform-level context (D-003).
- Tenant identity is displayed inside the workspace without replacing the PetroCore Supply product identity.
- Users with no active membership receive a clear access-pending state rather than an empty or misleading dashboard.
- Location restrictions are visible and understandable.
- Core flows are keyboard accessible and responsive on desktop and mobile.

## 8. Delivery sequence

1. Reconcile the complete approved source documents and confirm exact profile, tenant, membership, role, permission, location and audit fields.
2. Configure a non-production Supabase project and environment variables without committing secrets.
3. Create the reviewed database migration and RLS policies only after schema sign-off.
4. Implement Supabase SSR clients and session refresh.
5. Implement sign-in/sign-out and protected routes.
6. Implement server-validated tenant membership resolution. Ordinary users are not offered a tenant selector.
7. Implement role/permission and location-access checks.
8. Add audit recording for access administration.
9. Add unit, integration and end-to-end security tests.
10. Run lint, typecheck, unit tests, end-to-end tests and production build before declaring the milestone complete.

## 9. Release gate

Milestone 1 is complete only when:
- the physical schema matches the reconciled dictionary and ERD;
- RLS and server-side authorisation pass cross-tenant and cross-location tests;
- sign-in, session refresh, sign-out and server-validated tenant resolution work end to end;
- single-tenant membership, platform Super Admin separation and explicit location grants pass their acceptance tests (D-001, D-003, D-004);
- no secrets are committed;
- automated checks pass; and
- an authorised tenant administrator can manage approved memberships and access without bypassing audit controls.

## 10. Approved decisions this milestone must honour

| Decision | Requirement carried into Milestone 1 |
|---|---|
| D-001 | Ordinary users are single-tenant and cannot switch tenant. |
| D-002 | `organisations` is the tenant master; `business_settings` is settings only and belongs to exactly one organisation. |
| D-003 | Super Admin is a platform identity with no default tenant membership; tenant entry is privileged, server-validated and audited. |
| D-004 | Location access is explicitly granted, scoped to the user's tenant; tenant-wide access is a separate permission. |
| D-005 | Global reference catalogs are platform-owned and read-only to tenants; tenant-owned operational records remain tenant-isolated even when they reference them. |

These decisions are logical approvals. They do not authorise specific columns, keys, constraints, indexes, policies or migrations; those remain gated on the field-level dictionary and ERD reconciliation.

**Important:** This document governs milestone scope. It does not replace the Database Dictionary, ERD, Business Rules & Financial Logic Specification or Technical Blueprint, and it does not authorise production database changes by itself.
